// Electron main process: window, database, IPC API, printing, PDF/Excel export, backup/restore.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { Store } = require('./src/db');
const R = require('./src/reports');
const { exportReport } = require('./src/excel');
const { loadSample } = require('./src/sample');
const { fmtDate, todayISO } = require('./shared/i18n');

const store = new Store();
let win;
let dataDir; let dbFile; let backupDir;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

function updateTitle() {
  const s = store.settings();
  if (win) win.setTitle(s.lang === 'en' ? `${s.app_name_en} — ${s.app_name_ar}` : `${s.app_name_ar} — ${s.app_name_en}`);
}

function autoBackup() {
  try {
    if (!fs.existsSync(dbFile)) return;
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(dbFile, path.join(backupDir, `auto_${stamp()}.db`));
    const files = fs.readdirSync(backupDir).filter((f) => f.startsWith('auto_')).sort();
    while (files.length > 20) fs.unlinkSync(path.join(backupDir, files.shift()));
  } catch (e) { console.error('auto backup failed', e); }
}

function hash(pw, salt) { return crypto.pbkdf2Sync(String(pw), salt, 100000, 32, 'sha256').toString('hex'); }

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 1024, minHeight: 680, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); updateTitle(); });
  win.on('page-title-updated', (e) => e.preventDefault());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
  });
}

// Render an HTML document (from the renderer) in a hidden window, for printing or PDF.
async function withHtml(html, fn) {
  const tmp = path.join(app.getPath('temp'), `mkw_print_${Date.now()}.html`);
  const base = pathToFileURL(path.join(__dirname, 'renderer') + path.sep).href;
  fs.writeFileSync(tmp, html.replace('<head>', `<head><base href="${base}">`), 'utf8');
  const pw = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  try {
    await pw.loadFile(tmp);
    await pw.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');
    return await fn(pw);
  } finally {
    setTimeout(() => { try { pw.close(); fs.unlinkSync(tmp); } catch (e) { /* ignore */ } }, 1500);
  }
}

const api = {
  'settings.get': () => {
    const s = store.settings();
    const { password_hash, password_salt, ...rest } = s;
    return { ...rest, has_password: !!password_hash, db_file: dbFile, backup_dir: backupDir };
  },
  'settings.set': (obj) => {
    const allowed = ['app_name_ar', 'app_name_en', 'lang', 'cost_method'];
    const o = {}; allowed.forEach((k) => { if (obj[k] !== undefined) o[k] = obj[k]; });
    store.setSettings(o); updateTitle(); return true;
  },
  'auth.status': () => !!store.settings().password_hash,
  'auth.check': (pw) => { const s = store.settings(); return !s.password_hash || hash(pw, s.password_salt) === s.password_hash; },
  'auth.set': (pw) => {
    if (!pw) { store.setSettings({ password_hash: '', password_salt: '' }); return false; }
    const salt = crypto.randomBytes(16).toString('hex');
    store.setSettings({ password_hash: hash(pw, salt), password_salt: salt }); return true;
  },
  'logo.choose': async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const f = r.filePaths[0]; const ext = path.extname(f).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const data = `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
    store.setSettings({ logo: data }); return data;
  },
  'logo.clear': () => { store.setSettings({ logo: '' }); return true; },

  'master.list': ({ table }) => store.list(table),
  'master.save': ({ table, rec }) => store.saveMaster(table, rec),
  'master.delete': ({ table, id }) => store.deleteMaster(table, id),
  'master.nextCode': ({ table }) => store.nextCode(table),
  'opening.save': (rows) => store.saveOpening(rows),

  'docs.list': (f) => store.listDocs(f),
  'docs.get': (id) => store.getDoc(id),
  'docs.save': (doc) => store.saveDoc(doc),
  'docs.delete': (id) => store.deleteDoc(id),
  'stock.balances': (o) => R.balances(store, o || {}),
  'dashboard': () => R.dashboard(store),
  'report': ({ name, params, lang }) => R.buildReport(store, name, params, lang),
  'counts.save': ({ item_id, date, qty }) => store.savePhysicalCount(item_id, date, qty),

  'export.excel': async ({ report, defaultName }) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: `${defaultName || 'report'}_${stamp()}.xlsx`, filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (r.canceled || !r.filePath) return null;
    await exportReport(report, store.settings(), r.filePath);
    shell.openPath(r.filePath);
    return r.filePath;
  },
  'print.html': ({ html, landscape }) => withHtml(html, (pw) => new Promise((resolve) => {
    pw.webContents.print({ printBackground: true, landscape: !!landscape }, (ok, err) => resolve(ok || err === 'cancelled' ? true : err));
  })),
  'print.pdf': async ({ html, landscape, defaultName }) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: `${defaultName || 'report'}_${stamp()}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return null;
    const buf = await withHtml(html, (pw) => pw.webContents.printToPDF({ printBackground: true, landscape: !!landscape, pageSize: 'A4', margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } }));
    fs.writeFileSync(r.filePath, buf);
    shell.openPath(r.filePath);
    return r.filePath;
  },

  'backup.create': async () => {
    const r = await dialog.showSaveDialog(win, { defaultPath: `warehouse_backup_${stamp()}.db`, filters: [{ name: 'Backup', extensions: ['db'] }] });
    if (r.canceled || !r.filePath) return null;
    store.save();
    fs.copyFileSync(dbFile, r.filePath);
    return r.filePath;
  },
  'backup.restore': async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Backup', extensions: ['db', 'sqlite'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const buf = fs.readFileSync(r.filePaths[0]);
    // validate it is one of our databases before replacing anything
    const test = new store.SQL.Database(buf);
    try { test.exec('SELECT 1 FROM items LIMIT 1; SELECT 1 FROM docs LIMIT 1; SELECT 1 FROM settings LIMIT 1'); } catch (e) { test.close(); throw new Error('Invalid backup file'); }
    test.close();
    autoBackup();
    fs.writeFileSync(dbFile, buf);
    store.load();
    updateTitle();
    return r.filePaths[0];
  },
  'data.sample': () => { autoBackup(); loadSample(store); return true; },
  'data.clear': () => { autoBackup(); store.clearAll(false); return true; },
  'open.folder': (which) => shell.openPath(which === 'backups' ? (fs.mkdirSync(backupDir, { recursive: true }), backupDir) : dataDir),
  'app.info': () => ({ version: app.getVersion(), today: todayISO(), todayFmt: fmtDate(todayISO()) }),
};

ipcMain.handle('api', async (_e, method, args) => {
  const fn = api[method];
  if (!fn) return { ok: false, error: 'Unknown method ' + method };
  try {
    return { ok: true, data: await fn(args) };
  } catch (e) {
    console.error(method, e);
    return { ok: false, error: e.message, info: e.info };
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    // Keep data next to the program when running portable, otherwise in the user's AppData folder.
    dataDir = process.env.MKW_DATA_DIR || path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    dbFile = path.join(dataDir, 'warehouse.db');
    backupDir = path.join(dataDir, 'backups');
    await store.open(dbFile);
    createWindow();
  });
  app.on('before-quit', () => { try { store.save(); } catch (e) { /* ignore */ } autoBackup(); });
  app.on('window-all-closed', () => app.quit());
}
