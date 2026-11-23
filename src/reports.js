// Stock engine (weighted average / last purchase price) and all report builders.
const { t, fmtDate, monthRange, todayISO } = require('../shared/i18n');
const { SIGN } = require('./db');

const EPS = 1e-9;

// Walk every movement in date order and keep a running state per item.
// opts: { from, to, itemIds, excludeDocId, onMove(m, before, after, unitCostUsed) }
function runLedger(store, opts = {}) {
  const method = store.settings().cost_method === 'last' ? 'last' : 'avg';
  const items = store.list('items');
  const state = {};
  for (const it of items) {
    const q = Number(it.opening_qty) || 0; const p = Number(it.opening_price) || 0;
    state[it.id] = { qty: q, value: q * p, lastPP: p };
  }
  const unitCost = (st) => (method === 'avg' ? (st.qty > EPS ? st.value / st.qty : st.lastPP) : st.lastPP);
  const valueOf = (st) => (method === 'avg' ? st.value : st.qty * st.lastPP);
  const snap = () => {
    const o = {};
    for (const id in state) { const st = state[id]; o[id] = { qty: st.qty, value: valueOf(st), unitCost: unitCost(st), lastPP: st.lastPP }; }
    return o;
  };
  let opening = opts.from ? null : snap();
  const moves = store.movements({ to: opts.to, itemIds: opts.itemIds }).filter((m) => m.doc_id !== opts.excludeDocId);
  for (const m of moves) {
    if (!opening && m.date >= opts.from) opening = snap();
    const st = state[m.item_id];
    if (!st) continue;
    const uc = unitCost(st);
    let moveValue;
    if (m.type === 'purchase') {
      moveValue = m.qty * m.price;
      st.qty += m.qty; st.value += moveValue; st.lastPP = m.price;
    } else {
      moveValue = m.qty * uc;
      st.qty += SIGN[m.type] * m.qty;
      st.value += SIGN[m.type] * moveValue;
    }
    if (st.qty <= EPS) st.value = 0; // avoid rounding drift on empty stock
    if (opening && opts.onMove) opts.onMove(m, moveValue, { qty: st.qty, value: valueOf(st), unitCost: unitCost(st) });
  }
  if (!opening) opening = snap();
  return { items, opening, closing: snap(), method };
}

function balances(store, { excludeDocId } = {}) {
  const { closing } = runLedger(store, { excludeDocId });
  return closing;
}

function subtitleRange(lang, from, to) {
  if (from && to) return t(lang, 'fromTo', fmtDate(from), fmtDate(to));
  if (to) return t(lang, 'untilDate', fmtDate(to));
  return '';
}

const groupKey = (it) => it.group_id || 0;
function groupedItems(items, groupId) {
  const list = items.filter((i) => !groupId || i.group_id == groupId);
  const groups = new Map();
  list.sort((a, b) => (Number(a.group_code) || 999) - (Number(b.group_code) || 999) || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  for (const it of list) {
    const k = groupKey(it);
    if (!groups.has(k)) groups.set(k, { name: it.group_name || '-', items: [] });
    groups.get(k).items.push(it);
  }
  return groups;
}
const sumKeys = (rows, keys) => { const o = {}; keys.forEach((k) => { o[k] = rows.reduce((s, r) => s + (Number(r.c[k]) || 0), 0); }); return o; };

// ---------------- reports ----------------
const builders = {
  // a) Client report
  client(store, p, lang) {
    const mode = p.mode === 'items' ? 'items' : 'detail';
    const rows = []; const where = ["d.type IN ('issue','issue_return')"]; const args = [];
    if (p.from) { where.push('d.date>=?'); args.push(p.from); }
    if (p.to) { where.push('d.date<=?'); args.push(p.to); }
    if (p.clientId) { where.push('d.party_id=?'); args.push(p.clientId); }
    const lines = store.all(`SELECT d.date, d.id AS doc_id, d.ref_no, d.type, c.id AS client_id, c.name AS client, c.code AS client_code,
        i.id AS item_id, i.code, i.name AS item, i.cat, i.unit, l.qty, l.price
      FROM doc_lines l JOIN docs d ON d.id=l.doc_id JOIN items i ON i.id=l.item_id LEFT JOIN clients c ON c.id=d.party_id
      WHERE ${where.join(' AND ')} ORDER BY CAST(c.code AS INTEGER), c.name, d.date, d.id, l.line_no`, args);
    const columns = mode === 'detail' ? [
      { key: 'date', label: t(lang, 'date'), type: 'date' },
      { key: 'ref', label: t(lang, 'requestNo'), type: 'text' },
      { key: 'kind', label: t(lang, 'docType'), type: 'text' },
      { key: 'code', label: t(lang, 'itemCode'), type: 'text' },
      { key: 'item', label: t(lang, 'itemName'), type: 'text', wide: true },
      { key: 'cat', label: t(lang, 'cat'), type: 'text' },
      { key: 'unit', label: t(lang, 'unit'), type: 'text' },
      { key: 'qty', label: t(lang, 'qty'), type: 'qty' },
      { key: 'price', label: t(lang, 'price'), type: 'money' },
      { key: 'value', label: t(lang, 'value'), type: 'money' },
    ] : [
      { key: 'code', label: t(lang, 'itemCode'), type: 'text' },
      { key: 'item', label: t(lang, 'itemName'), type: 'text', wide: true },
      { key: 'cat', label: t(lang, 'cat'), type: 'text' },
      { key: 'unit', label: t(lang, 'unit'), type: 'text' },
      { key: 'qty', label: t(lang, 'qty'), type: 'qty' },
      { key: 'price', label: t(lang, 'price'), type: 'money' },
      { key: 'value', label: t(lang, 'value'), type: 'money' },
    ];
    const byClient = new Map();
    for (const l of lines) {
      if (!byClient.has(l.client_id)) byClient.set(l.client_id, { name: l.client, lines: [] });
      byClient.get(l.client_id).lines.push(l);
    }
    let grand = 0;
    for (const [, c] of byClient) {
      rows.push({ kind: 'section', label: c.name });
      const data = [];
      if (mode === 'detail') {
        for (const l of c.lines) {
          const s = l.type === 'issue_return' ? -1 : 1;
          data.push({ kind: 'data', c: { date: l.date, ref: l.ref_no, kind: t(lang, l.type), code: l.code, item: l.item, cat: l.cat, unit: l.unit, qty: s * l.qty, price: l.price, value: s * l.qty * l.price } });
        }
      } else {
        const agg = new Map();
        for (const l of c.lines) {
          const s = l.type === 'issue_return' ? -1 : 1;
          if (!agg.has(l.item_id)) agg.set(l.item_id, { code: l.code, item: l.item, cat: l.cat, unit: l.unit, qty: 0, value: 0 });
          const a = agg.get(l.item_id); a.qty += s * l.qty; a.value += s * l.qty * l.price;
        }
        for (const a of agg.values()) data.push({ kind: 'data', c: { ...a, price: Math.abs(a.qty) > EPS ? a.value / a.qty : 0 } });
      }
      rows.push(...data);
      const sub = sumKeys(data, ['qty', 'value']);
      grand += sub.value;
      rows.push({ kind: 'subtotal', label: t(lang, 'clientTotal', c.name), c: { value: sub.value } });
    }
    if (byClient.size > 1 || !p.clientId) rows.push({ kind: 'total', label: t(lang, 'grandTotal'), c: { value: grand } });
    const clientName = p.clientId ? (store.get('SELECT name FROM clients WHERE id=?', [p.clientId]) || {}).name : t(lang, 'allClients');
    return { title: t(lang, 'rptClient') + ' — ' + clientName, subtitle: subtitleRange(lang, p.from, p.to), columns, rows, landscape: mode === 'detail' };
  },

  // b) Monthly warehouse summary
  summary(store, p, lang) {
    const acc = {};
    const L = runLedger(store, {
      from: p.from, to: p.to,
      onMove(m, v) {
        const a = acc[m.item_id] || (acc[m.item_id] = { inQ: 0, inV: 0, outQ: 0, outV: 0 });
        if (m.type === 'purchase') { a.inQ += m.qty; a.inV += v; }
        if (m.type === 'purchase_return') { a.inQ -= m.qty; a.inV -= v; }
        if (m.type === 'issue') { a.outQ += m.qty; a.outV += v; }
        if (m.type === 'issue_return') { a.outQ -= m.qty; a.outV -= v; }
      },
    });
    const cols = [
      { key: 'code', label: t(lang, 'itemCode'), type: 'text' },
      { key: 'item', label: t(lang, 'itemName'), type: 'text', wide: true },
      { key: 'unit', label: t(lang, 'unit'), type: 'text' },
    ];
    for (const [g, gl] of [['o', 'opening'], ['i', 'incoming'], ['x', 'outgoing'], ['c', 'closing']]) {
      cols.push({ key: g + 'Q', label: t(lang, 'qty'), type: 'qty', group: t(lang, gl) });
      cols.push({ key: g + 'P', label: t(lang, 'price'), type: 'money', group: t(lang, gl) });
      cols.push({ key: g + 'V', label: t(lang, 'value'), type: 'money', group: t(lang, gl) });
    }
    const rows = []; const vkeys = ['oQ', 'oV', 'iQ', 'iV', 'xQ', 'xV', 'cQ', 'cV'];
    const all = [];
    for (const [, g] of groupedItems(L.items, p.groupId)) {
      const data = [];
      for (const it of g.items) {
        const o = L.opening[it.id]; const c = L.closing[it.id]; const a = acc[it.id] || { inQ: 0, inV: 0, outQ: 0, outV: 0 };
        if (p.hideZero !== false && Math.abs(o.qty) < EPS && Math.abs(c.qty) < EPS && !acc[it.id]) continue;
        data.push({ kind: 'data', item_id: it.id, c: {
          code: it.code, item: it.name, unit: it.unit,
          oQ: o.qty, oP: o.qty > EPS ? o.value / o.qty : o.unitCost, oV: o.value,
          iQ: a.inQ, iP: Math.abs(a.inQ) > EPS ? a.inV / a.inQ : null, iV: a.inV,
          xQ: a.outQ, xP: Math.abs(a.outQ) > EPS ? a.outV / a.outQ : null, xV: a.outV,
          cQ: c.qty, cP: c.qty > EPS ? c.value / c.qty : c.unitCost, cV: c.value,
        } });
      }
      if (!data.length) continue;
      rows.push({ kind: 'section', label: g.name });
      rows.push(...data); all.push(...data);
      rows.push({ kind: 'subtotal', label: t(lang, 'groupTotal', g.name), c: sumKeys(data, vkeys) });
    }
    rows.push({ kind: 'total', label: t(lang, 'stockTotal'), c: sumKeys(all, vkeys) });
    return { title: t(lang, 'rptSummary'), subtitle: subtitleRange(lang, p.from, p.to), columns: cols, rows, landscape: true, small: true };
  },

  // c) Stock count (جرد)
  count(store, p, lang) {
    const acc = {};
    const L = runLedger(store, {
      from: p.from, to: p.to,
      onMove(m) {
        const a = acc[m.item_id] || (acc[m.item_id] = { purchase: 0, issue: 0, purchase_return: 0, issue_return: 0 });
        a[m.type] += m.qty;
      },
    });
    const countDate = p.to || todayISO();
    const counts = {};
    store.all('SELECT item_id, qty FROM physical_counts WHERE count_date=?', [countDate]).forEach((r) => { counts[r.item_id] = r.qty; });
    const columns = [
      { key: 'no', label: t(lang, 'no_'), type: 'int' },
      { key: 'code', label: t(lang, 'itemCode'), type: 'text' },
      { key: 'item', label: t(lang, 'itemName'), type: 'text', wide: true },
      { key: 'unit', label: t(lang, 'unit'), type: 'text' },
      { key: 'prev', label: t(lang, 'prevBalance'), type: 'qty' },
      { key: 'pur', label: t(lang, 'purchasesCol'), type: 'qty' },
      { key: 'iss', label: t(lang, 'issuedCol'), type: 'qty' },
      { key: 'pret', label: t(lang, 'purchaseReturnsCol'), type: 'qty' },
      { key: 'iret', label: t(lang, 'returnsCol'), type: 'qty' },
      { key: 'bal', label: t(lang, 'balance'), type: 'qty' },
      { key: 'phys', label: t(lang, 'physical'), type: 'qty', input: true },
      { key: 'short', label: t(lang, 'shortage'), type: 'qty' },
      { key: 'shortV', label: t(lang, 'shortageValue'), type: 'money' },
    ];
    const rows = []; let n = 0; let totalShortV = 0;
    for (const [, g] of groupedItems(L.items, p.groupId)) {
      rows.push({ kind: 'section', label: g.name });
      for (const it of g.items) {
        const a = acc[it.id] || { purchase: 0, issue: 0, purchase_return: 0, issue_return: 0 };
        const c = L.closing[it.id];
        const phys = counts[it.id];
        const short = phys === undefined || phys === null ? null : c.qty - phys;
        const shortV = short === null ? null : short * c.unitCost;
        totalShortV += shortV || 0;
        rows.push({ kind: 'data', item_id: it.id, unitCost: c.unitCost, c: {
          no: ++n, code: it.code, item: it.name, unit: it.unit, prev: L.opening[it.id].qty,
          pur: a.purchase, iss: a.issue, pret: a.purchase_return, iret: a.issue_return, bal: c.qty,
          phys: phys === undefined ? null : phys, short, shortV,
        } });
      }
    }
    rows.push({ kind: 'total', label: t(lang, 'grandTotal'), c: { shortV: totalShortV } });
    const gname = p.groupId ? (store.get('SELECT code||\' - \'||name AS n FROM item_groups WHERE id=?', [p.groupId]) || {}).n : t(lang, 'allGroups');
    return { title: t(lang, 'rptCount') + ' — ' + gname, subtitle: subtitleRange(lang, p.from, p.to), columns, rows, landscape: true, countDate, hint: t(lang, 'physicalHint') };
  },

  // d) Item card
  card(store, p, lang) {
    const it = store.get('SELECT * FROM items WHERE id=?', [p.itemId]);
    if (!it) return { title: t(lang, 'rptCard'), subtitle: t(lang, 'chooseItem'), columns: [], rows: [] };
    const moves = [];
    const L = runLedger(store, { from: p.from, to: p.to, itemIds: [it.id], onMove(m, v, after) { if (m.item_id === it.id) moves.push({ m, v, after }); } });
    const o = L.opening[it.id];
    const columns = [
      { key: 'date', label: t(lang, 'date'), type: 'date' },
      { key: 'kind', label: t(lang, 'docType'), type: 'text' },
      { key: 'ref', label: t(lang, 'refNo'), type: 'text' },
      { key: 'party', label: t(lang, 'party'), type: 'text', wide: true },
      { key: 'inQ', label: t(lang, 'in'), type: 'qty' },
      { key: 'outQ', label: t(lang, 'out'), type: 'qty' },
      { key: 'price', label: t(lang, 'price'), type: 'money' },
      { key: 'bal', label: t(lang, 'runningBalance'), type: 'qty' },
      { key: 'uc', label: t(lang, 'avgCost'), type: 'money' },
      { key: 'bv', label: t(lang, 'value'), type: 'money' },
    ];
    const rows = [{ kind: 'subtotal', label: t(lang, 'openingRow'), c: { bal: o.qty, uc: o.unitCost, bv: o.value } }];
    const data = [];
    for (const { m, after } of moves) {
      const s = SIGN[m.type];
      data.push({ kind: 'data', c: {
        date: m.date, kind: t(lang, m.type), ref: m.ref_no, party: m.party_name,
        inQ: s > 0 ? m.qty : null, outQ: s < 0 ? m.qty : null, price: m.price,
        bal: after.qty, uc: after.unitCost, bv: after.value,
      } });
    }
    rows.push(...data);
    const tot = sumKeys(data, ['inQ', 'outQ']);
    const c = L.closing[it.id];
    rows.push({ kind: 'total', label: t(lang, 'total'), c: { ...tot, bal: c.qty, uc: c.unitCost, bv: c.value } });
    return { title: `${t(lang, 'rptCard')}: ${it.code} - ${it.name} (${it.unit || ''})`, subtitle: subtitleRange(lang, p.from, p.to), columns, rows, landscape: true };
  },

  // e) Purchases by supplier
  purchases(store, p, lang) {
    const where = ["d.type IN ('purchase','purchase_return')"]; const args = [];
    if (p.from) { where.push('d.date>=?'); args.push(p.from); }
    if (p.to) { where.push('d.date<=?'); args.push(p.to); }
    if (p.supplierId) { where.push('d.party_id=?'); args.push(p.supplierId); }
    const lines = store.all(`SELECT d.date, d.ref_no, d.type, s.id AS sid, s.name AS supplier, i.code, i.name AS item, i.unit, l.qty, l.price
      FROM doc_lines l JOIN docs d ON d.id=l.doc_id JOIN items i ON i.id=l.item_id LEFT JOIN suppliers s ON s.id=d.party_id
      WHERE ${where.join(' AND ')} ORDER BY CAST(s.code AS INTEGER), s.name, d.date, d.id, l.line_no`, args);
    const columns = [
      { key: 'date', label: t(lang, 'date'), type: 'date' },
      { key: 'ref', label: t(lang, 'invoiceNo'), type: 'text' },
      { key: 'kind', label: t(lang, 'docType'), type: 'text' },
      { key: 'code', label: t(lang, 'itemCode'), type: 'text' },
      { key: 'item', label: t(lang, 'itemName'), type: 'text', wide: true },
      { key: 'unit', label: t(lang, 'unit'), type: 'text' },
      { key: 'qty', label: t(lang, 'qty'), type: 'qty' },
      { key: 'price', label: t(lang, 'price'), type: 'money' },
      { key: 'value', label: t(lang, 'value'), type: 'money' },
    ];
    const by = new Map();
    lines.forEach((l) => { if (!by.has(l.sid)) by.set(l.sid, { name: l.supplier, lines: [] }); by.get(l.sid).lines.push(l); });
    const rows = []; let grand = 0;
    for (const [, s] of by) {
      rows.push({ kind: 'section', label: s.name });
      const data = s.lines.map((l) => { const k = l.type === 'purchase_return' ? -1 : 1; return { kind: 'data', c: { date: l.date, ref: l.ref_no, kind: t(lang, l.type), code: l.code, item: l.item, unit: l.unit, qty: k * l.qty, price: l.price, value: k * l.qty * l.price } }; });
      rows.push(...data);
      const sub = sumKeys(data, ['value']); grand += sub.value;
      rows.push({ kind: 'subtotal', label: t(lang, 'supplierTotal', s.name), c: sub });
    }
    rows.push({ kind: 'total', label: t(lang, 'grandTotal'), c: { value: grand } });
    const sname = p.supplierId ? (store.get('SELECT name FROM suppliers WHERE id=?', [p.supplierId]) || {}).name : t(lang, 'allSuppliers');
    return { title: t(lang, 'rptPurchases') + ' — ' + sname, subtitle: subtitleRange(lang, p.from, p.to), columns, rows, landscape: true };
  },

  // f) Current stock & value
  stock(store, p, lang) {
    const L = runLedger(store, { to: p.to });
    const columns = [
      { key: 'code', label: t(lang, 'itemCode'), type: 'text' },
      { key: 'item', label: t(lang, 'itemName'), type: 'text', wide: true },
      { key: 'cat', label: t(lang, 'cat'), type: 'text' },
      { key: 'unit', label: t(lang, 'unit'), type: 'text' },
      { key: 'qty', label: t(lang, 'balance'), type: 'qty' },
      { key: 'uc', label: t(lang, 'avgCost'), type: 'money' },
      { key: 'value', label: t(lang, 'value'), type: 'money' },
      { key: 'min', label: t(lang, 'minQty'), type: 'qty' },
      { key: 'status', label: t(lang, 'status'), type: 'text' },
    ];
    const rows = []; const all = [];
    for (const [, g] of groupedItems(L.items, p.groupId)) {
      rows.push({ kind: 'section', label: g.name });
      const data = g.items.map((it) => {
        const c = L.closing[it.id]; const low = Number(it.min_qty) > 0 && c.qty < Number(it.min_qty);
        return { kind: 'data', warn: low, c: { code: it.code, item: it.name, cat: it.cat, unit: it.unit, qty: c.qty, uc: c.unitCost, value: c.value, min: it.min_qty || null, status: low ? t(lang, 'low') : t(lang, 'ok') } };
      });
      rows.push(...data); all.push(...data);
      rows.push({ kind: 'subtotal', label: t(lang, 'groupTotal', g.name), c: sumKeys(data, ['value']) });
    }
    rows.push({ kind: 'total', label: t(lang, 'stockTotal'), c: sumKeys(all, ['value']) });
    return { title: t(lang, 'rptStock'), subtitle: subtitleRange(lang, null, p.to || todayISO()), columns, rows };
  },

  // Low stock list
  low(store, p, lang) {
    const L = runLedger(store, {});
    const columns = [
      { key: 'code', label: t(lang, 'itemCode'), type: 'text' },
      { key: 'item', label: t(lang, 'itemName'), type: 'text', wide: true },
      { key: 'group', label: t(lang, 'group'), type: 'text' },
      { key: 'unit', label: t(lang, 'unit'), type: 'text' },
      { key: 'qty', label: t(lang, 'balance'), type: 'qty' },
      { key: 'min', label: t(lang, 'minQty'), type: 'qty' },
      { key: 'need', label: t(lang, 'needed'), type: 'qty' },
    ];
    const rows = lowStock(store, L).map((x) => ({ kind: 'data', warn: true, c: { code: x.code, item: x.name, group: x.group_name, unit: x.unit, qty: x.qty, min: x.min_qty, need: x.min_qty - x.qty } }));
    return { title: t(lang, 'rptLow'), subtitle: subtitleRange(lang, null, todayISO()), columns, rows };
  },
};

function lowStock(store, L) {
  L = L || runLedger(store, {});
  return L.items.filter((it) => Number(it.min_qty) > 0 && L.closing[it.id].qty < Number(it.min_qty))
    .map((it) => ({ ...it, qty: L.closing[it.id].qty }));
}

function buildReport(store, name, params, lang) {
  const b = builders[name];
  if (!b) throw new Error('unknown report');
  const r = b(store, params || {}, lang);
  r.name = name; r.lang = lang;
  return r;
}

function dashboard(store) {
  const L = runLedger(store, {});
  const now = new Date();
  const { from, to } = monthRange(now.getFullYear(), now.getMonth() + 1);
  const sumType = (types) => {
    const r = store.get(`SELECT COALESCE(SUM(l.qty*l.price),0) AS v, COUNT(DISTINCT d.id) AS n FROM doc_lines l JOIN docs d ON d.id=l.doc_id
      WHERE d.date BETWEEN ? AND ? AND d.type IN (${types.map(() => '?').join(',')})`, [from, to, ...types]);
    return r;
  };
  const pin = sumType(['purchase']); const pret = sumType(['purchase_return']);
  const iout = sumType(['issue']); const iret = sumType(['issue_return']);
  let stockValue = 0;
  for (const id in L.closing) stockValue += L.closing[id].value;
  return {
    stockValue, itemsCount: L.items.length,
    monthIn: pin.v - pret.v, monthInDocs: pin.n, monthOut: iout.v - iret.v, monthOutDocs: iout.n,
    low: lowStock(store, L),
    recent: store.listDocs({ limit: 8 }),
    docCount: store.get('SELECT COUNT(*) AS n FROM docs').n,
    month: { from, to },
  };
}

module.exports = { runLedger, balances, buildReport, dashboard };
