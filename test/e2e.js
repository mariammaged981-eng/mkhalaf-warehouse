// End-to-end check: launches the real app with a temporary data folder, drives the screens
// with the keyboard like a user would, and saves screenshots + a sample PDF/XLSX.
// Usage: node test/e2e.js   (on Linux CI: xvfb-run -a node test/e2e.js)
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = process.env.SHOTS || path.join(os.tmpdir(), 'mkw-shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkw-data-'));
  const app = await electron.launch({ args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, MKW_DATA_DIR: dataDir } });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1400, height: 880 });
  await page.waitForSelector('#nav button');
  const shot = async (n) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };
  const nav = async (s) => { await page.click(`#nav button[data-s="${s}"]`); await page.waitForTimeout(400); };

  await shot('01-dashboard-empty');
  await page.click('#sampleBtn'); await page.waitForTimeout(2000);
  await shot('02-dashboard');
  for (const s of ['items', 'opening', 'transactions', 'clients']) { await nav(s); await shot('03-' + s); }

  // New outgoing document, keyboard only
  await nav('issues');
  await page.keyboard.type('بغدادي'); await page.waitForTimeout(200); await page.keyboard.press('Enter');
  await page.keyboard.type('R-77'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.keyboard.type('لقمه'); await page.waitForTimeout(200); await page.keyboard.press('Enter');
  await page.keyboard.type('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.keyboard.type('101'); await page.waitForTimeout(200); await page.keyboard.press('Enter');
  await page.keyboard.type('9999'); await page.keyboard.press('Enter');
  await shot('04-issue-over');
  await page.click('#dsave'); await page.waitForTimeout(400); await shot('05-over-warning');
  await page.keyboard.press('Escape');
  const q = await page.$$('.li-qty'); await q[1].fill('2');
  await page.click('#dsave'); await page.waitForTimeout(800);
  await shot('06-after-save');

  // New incoming document
  await nav('purchases');
  await page.keyboard.type('صابر'); await page.waitForTimeout(200); await page.keyboard.press('Enter');
  await page.keyboard.type('INV-9'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.keyboard.type('فلتر'); await page.waitForTimeout(200); await page.keyboard.press('Enter');
  await page.keyboard.type('4'); await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // price -> new line
  await page.keyboard.type('صنف جديد تماما'); await page.waitForTimeout(200); await page.keyboard.press('Enter'); // offers "add new"
  await page.waitForSelector('.modal'); await shot('07a-inline-new-item');
  await page.click('.modal .btn-primary'); await page.waitForTimeout(500);
  await page.keyboard.type('7'); await page.keyboard.press('Enter'); await page.keyboard.type('55');
  const newItem = await page.$$eval('.li-item', (els) => els.map((e) => e.value));
  if (!newItem.some((v) => v.includes('صنف جديد تماما'))) throw new Error('inline add failed: ' + newItem);
  await shot('07-purchase');
  await page.click('#dsave'); await page.waitForTimeout(800);

  // Reports
  await nav('reports'); await page.waitForTimeout(600); await shot('08-rpt-summary');
  for (const r of ['client', 'count', 'purchases', 'stock', 'low']) {
    await page.click(`.rpt-pick button[data-r="${r}"]`); await page.waitForTimeout(700); await shot('09-rpt-' + r);
  }
  await page.click('.rpt-pick button[data-r="card"]'); await page.waitForTimeout(300);
  await page.fill('#ritem', '203'); await page.waitForTimeout(200); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await shot('10-rpt-card');

  // English
  await page.click('#langBtn'); await page.waitForTimeout(600);
  await page.click('.rpt-pick button[data-r="summary"]'); await page.waitForTimeout(700); await shot('11-en-summary');
  await nav('dashboard'); await shot('12-en-dashboard');
  await nav('settings'); await shot('13-en-settings');
  await nav('issues'); await shot('14-en-issue');

  // PDF + Excel output samples
  const res = await page.evaluate(async () => {
    const rep = await call('report', { name: 'summary', params: monthRange(new Date().getFullYear(), new Date().getMonth() + 1), lang: 'ar' });
    const d = (await call('docs.list', { types: ['issue'], limit: 1 }))[0];
    const doc = await call('docs.get', d.id);
    return withLang('ar', () => ({ html: reportPrintHtml(rep), vhtml: voucherHtml(doc), rep }));
  });
  const root = path.join(__dirname, '..');
  await app.evaluate(async ({ BrowserWindow }, { html, vhtml, out, root }) => {
    const rq = process.mainModule.require; const fs = rq('fs'); const os = rq('os'); const path = rq('path'); const { pathToFileURL } = rq('url');
    for (const [h, name, land] of [[html, 'summary.pdf', true], [vhtml, 'voucher.pdf', false]]) {
      const tmp = path.join(os.tmpdir(), 'mkw_test.html');
      fs.writeFileSync(tmp, h.replace('<head>', `<head><base href="${pathToFileURL(path.join(root, 'renderer')).href}/">`));
      const w = new BrowserWindow({ show: false }); await w.loadFile(tmp);
      await w.webContents.executeJavaScript('document.fonts.ready.then(()=>1)');
      fs.writeFileSync(path.join(out, name), await w.webContents.printToPDF({ landscape: land, printBackground: true, pageSize: 'A4' })); w.close();
    }
  }, { html: res.html, vhtml: res.vhtml, out: OUT, root });
  const { exportReport } = require('../src/excel');
  await exportReport(res.rep, { app_name_ar: 'مخزن م. خلف', app_name_en: 'M. Khalaf Warehouse' }, path.join(OUT, 'summary.xlsx'));

  await app.close();
  console.log('screenshots in', OUT);
  if (errors.length) { console.error('PAGE ERRORS:', errors); process.exit(1); }
  console.log('E2E OK');
})().catch((e) => { console.error(e); process.exit(1); });
