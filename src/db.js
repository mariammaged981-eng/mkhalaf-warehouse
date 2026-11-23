// SQLite storage (sql.js / WebAssembly — no native modules, works offline on any Windows PC).
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS item_groups (id INTEGER PRIMARY KEY, code TEXT, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, code TEXT, name TEXT NOT NULL, cat TEXT, group_id INTEGER,
  unit TEXT, min_qty REAL DEFAULT 0, opening_qty REAL DEFAULT 0, opening_price REAL DEFAULT 0, notes TEXT);
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, code TEXT, name TEXT NOT NULL, phone TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY, code TEXT, name TEXT NOT NULL, phone TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS docs (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL, date TEXT NOT NULL, party_id INTEGER, ref_no TEXT, notes TEXT,
  created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS doc_lines (
  id INTEGER PRIMARY KEY, doc_id INTEGER NOT NULL, line_no INTEGER, item_id INTEGER NOT NULL,
  qty REAL NOT NULL, price REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS physical_counts (item_id INTEGER NOT NULL, count_date TEXT NOT NULL, qty REAL,
  PRIMARY KEY (item_id, count_date));
CREATE INDEX IF NOT EXISTS ix_docs_date ON docs(date);
CREATE INDEX IF NOT EXISTS ix_lines_doc ON doc_lines(doc_id);
CREATE INDEX IF NOT EXISTS ix_lines_item ON doc_lines(item_id);
`;

const DEFAULT_GROUPS = [
  ['1', 'عتل'], ['2', 'فديه + عتل + بورة'], ['3', 'خرطوم + شاكوش'], ['4', 'حجارة'],
  ['5', 'فلاتر'], ['6', 'اخرى'], ['7', 'اكسسوار'], ['8', 'معدات قطع غيار'],
];
const DEFAULT_CLIENTS = ['الجنوب', 'اخضر بغدادى', 'احمر حسن', 'اخضر سمير', 'حلايب', 'جندولا', 'المصنع'];
const DEFAULT_SUPPLIERS = ['عادل فاروق', 'صابر وايهاب'];
const DEFAULT_SETTINGS = {
  app_name_ar: 'مخزن م. خلف', app_name_en: 'M. Khalaf Warehouse', lang: 'ar', cost_method: 'avg',
  logo: '', password_hash: '',
};

class Store {
  async open(file) {
    this.file = file;
    const dist = path.dirname(require.resolve('sql.js'));
    this.SQL = await initSqlJs({ locateFile: (f) => path.join(dist, f) });
    this.load();
  }

  load() {
    const data = fs.existsSync(this.file) ? fs.readFileSync(this.file) : null;
    if (this.db) this.db.close();
    this.db = data ? new this.SQL.Database(data) : new this.SQL.Database();
    this.migrate();
  }

  migrate() {
    this.db.exec(SCHEMA);
    const fresh = !this.get("SELECT value FROM settings WHERE key='initialized'");
    if (fresh) {
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) this.run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', [k, v]);
      this.seedLists();
      this.run("INSERT INTO settings(key,value) VALUES('initialized','1')");
      this.save();
    }
  }

  seedLists() {
    DEFAULT_GROUPS.forEach(([c, n]) => this.run('INSERT INTO item_groups(code,name) VALUES(?,?)', [c, n]));
    DEFAULT_CLIENTS.forEach((n, i) => this.run('INSERT INTO clients(code,name) VALUES(?,?)', [String(i + 1), n]));
    DEFAULT_SUPPLIERS.forEach((n, i) => this.run('INSERT INTO suppliers(code,name) VALUES(?,?)', [String(i + 1), n]));
  }

  // ---------- low level ----------
  all(sql, params = []) {
    const st = this.db.prepare(sql);
    try {
      st.bind(params);
      const out = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally { st.free(); }
  }
  get(sql, params = []) { return this.all(sql, params)[0]; }
  run(sql, params = []) {
    this.db.run(sql, params);
    return this.get('SELECT last_insert_rowid() AS id').id;
  }
  tx(fn) {
    this.db.exec('BEGIN');
    try {
      const r = fn();
      this.db.exec('COMMIT');
      this.save();
      return r;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  save() {
    const data = Buffer.from(this.db.export());
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, this.file);
  }
  exportBuffer() { return Buffer.from(this.db.export()); }

  // ---------- settings ----------
  settings() {
    const o = {};
    this.all('SELECT key,value FROM settings').forEach((r) => { o[r.key] = r.value; });
    return o;
  }
  setSettings(obj) {
    this.tx(() => {
      for (const [k, v] of Object.entries(obj)) this.run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', [k, v == null ? '' : String(v)]);
    });
  }

  // ---------- master data ----------
  list(table) {
    if (table === 'items') {
      return this.all(`SELECT i.*, g.name AS group_name, g.code AS group_code FROM items i
        LEFT JOIN item_groups g ON g.id=i.group_id ORDER BY CAST(i.code AS INTEGER), i.code, i.name`);
    }
    return this.all(`SELECT * FROM ${table} ORDER BY CAST(code AS INTEGER), code, name`);
  }
  saveMaster(table, rec) {
    const cols = {
      items: ['code', 'name', 'cat', 'group_id', 'unit', 'min_qty', 'opening_qty', 'opening_price', 'notes'],
      item_groups: ['code', 'name'],
      clients: ['code', 'name', 'phone', 'notes'],
      suppliers: ['code', 'name', 'phone', 'notes'],
    }[table];
    if (!cols) throw new Error('bad table');
    if (!rec.name || !String(rec.name).trim()) throw new Error('required:name');
    rec.name = String(rec.name).trim();
    if (rec.code !== undefined && rec.code !== null) rec.code = String(rec.code).trim();
    if (!rec.code) rec.code = this.nextCode(table);
    const dup = this.get(`SELECT id FROM ${table} WHERE code=? AND id<>?`, [rec.code, rec.id || 0]);
    if (dup) throw new Error('codeExists');
    return this.tx(() => {
      if (rec.id) {
        const use = cols.filter((c) => rec[c] !== undefined);
        this.run(`UPDATE ${table} SET ${use.map((c) => c + '=?').join(',')} WHERE id=?`, [...use.map((c) => rec[c]), rec.id]);
        return rec.id;
      }
      const use = cols.filter((c) => rec[c] !== undefined);
      return this.run(`INSERT INTO ${table}(${use.join(',')}) VALUES(${use.map(() => '?').join(',')})`, use.map((c) => rec[c]));
    });
  }
  nextCode(table) {
    const r = this.get(`SELECT MAX(CAST(code AS INTEGER)) AS m FROM ${table}`);
    return String((r && r.m ? r.m : 0) + 1);
  }
  deleteMaster(table, id) {
    let used = false;
    if (table === 'items') used = !!this.get('SELECT 1 FROM doc_lines WHERE item_id=? LIMIT 1', [id]);
    if (table === 'item_groups') used = !!this.get('SELECT 1 FROM items WHERE group_id=? LIMIT 1', [id]);
    if (table === 'clients') used = !!this.get("SELECT 1 FROM docs WHERE party_id=? AND type IN ('issue','issue_return') LIMIT 1", [id]);
    if (table === 'suppliers') used = !!this.get("SELECT 1 FROM docs WHERE party_id=? AND type IN ('purchase','purchase_return') LIMIT 1", [id]);
    if (used) throw new Error('inUse');
    this.tx(() => {
      this.run(`DELETE FROM ${table} WHERE id=?`, [id]);
      if (table === 'items') this.run('DELETE FROM physical_counts WHERE item_id=?', [id]);
    });
  }
  saveOpening(rows) {
    this.tx(() => rows.forEach((r) => this.run('UPDATE items SET opening_qty=?, opening_price=? WHERE id=?', [Number(r.opening_qty) || 0, Number(r.opening_price) || 0, r.id])));
    const bad = this.findNegative(rows.map((r) => r.id));
    return { warning: bad };
  }

  // ---------- documents ----------
  listDocs(f = {}) {
    const where = []; const p = [];
    if (f.types && f.types.length) { where.push(`d.type IN (${f.types.map(() => '?').join(',')})`); p.push(...f.types); }
    if (f.from) { where.push('d.date>=?'); p.push(f.from); }
    if (f.to) { where.push('d.date<=?'); p.push(f.to); }
    const rows = this.all(`SELECT d.*,
        CASE WHEN d.type IN ('purchase','purchase_return') THEN s.name ELSE c.name END AS party_name,
        (SELECT COUNT(*) FROM doc_lines l WHERE l.doc_id=d.id) AS line_count,
        (SELECT SUM(qty*price) FROM doc_lines l WHERE l.doc_id=d.id) AS total
      FROM docs d LEFT JOIN suppliers s ON s.id=d.party_id LEFT JOIN clients c ON c.id=d.party_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.date DESC, d.id DESC ${f.limit ? 'LIMIT ' + Number(f.limit) : ''}`, p);
    return rows;
  }
  getDoc(id) {
    const d = this.get(`SELECT d.*, CASE WHEN d.type IN ('purchase','purchase_return') THEN s.name ELSE c.name END AS party_name
      FROM docs d LEFT JOIN suppliers s ON s.id=d.party_id LEFT JOIN clients c ON c.id=d.party_id WHERE d.id=?`, [id]);
    if (!d) return null;
    d.lines = this.all(`SELECT l.*, i.code AS item_code, i.name AS item_name, i.unit, i.cat FROM doc_lines l
      JOIN items i ON i.id=l.item_id WHERE l.doc_id=? ORDER BY l.line_no, l.id`, [id]);
    return d;
  }
  saveDoc(doc) {
    const lines = (doc.lines || []).filter((l) => l.item_id && Number(l.qty) > 0);
    if (!lines.length) throw new Error('noLines');
    if (!doc.date) throw new Error('invalidDate');
    if (!doc.party_id) throw new Error(doc.type.startsWith('purchase') ? 'choosePartySupplier' : 'choosePartyClient');
    const now = new Date().toISOString();
    let id = doc.id;
    const affected = new Set(lines.map((l) => l.item_id));
    this.db.exec('BEGIN');
    try {
      if (id) {
        this.all('SELECT item_id FROM doc_lines WHERE doc_id=?', [id]).forEach((r) => affected.add(r.item_id));
        this.run('UPDATE docs SET type=?, date=?, party_id=?, ref_no=?, notes=?, updated_at=? WHERE id=?',
          [doc.type, doc.date, doc.party_id, doc.ref_no || '', doc.notes || '', now, id]);
        this.run('DELETE FROM doc_lines WHERE doc_id=?', [id]);
      } else {
        id = this.run('INSERT INTO docs(type,date,party_id,ref_no,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
          [doc.type, doc.date, doc.party_id, doc.ref_no || '', doc.notes || '', now, now]);
      }
      lines.forEach((l, i) => this.run('INSERT INTO doc_lines(doc_id,line_no,item_id,qty,price) VALUES(?,?,?,?,?)',
        [id, i + 1, l.item_id, Number(l.qty), Number(l.price) || 0]));
      const bad = this.findNegative([...affected]);
      if (bad) { const e = new Error('negativeStock'); e.info = bad; throw e; }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    this.save();
    return id;
  }
  deleteDoc(id) {
    const affected = this.all('SELECT item_id FROM doc_lines WHERE doc_id=?', [id]).map((r) => r.item_id);
    this.db.exec('BEGIN');
    try {
      this.run('DELETE FROM doc_lines WHERE doc_id=?', [id]);
      this.run('DELETE FROM docs WHERE id=?', [id]);
      const bad = this.findNegative(affected);
      if (bad) { const e = new Error('negativeStock'); e.info = bad; throw e; }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    this.save();
  }

  // All stock movements in chronological order
  movements({ itemIds, to } = {}) {
    const where = []; const p = [];
    if (itemIds) { where.push(`l.item_id IN (${itemIds.map(() => '?').join(',') || 'NULL'})`); p.push(...itemIds); }
    if (to) { where.push('d.date<=?'); p.push(to); }
    return this.all(`SELECT l.item_id, l.qty, l.price, d.id AS doc_id, d.type, d.date, d.ref_no, d.party_id,
        CASE WHEN d.type IN ('purchase','purchase_return') THEN s.name ELSE c.name END AS party_name
      FROM doc_lines l JOIN docs d ON d.id=l.doc_id
      LEFT JOIN suppliers s ON s.id=d.party_id LEFT JOIN clients c ON c.id=d.party_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY d.date, CASE d.type WHEN 'purchase' THEN 0 WHEN 'issue_return' THEN 1 WHEN 'purchase_return' THEN 2 ELSE 3 END, d.id, l.id`, p);
  }

  // Returns the first point where an item's running balance would go negative.
  findNegative(itemIds) {
    if (!itemIds.length) return null;
    const items = this.all(`SELECT id,name,opening_qty FROM items WHERE id IN (${itemIds.map(() => '?').join(',')})`, itemIds);
    const bal = {}; const names = {};
    items.forEach((i) => { bal[i.id] = Number(i.opening_qty) || 0; names[i.id] = i.name; });
    for (const m of this.movements({ itemIds })) {
      bal[m.item_id] += SIGN[m.type] * m.qty;
      if (bal[m.item_id] < -1e-9) return { item: names[m.item_id], balance: bal[m.item_id], date: m.date };
    }
    return null;
  }

  savePhysicalCount(item_id, count_date, qty) {
    this.tx(() => {
      if (qty === null || qty === '' || qty === undefined) this.run('DELETE FROM physical_counts WHERE item_id=? AND count_date=?', [item_id, count_date]);
      else this.run('INSERT OR REPLACE INTO physical_counts(item_id,count_date,qty) VALUES(?,?,?)', [item_id, count_date, Number(qty)]);
    });
  }

  clearAll(keepLists = true) {
    this.tx(() => {
      ['doc_lines', 'docs', 'physical_counts', 'items'].forEach((t) => this.run(`DELETE FROM ${t}`));
      if (!keepLists) {
        ['item_groups', 'clients', 'suppliers'].forEach((t) => this.run(`DELETE FROM ${t}`));
        this.seedLists();
      }
    });
  }
}

const SIGN = { purchase: 1, purchase_return: -1, issue: -1, issue_return: 1 };

module.exports = { Store, SIGN };
