/* Core helpers shared by all screens */
const { fmtMoney, fmtQty, fmtDate, parseDate, todayISO, monthRange, matches } = window.I18N;

const App = {
  settings: {},
  lang: 'ar',
  cache: {},
  screens: {},
  current: null,
};

function t(key, ...args) { return I18N.t(App.lang, key, ...args); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function errText(res) {
  const key = res.error || '';
  if (key === 'negativeStock' && res.info) return t('negativeStock', res.info.item, fmtQty(res.info.balance), fmtDate(res.info.date));
  if (key.startsWith('required:')) return t('required');
  const tr = t(key);
  return tr !== key ? tr : key;
}

async function call(method, args, { silent } = {}) {
  const res = await window.api.call(method, args);
  if (!res.ok) {
    if (!silent) toast(errText(res), 'error');
    const e = new Error(res.error); e.res = res; e.shown = !silent; throw e;
  }
  return res.data;
}

function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), kind === 'error' ? 4500 : 2200);
  setTimeout(() => el.remove(), kind === 'error' ? 5000 : 2700);
}

// ---------- modal dialogs ----------
function modal({ title, body, buttons = [], wide, onOpen }) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'modal-back';
    root.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><h2>${esc(title)}</h2><div class="modal-body"></div><div class="modal-actions"></div></div>`;
    const bodyEl = $('.modal-body', root);
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const close = (v) => { root.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || 'btn-light');
      btn.textContent = b.label;
      btn.onclick = async () => {
        if (b.action) { const r = await b.action(root); if (r === false) return; close(r === undefined ? b.value : r); } else close(b.value);
      };
      $('.modal-actions', root).appendChild(btn);
    });
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(null); } }
    document.addEventListener('keydown', onKey, true);
    $('#modalRoot').appendChild(root);
    if (onOpen) onOpen(root, close);
    const first = $('input,select,textarea', bodyEl) || $('.modal-actions .btn-primary', root);
    if (first) setTimeout(() => first.focus(), 30);
  });
}
function confirmBox(msg, { danger } = {}) {
  return modal({ title: msg, buttons: [
    { label: t('no'), value: false },
    { label: t('yes'), value: true, cls: danger ? 'btn-danger' : 'btn-primary' },
  ] });
}
function alertBox(msg) { return modal({ title: t('errorTitle'), body: `<p class="alert-msg">${esc(msg)}</p>`, buttons: [{ label: t('close'), value: true, cls: 'btn-primary' }] }); }

// ---------- form helpers ----------
// Build a simple form; fields: [{key,label,type:'text'|'number'|'select'|'textarea', options:[{value,label}], required}]
function formHtml(fields, rec = {}) {
  return `<div class="form-grid">${fields.map((f) => {
    const v = rec[f.key] === null || rec[f.key] === undefined ? '' : rec[f.key];
    let input;
    if (f.type === 'select') {
      input = `<select name="${f.key}">${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea name="${f.key}" rows="2">${esc(v)}</textarea>`;
    } else {
      input = `<input name="${f.key}" type="text" ${f.type === 'number' ? 'inputmode="decimal" class="num"' : ''} value="${esc(v)}" autocomplete="off">`;
    }
    return `<label class="${f.full ? 'full' : ''}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}</label>`;
  }).join('')}</div>`;
}
function readForm(root, fields) {
  const o = {};
  for (const f of fields) {
    const el = root.querySelector(`[name="${f.key}"]`);
    let v = el.value.trim();
    if (f.type === 'number') v = v === '' ? 0 : num(v);
    if (f.type === 'select' && f.numeric) v = v === '' ? null : Number(v);
    o[f.key] = v;
  }
  return o;
}
// Enter moves to the next field inside a container
function enterNav(root, onLast) {
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.defaultPrevented) return;
    const fields = $$('input:not([disabled]):not([readonly]),select', root).filter((el) => el.offsetParent !== null);
    const i = fields.indexOf(e.target);
    if (i < 0) return;
    e.preventDefault();
    if (i + 1 < fields.length) { fields[i + 1].focus(); fields[i + 1].select && fields[i + 1].select(); } else if (onLast) onLast();
  });
}

function num(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/٫/g, '.').replace(/[,،\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Date input that shows dd/mm/yyyy
function dateInput(name, iso, attrs = '') {
  return `<input type="text" class="date-input" name="${name}" value="${esc(fmtDate(iso))}" placeholder="dd/mm/yyyy" autocomplete="off" ${attrs}>`;
}
function readDate(el) {
  const v = parseDate(el.value);
  el.classList.toggle('invalid', !v && el.value.trim() !== '');
  if (v) el.value = fmtDate(v);
  return v;
}
document.addEventListener('focusout', (e) => { if (e.target.classList && e.target.classList.contains('date-input')) readDate(e.target); });

// ---------- master data cache ----------
async function loadLists(force) {
  if (force || !App.cache.items) {
    const [items, groups, clients, suppliers] = await Promise.all([
      call('master.list', { table: 'items' }), call('master.list', { table: 'item_groups' }),
      call('master.list', { table: 'clients' }), call('master.list', { table: 'suppliers' }),
    ]);
    Object.assign(App.cache, { items, item_groups: groups, clients, suppliers });
  }
  return App.cache;
}

// month/year + from/to filter block
function periodFilterHtml(from, to) {
  const now = new Date();
  const y = now.getFullYear();
  const years = []; for (let i = y - 5; i <= y + 1; i++) years.push(i);
  return `<div class="period">
    <label><span>${t('month')}</span><select class="pf-month"><option value="">—</option>${I18N.T[App.lang].months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></label>
    <label><span>${t('year')}</span><select class="pf-year">${years.map((v) => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label><span>${t('from')}</span>${dateInput('pf-from', from)}</label>
    <label><span>${t('to')}</span>${dateInput('pf-to', to)}</label>
  </div>`;
}
function bindPeriod(root, onChange) {
  const m = $('.pf-month', root); const y = $('.pf-year', root);
  const set = () => {
    if (!m.value) return;
    const r = monthRange(Number(y.value), Number(m.value));
    $('[name="pf-from"]', root).value = fmtDate(r.from);
    $('[name="pf-to"]', root).value = fmtDate(r.to);
    onChange && onChange();
  };
  m.onchange = set; y.onchange = set;
  $$('.date-input', root).forEach((el) => el.addEventListener('change', () => { m.value = ''; onChange && onChange(); }));
}
function readPeriod(root) {
  return { from: readDate($('[name="pf-from"]', root)), to: readDate($('[name="pf-to"]', root)) };
}
function currentMonth() { const n = new Date(); return monthRange(n.getFullYear(), n.getMonth() + 1); }

function appName() { return App.lang === 'en' ? (App.settings.app_name_en || t('appNameDefault')) : (App.settings.app_name_ar || t('appNameDefault')); }
