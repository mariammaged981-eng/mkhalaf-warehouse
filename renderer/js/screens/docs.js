/* Incoming (purchases / purchase returns) and outgoing (issues / returns to warehouse) document editor + list */

async function openDoc(id) {
  const d = await call('docs.get', id);
  if (d) go(d.type.startsWith('purchase') ? 'purchases' : 'issues', { id });
}

function docEditor(kind) { // kind: 'purchases' | 'issues'
  const types = kind === 'purchases' ? ['purchase', 'purchase_return'] : ['issue', 'issue_return'];
  const partyTable = kind === 'purchases' ? 'suppliers' : 'clients';
  return {
    icon: kind === 'purchases' ? '⬇️' : '⬆️',
    titleKey: kind,
    dirty: false,
    canLeave() { return !this.dirty || confirmBox(App.lang === 'ar' ? 'توجد بيانات لم تُحفظ. الخروج بدون حفظ؟' : 'You have unsaved changes. Leave without saving?', { danger: true }); },
    async render(main, params = {}) {
      await loadLists(true);
      const self = this;
      self.dirty = false;
      let doc = params.id ? await call('docs.get', params.id) : { type: params.type || types[0], date: params.date || todayISO(), lines: [] };
      const editing = !!doc.id;
      let bal = await call('stock.balances', { excludeDocId: doc.id || 0 });
      const isIssueKind = kind === 'issues';
      const showAvail = () => doc.type === 'issue' || doc.type === 'purchase_return';

      main.innerHTML = `
        <h1>${this.icon} <span id="dtitle"></span>
          <div class="type-switch">${types.map((ty) => `<button data-type="${ty}">${t(ty)}</button>`).join('')}</div>
          <span class="spacer"></span>
          <button class="btn btn-light" id="dlist">📋 ${t('transactions')}</button>
          <button class="btn btn-light" id="dnew">＋ ${t('newDoc')}</button></h1>
        <div class="card" id="dform">
          <div class="doc-head">
            <label class="field"><span>${t('date')}</span>${dateInput('date', doc.date)}</label>
            <label class="field party"><span>${isIssueKind ? t('client') : t('supplier')}</span>
              <div class="with-add"><input id="dparty" placeholder="${t('search')}"><button class="btn btn-light" id="dpadd" tabindex="-1" title="${t('addNew')}">＋</button></div></label>
            <label class="field ref"><span>${isIssueKind ? t('requestNo') : t('invoiceNo')}</span><input id="dref" value="${esc(doc.ref_no || '')}"></label>
            <label class="field" style="flex:1"><span>${t('notes')}</span><input id="dnotes" value="${esc(doc.notes || '')}"></label>
          </div>
          <table class="lines"><thead><tr><th style="width:40px">#</th><th class="c-item">${t('item')}</th>
            ${isIssueKind ? `<th>${t('cat')}</th>` : ''}<th>${t('unit')}</th><th class="c-avail">${t('available')}</th>
            <th class="c-num">${t('qty')}</th><th class="c-num">${isIssueKind ? t('cost') : t('price')}</th><th class="c-num">${t('value')}</th><th style="width:44px"></th></tr></thead>
            <tbody id="dlines"></tbody></table>
          <div class="doc-foot">
            <div><button class="btn btn-light" id="daddline" tabindex="-1">${t('addLine')}</button> <span class="hint">${t('enterHint')}</span></div>
            <div class="doc-total">${t('docTotal')}: <span id="dtotal">0.00</span></div>
          </div>
          <div class="doc-foot">
            <div class="btn-row">
              ${editing ? `<button class="btn btn-danger" id="ddel">🗑️ ${t('del')}</button>` : ''}
            </div>
            <div class="btn-row">
              <button class="btn btn-light btn-big" id="dsaveprint">🖨️ ${t('saveAndPrint')}</button>
              <button class="btn btn-success btn-big" id="dsave">💾 ${t('saveDoc')}</button>
            </div>
          </div>
        </div>`;

      const form = $('#dform');
      const tbody = $('#dlines');
      const lines = [];

      const setType = (ty) => {
        doc.type = ty;
        $$('.type-switch button', main).forEach((b) => b.classList.toggle('on', b.dataset.type === ty));
        $('#dtitle').textContent = editing ? `${t('editDoc')} ${t('docNo')} ${doc.id}` : t(kind);
        $$('.c-avail', main).forEach((el) => el.classList.toggle('hidden', !showAvail()));
        lines.forEach((l) => refreshLine(l));
      };
      $$('.type-switch button', main).forEach((b) => { b.onclick = () => { setType(b.dataset.type); self.dirty = true; }; });

      // party picker
      const partyCombo = new Combo($('#dparty'), {
        source: () => App.cache[partyTable], code: (x) => x.code, name: (x) => x.name,
        onSelect: () => { self.dirty = true; },
        onAddNew: (text) => editMaster(partyTable, { name: text }),
      });
      if (doc.party_id) partyCombo.set(App.cache[partyTable].find((x) => x.id === doc.party_id));
      $('#dpadd').onclick = async () => { const x = await editMaster(partyTable, {}); if (x) partyCombo.set(x); };

      const suggestPrice = (item) => {
        const b = bal[item.id] || {};
        return doc.type.startsWith('purchase') ? (b.lastPP || item.opening_price || 0) : (b.unitCost || b.lastPP || 0);
      };
      const usedQty = (itemId, except) => lines.filter((l) => l !== except && l.item && l.item.id === itemId).reduce((s, l) => s + num(l.qtyEl.value), 0);

      function refreshLine(l) {
        const it = l.item;
        if (l.catEl) l.catEl.textContent = it ? (it.cat || '') : '';
        l.unitEl.textContent = it ? (it.unit || '') : '';
        const avail = it ? (bal[it.id] ? bal[it.id].qty : 0) - usedQty(it.id, l) : null;
        l.availEl.classList.toggle('hidden', !showAvail());
        l.availEl.textContent = it ? fmtQty(avail) : '';
        const over = it && showAvail() && num(l.qtyEl.value) > avail + 1e-9;
        l.availEl.classList.toggle('over', !!over);
        l.qtyEl.parentElement.classList.toggle('over', !!over);
        l.valEl.textContent = it || num(l.qtyEl.value) ? fmtMoney(num(l.qtyEl.value) * num(l.priceEl.value)) : '';
        l.over = over; l.avail = avail;
      }
      function recalc() {
        let s = 0;
        lines.forEach((l, i) => { l.noEl.textContent = i + 1; refreshLine(l); s += num(l.qtyEl.value) * num(l.priceEl.value); });
        $('#dtotal').textContent = fmtMoney(s);
      }

      function addLine(data, focus) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="ro no"></td><td><input class="li-item" placeholder="${t('search')}"></td>
          ${isIssueKind ? '<td class="ro li-cat"></td>' : ''}<td class="ro li-unit"></td><td class="ro n li-avail c-avail"></td>
          <td><input class="num li-qty"></td><td><input class="num li-price"></td><td class="ro n li-val"></td>
          <td><button class="btn btn-light btn-sm li-del" tabindex="-1" title="${t('removeLine')}">✕</button></td>`;
        tbody.appendChild(tr);
        const l = {
          tr, item: null, noEl: $('.no', tr), catEl: $('.li-cat', tr), unitEl: $('.li-unit', tr), availEl: $('.li-avail', tr),
          qtyEl: $('.li-qty', tr), priceEl: $('.li-price', tr), valEl: $('.li-val', tr),
        };
        l.combo = new Combo($('.li-item', tr), {
          source: () => App.cache.items, code: (x) => x.code, name: (x) => x.name, sub: (x) => `${x.cat || ''} ${bal[x.id] ? fmtQty(bal[x.id].qty) + ' ' + (x.unit || '') : ''}`,
          onSelect: (x) => {
            const changed = !l.item || l.item.id !== x.id;
            l.item = x;
            if (changed || !l.priceEl.value) l.priceEl.value = I18N.r2(suggestPrice(x)) || '';
            self.dirty = true; recalc();
          },
          onAddNew: async (text) => { const x = await editMaster('items', { name: text }); if (x) bal = await call('stock.balances', { excludeDocId: doc.id || 0 }); return x; },
        });
        if (data) {
          const it = App.cache.items.find((x) => x.id === data.item_id);
          l.combo.set(it); l.item = it; l.qtyEl.value = data.qty; l.priceEl.value = data.price;
        }
        $('.li-del', tr).onclick = () => { removeLine(l); };
        lines.push(l);
        recalc();
        if (focus) l.combo.input.focus();
        return l;
      }
      function removeLine(l) {
        l.combo.destroy(); l.tr.remove(); lines.splice(lines.indexOf(l), 1);
        if (!lines.length) addLine(null, true);
        self.dirty = true; recalc();
      }
      tbody.addEventListener('input', () => { self.dirty = true; recalc(); });
      ['#dref', '#dnotes'].forEach((s) => $(s).addEventListener('input', () => { self.dirty = true; }));
      $('[name="date"]', form).addEventListener('input', () => { self.dirty = true; });

      enterNav(form, () => addLine(null, true));
      $('#daddline').onclick = () => addLine(null, true);

      doc.lines.forEach((l) => addLine(l));
      addLine(null);
      setType(doc.type);

      async function save(print) {
        const date = readDate($('[name="date"]', form));
        if (!date) { toast(t('invalidDate'), 'error'); $('[name="date"]', form).focus(); return; }
        if (!partyCombo.value) { toast(t(isIssueKind ? 'choosePartyClient' : 'choosePartySupplier'), 'error'); $('#dparty').focus(); return; }
        const valid = lines.filter((l) => l.item && num(l.qtyEl.value) > 0);
        if (!valid.length) { toast(t('noLines'), 'error'); return; }
        recalc();
        const over = valid.find((l) => l.over);
        if (over) {
          await alertBox(t('overIssue', fmtQty(num(over.qtyEl.value)), over.item.name, fmtQty(Math.max(0, over.avail))));
          over.qtyEl.focus(); return;
        }
        const payload = {
          id: doc.id, type: doc.type, date, party_id: partyCombo.value.id, ref_no: $('#dref').value.trim(), notes: $('#dnotes').value.trim(),
          lines: valid.map((l) => ({ item_id: l.item.id, qty: num(l.qtyEl.value), price: num(l.priceEl.value) })),
        };
        let id;
        try { id = await call('docs.save', payload, { silent: true }); } catch (e) { await alertBox(errText(e.res)); return; }
        self.dirty = false;
        toast(t('saved'));
        if (print) await printVoucher(id);
        if (editing) go('transactions');
        else go(kind, { type: doc.type, date });
      }
      $('#dsave').onclick = () => save(false);
      $('#dsaveprint').onclick = () => save(true);
      $('#dnew').onclick = () => go(kind, { type: doc.type });
      $('#dlist').onclick = () => go('transactions', { kind });
      if ($('#ddel')) $('#ddel').onclick = async () => {
        if (!await confirmBox(t('confirmDelete'), { danger: true })) return;
        try { await call('docs.delete', doc.id, { silent: true }); } catch (e) { await alertBox(errText(e.res)); return; }
        self.dirty = false; toast(t('deleted')); go('transactions');
      };
      this.onKey = (e) => { if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(false); } if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); save(true); } };
      this.leave = () => { partyCombo.destroy(); lines.forEach((l) => l.combo.destroy()); };
      if (editing) lines[0].combo.input.focus(); else $('#dparty').focus();
    },
  };
}
App.screens.purchases = docEditor('purchases');
App.screens.issues = docEditor('issues');

App.screens.transactions = {
  icon: '📋',
  async render(main, params = {}) {
    const m = currentMonth();
    const st = this.state || (this.state = { from: m.from, to: m.to, type: '', q: '' });
    if (params.kind) st.type = params.kind;
    main.innerHTML = `<h1>📋 ${t('transactions')}</h1>
      <div class="card filters">
        <label><span>${t('docType')}</span><select id="tt">
          <option value="">${t('filterType')}</option>
          <option value="purchases">${t('purchases')}</option><option value="issues">${t('issues')}</option>
          ${['purchase', 'purchase_return', 'issue', 'issue_return'].map((x) => `<option value="${x}">${t(x)}</option>`).join('')}</select></label>
        ${periodFilterHtml(st.from, st.to)}
        <label><span>${t('search')}</span><input id="tq" class="search" value="${esc(st.q)}"></label>
      </div>
      <div class="tbl-wrap"><table class="grid"><thead><tr><th>${t('docNo')}</th><th>${t('date')}</th><th>${t('docType')}</th><th>${t('party')}</th>
        <th>${t('refNo')}</th><th>${t('lines')}</th><th>${t('total')}</th><th></th></tr></thead><tbody id="tbody"></tbody></table></div>`;
    $('#tt').value = st.type;
    let rows = [];
    const load = async () => {
      Object.assign(st, readPeriod(main), { type: $('#tt').value });
      const types = st.type === 'purchases' ? ['purchase', 'purchase_return'] : st.type === 'issues' ? ['issue', 'issue_return'] : st.type ? [st.type] : [];
      rows = await call('docs.list', { from: st.from, to: st.to, types });
      draw();
    };
    const draw = () => {
      st.q = $('#tq').value;
      const list = rows.filter((r) => matches(`${r.id} ${r.party_name || ''} ${r.ref_no || ''} ${t(r.type)} ${r.notes || ''}`, st.q));
      $('#tbody').innerHTML = list.map((r) => `<tr data-id="${r.id}"><td>${r.id}</td><td>${fmtDate(r.date)}</td><td><span class="badge ${r.type}">${t(r.type)}</span></td>
        <td>${esc(r.party_name || '')}</td><td>${esc(r.ref_no || '')}</td><td>${r.line_count}</td><td class="n">${fmtMoney(r.total)}</td>
        <td class="acts"><button class="btn btn-light btn-sm" data-a="edit">✏️ ${t('edit')}</button>
        <button class="btn btn-light btn-sm" data-a="print">🖨️ ${t('print')}</button>
        <button class="btn btn-light btn-sm" data-a="pdf">PDF</button>
        <button class="btn btn-light btn-sm" data-a="del">🗑️</button></td></tr>`).join('')
        || `<tr><td colspan="8" class="muted" style="text-align:center;padding:20px">${t('none')}</td></tr>`;
    };
    bindPeriod(main, load);
    $('#tt').onchange = load;
    $('#tq').oninput = draw;
    $('#tbody').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const id = Number(b.closest('tr').dataset.id);
      if (b.dataset.a === 'edit') openDoc(id);
      if (b.dataset.a === 'print') printVoucher(id);
      if (b.dataset.a === 'pdf') printVoucher(id, 'pdf');
      if (b.dataset.a === 'del') {
        if (!await confirmBox(`${t('confirmDelete')} (${t('docNo')} ${id})`, { danger: true })) return;
        try { await call('docs.delete', id, { silent: true }); toast(t('deleted')); load(); } catch (err) { alertBox(errText(err.res)); }
      }
    };
    $('#tbody').ondblclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openDoc(Number(tr.dataset.id)); };
    load();
  },
};
