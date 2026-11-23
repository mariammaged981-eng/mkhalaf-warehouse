// Sample data so the app can be tried out immediately (Settings -> Load sample data).
const ITEMS = [
  // code, name, cat, group code, unit, min, opening qty, opening price
  ['101', 'عتلة 1.5 متر', 'B-15', '1', 'قطعة', 5, 20, 450],
  ['102', 'عتلة 2 متر', 'B-20', '1', 'قطعة', 5, 15, 600],
  ['103', 'عتلة حديد مصمت', 'B-SD', '1', 'قطعة', 3, 8, 720],
  ['201', 'فدية 10 كيلو', 'S-10', '2', 'قطعة', 4, 12, 380],
  ['202', 'بورة تكسير', 'P-01', '2', 'قطعة', 2, 6, 950],
  ['203', 'لقمة 32 مم', 'BIT-32', '2', 'قطعة', 20, 60, 210],
  ['204', 'لقمة 38 مم', 'BIT-38', '2', 'قطعة', 20, 45, 260],
  ['301', 'خرطوم هواء 1 بوصة', 'H-1', '3', 'متر', 50, 200, 85],
  ['302', 'خرطوم مياه 3/4', 'H-34', '3', 'متر', 30, 120, 40],
  ['303', 'شاكوش 5 كيلو', 'HM-5', '3', 'قطعة', 4, 10, 320],
  ['401', 'حجر جلخ 7 بوصة', 'G-7', '4', 'قطعة', 25, 80, 55],
  ['402', 'حجر قطع 14 بوصة', 'C-14', '4', 'قطعة', 15, 40, 140],
  ['501', 'فلتر زيت كمبروسر', 'F-OIL', '5', 'قطعة', 6, 14, 650],
  ['502', 'فلتر هواء كمبروسر', 'F-AIR', '5', 'قطعة', 6, 10, 900],
  ['503', 'فلتر سولار', 'F-DSL', '5', 'قطعة', 6, 18, 280],
  ['601', 'زيت هيدروليك', 'OIL-H', '6', 'جركن', 5, 12, 1450],
  ['602', 'شحم', 'GRS', '6', 'كيلو', 10, 40, 120],
  ['701', 'وصلة خرطوم سريعة', 'ACC-QC', '7', 'قطعة', 10, 30, 95],
  ['702', 'جلبة نحاس', 'ACC-BR', '7', 'قطعة', 10, 25, 60],
  ['703', 'واير صلب 6 مم', 'W-6', '7', 'متر', 100, 400, 35],
  ['801', 'بستم جاك هامر', 'SP-PST', '8', 'قطعة', 2, 5, 3200],
  ['802', 'سلندر جاك هامر', 'SP-CYL', '8', 'قطعة', 1, 3, 5400],
  ['803', 'جوان طقم كامل', 'SP-GSK', '8', 'طقم', 3, 8, 480],
];

function rnd(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function loadSample(store) {
  store.clearAll(false);
  const groups = {}; store.list('item_groups').forEach((g) => { groups[g.code] = g.id; });
  const itemIds = [];
  const prices = {};
  for (const [code, name, cat, g, unit, min, oq, op] of ITEMS) {
    const id = store.saveMaster('items', { code, name, cat, group_id: groups[g], unit, min_qty: min, opening_qty: oq, opening_price: op });
    itemIds.push(id); prices[id] = op;
  }
  const clients = store.list('clients').map((c) => c.id);
  const suppliers = store.list('suppliers').map((s) => s.id);
  const R = rnd(42);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  let inv = 1500; let req = 300;
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (d.getDay() === 5) continue; // Friday off
    if (R() < 0.18) { // purchase
      const lines = [];
      const n = 2 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const it = pick(itemIds);
        if (lines.some((l) => l.item_id === it)) continue;
        prices[it] = Math.round(prices[it] * (0.97 + R() * 0.1));
        lines.push({ item_id: it, qty: 5 + Math.floor(R() * 30), price: prices[it] });
      }
      store.saveDoc({ type: 'purchase', date: iso, party_id: pick(suppliers), ref_no: String(inv++), lines });
    }
    const issues = R() < 0.6 ? 1 + Math.floor(R() * 2) : 0;
    for (let k = 0; k < issues; k++) {
      const lines = [];
      const n = 1 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const it = pick(itemIds);
        if (lines.some((l) => l.item_id === it)) continue;
        lines.push({ item_id: it, qty: 1 + Math.floor(R() * 6), price: prices[it] });
      }
      try { store.saveDoc({ type: 'issue', date: iso, party_id: pick(clients), ref_no: String(req++), lines }); } catch (e) { /* not enough stock: skip */ }
    }
    if (R() < 0.03) {
      try { store.saveDoc({ type: 'issue_return', date: iso, party_id: pick(clients), ref_no: 'R' + req, lines: [{ item_id: pick(itemIds), qty: 1, price: 0 }].map((l) => ({ ...l, price: prices[l.item_id] })) }); } catch (e) { /* ignore */ }
    }
    if (R() < 0.02) {
      try { const it = pick(itemIds); store.saveDoc({ type: 'purchase_return', date: iso, party_id: pick(suppliers), ref_no: 'RT' + inv, lines: [{ item_id: it, qty: 1, price: prices[it] }] }); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = { loadSample };
