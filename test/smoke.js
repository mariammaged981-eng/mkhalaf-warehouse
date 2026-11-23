// Fast checks of the database + stock engine (no window needed): node test/smoke.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/db');
const R = require('../src/reports');
const { loadSample } = require('../src/sample');
const I = require('../shared/i18n');

(async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mkw-smoke-')), 'w.db');
  const s = new Store();
  await s.open(file);

  // default lists
  assert.strictEqual(s.list('item_groups').length, 8);
  assert.deepStrictEqual(s.list('clients').map((c) => c.name), ['الجنوب', 'اخضر بغدادى', 'احمر حسن', 'اخضر سمير', 'حلايب', 'جندولا', 'المصنع']);
  assert.strictEqual(s.list('suppliers').length, 2);

  // weighted average cost
  const g = s.list('item_groups')[0].id;
  const id = s.saveMaster('items', { name: 'عتلة اختبار', group_id: g, unit: 'قطعة', min_qty: 5, opening_qty: 10, opening_price: 100 });
  const sup = s.list('suppliers')[0].id; const cli = s.list('clients')[0].id;
  s.saveDoc({ type: 'purchase', date: '2026-01-05', party_id: sup, ref_no: '1', lines: [{ item_id: id, qty: 10, price: 200 }] });
  let b = R.balances(s)[id];
  assert.strictEqual(b.qty, 20); assert.strictEqual(b.unitCost, 150); assert.strictEqual(b.value, 3000);
  s.saveDoc({ type: 'issue', date: '2026-01-10', party_id: cli, ref_no: 'A', lines: [{ item_id: id, qty: 4, price: 150 }] });
  s.saveDoc({ type: 'issue_return', date: '2026-01-11', party_id: cli, ref_no: 'B', lines: [{ item_id: id, qty: 1, price: 150 }] });
  s.saveDoc({ type: 'purchase_return', date: '2026-01-12', party_id: sup, ref_no: 'C', lines: [{ item_id: id, qty: 2, price: 200 }] });
  b = R.balances(s)[id];
  assert.strictEqual(b.qty, 10 + 10 - 4 + 1 - 2); // opening + purchases - issued + returns - purchase returns

  // over-issue is blocked
  assert.throws(() => s.saveDoc({ type: 'issue', date: '2026-01-20', party_id: cli, lines: [{ item_id: id, qty: 999, price: 1 }] }), /negativeStock/);
  // back-dated issue that would make an earlier balance negative is blocked
  assert.throws(() => s.saveDoc({ type: 'issue', date: '2026-01-01', party_id: cli, lines: [{ item_id: id, qty: 12, price: 1 }] }), /negativeStock/);
  // deleting the purchase would make stock negative -> blocked
  const id2 = s.saveMaster('items', { name: 'صنف ٢', group_id: g, unit: 'قطعة' });
  const pur = s.saveDoc({ type: 'purchase', date: '2026-01-05', party_id: sup, lines: [{ item_id: id2, qty: 5, price: 10 }] });
  s.saveDoc({ type: 'issue', date: '2026-01-06', party_id: cli, lines: [{ item_id: id2, qty: 3, price: 10 }] });
  assert.throws(() => s.deleteDoc(pur), /negativeStock/);
  assert.strictEqual(R.balances(s)[id2].qty, 2);

  // last purchase price method
  s.setSettings({ cost_method: 'last' });
  assert.strictEqual(R.balances(s)[id].unitCost, 200);
  s.setSettings({ cost_method: 'avg' });

  // reports build in both languages
  for (const lang of ['ar', 'en']) {
    for (const n of ['client', 'summary', 'count', 'purchases', 'stock', 'low']) R.buildReport(s, n, { from: '2026-01-01', to: '2026-01-31' }, lang);
    R.buildReport(s, 'card', { itemId: id, from: '2026-01-01', to: '2026-01-31' }, lang);
  }
  const sum = R.buildReport(s, 'summary', { from: '2026-01-06', to: '2026-01-31' }, 'ar');
  const row = sum.rows.find((r) => r.item_id === id);
  assert.strictEqual(row.c.oQ, 20); assert.strictEqual(row.c.iQ, -2); assert.strictEqual(row.c.xQ, 3); assert.strictEqual(row.c.cQ, 15);
  const card = R.buildReport(s, 'card', { itemId: id }, 'ar');
  assert.strictEqual(card.rows[card.rows.length - 1].c.bal, 15);

  // Arabic search normalisation
  assert.ok(I.matches('اخضر بغدادى', 'بغدادي'));
  assert.ok(I.matches('أحمر حسن', 'احمر'));
  assert.ok(I.matches('لقمة 32 مم', 'لقمه'));
  assert.strictEqual(I.parseDate('5/1/2026'), '2026-01-05');
  assert.strictEqual(I.fmtDate('2026-01-05'), '05/01/2026');
  assert.strictEqual(I.fmtMoney(1234567.5), '1,234,567.50');

  // sample data + persistence
  loadSample(s);
  const n = s.get('SELECT COUNT(*) n FROM docs').n;
  assert.ok(n > 20);
  const s2 = new Store(); await s2.open(file);
  assert.strictEqual(s2.get('SELECT COUNT(*) n FROM docs').n, n);
  console.log('smoke OK —', n, 'sample documents');
})().catch((e) => { console.error(e); process.exit(1); });
