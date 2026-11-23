/* Reports: choose, filter, view, print, export Excel / PDF (Arabic or English) */
const REPORTS = [
  { key: 'summary', label: 'rptSummary', icon: '📊', filters: ['period', 'group'] },
  { key: 'client', label: 'rptClient', icon: '🏗️', filters: ['period', 'client', 'mode'] },
  { key: 'count', label: 'rptCount', icon: '📝', filters: ['period', 'group'] },
  { key: 'card', label: 'rptCard', icon: '📄', filters: ['item', 'period'] },
  { key: 'purchases', label: 'rptPurchases', icon: '🚚', filters: ['period', 'supplier'] },
  { key: 'stock', label: 'rptStock', icon: '📦', filters: ['asof', 'group'] },
  { key: 'low', label: 'rptLow', icon: '⚠️', filters: [] },
];

function withLang(lang, fn) { const old = App.lang; App.lang = lang; try { return fn(); } finally { App.lang = old; } }

App.screens.reports = {
  icon: '📊',
  async render(main, params = {}) {
    await loadLists(true);
    const m = currentMonth();
    const st = this.state || (this.state = { report: 'summary', from: m.from, to: m.to, asof: todayISO(), lang: App.lang, mode: 'detail' });
    if (params.report) st.report = params.report;
    if (params.itemId) st.itemId = params.itemId;
    let rep = null;
    let itemCombo = null;

    const drawPage = () => {
      const def = REPORTS.find((r) => r.key === st.report);
      if (itemCombo) { itemCombo.destroy(); itemCombo = null; }
      const f = def.filters;
      main.innerHTML = `<h1>📊 ${t('reports')}</h1>
        <div class="rpt-pick">${REPORTS.map((r) => `<button data-r="${r.key}" class="${r.key === st.report ? 'on' : ''}">${r.icon} ${t(r.label)}</button>`).join('')}</div>
        <div class="card filters" id="rf">
          ${f.includes('item') ? `<label style="width:360px"><span>${t('item')}</span><input id="ritem" placeholder="${t('chooseItem')}"></label>` : ''}
          ${f.includes('period') ? periodFilterHtml(st.from, st.to) : ''}
          ${f.includes('asof') ? `<label><span>${t('asOf')}</span>${dateInput('asof', st.asof)}</label>` : ''}
          ${f.includes('group') ? `<label><span>${t('group')}</span><select id="rgroup"><option value="">${t('allGroups')}</option>${App.cache.item_groups.map((g) => `<option value="${g.id}">${esc(g.code + ' - ' + g.name)}</option>`).join('')}</select></label>` : ''}
          ${f.includes('client') ? `<label><span>${t('client')}</span><select id="rclient"><option value="">${t('allClients')}</option>${App.cache.clients.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label>` : ''}
          ${f.includes('mode') ? `<label><span>${t('show')}</span><select id="rmode"><option value="detail">${App.lang === 'ar' ? 'تفصيلي (كل حركة)' : 'Detailed (every line)'}</option><option value="items">${App.lang === 'ar' ? 'مجمع بالصنف' : 'Totals per item'}</option></select></label>` : ''}
          ${f.includes('supplier') ? `<label><span>${t('supplier')}</span><select id="rsupplier"><option value="">${t('allSuppliers')}</option>${App.cache.suppliers.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label>` : ''}
          <label><span>${t('language')}</span><select id="rlang"><option value="ar">عربي</option><option value="en">English</option></select></label>
          <div class="btn-row">
            <button class="btn btn-primary btn-big" id="rshow">🔎 ${t('show')}</button>
            <button class="btn btn-light btn-big" id="rprint">🖨️ ${t('print')}</button>
            <button class="btn btn-light btn-big" id="rxlsx">📗 ${t('exportExcel')}</button>
            <button class="btn btn-light btn-big" id="rpdf">📕 ${t('exportPdf')}</button>
          </div>
        </div>
        <div class="rpt-view" id="rview"></div>`;
      const sel = (id, v) => { const el = $(id); if (el && v !== undefined) el.value = v || ''; };
      sel('#rgroup', st.groupId); sel('#rclient', st.clientId); sel('#rsupplier', st.supplierId); sel('#rmode', st.mode); sel('#rlang', st.lang);
      if (f.includes('period')) bindPeriod(main, show);
      if (f.includes('item')) {
        itemCombo = new Combo($('#ritem'), { source: () => App.cache.items, code: (x) => x.code, name: (x) => x.name, sub: (x) => x.group_name, onSelect: (x) => { st.itemId = x.id; show(); } });
        if (st.itemId) itemCombo.set(App.cache.items.find((x) => x.id === st.itemId));
      }
      $$('.rpt-pick button', main).forEach((b) => { b.onclick = () => { st.report = b.dataset.r; rep = null; drawPage(); show(); }; });
      ['#rgroup', '#rclient', '#rsupplier', '#rmode', '#rlang'].forEach((id) => { const el = $(id); if (el) el.onchange = show; });
      const asof = $('[name="asof"]'); if (asof) asof.onchange = show;
      $('#rshow').onclick = show;
      $('#rprint').onclick = async () => { if (await ensure()) call('print.html', { html: withLang(st.lang, () => reportPrintHtml(rep)), landscape: rep.landscape }); };
      $('#rpdf').onclick = async () => { if (await ensure()) call('print.pdf', { html: withLang(st.lang, () => reportPrintHtml(rep)), landscape: rep.landscape, defaultName: st.report }); };
      $('#rxlsx').onclick = async () => { if (await ensure()) { const f2 = await call('export.excel', { report: rep, defaultName: st.report }); if (f2) toast(t('saved')); } };
    };

    const readFilters = () => {
      const g = (id) => { const el = $(id); return el ? (el.value ? Number(el.value) || el.value : null) : undefined; };
      if ($('[name="pf-from"]')) Object.assign(st, readPeriod(main));
      const a = $('[name="asof"]'); if (a) st.asof = readDate(a) || todayISO();
      if ($('#rgroup')) st.groupId = g('#rgroup');
      if ($('#rclient')) st.clientId = g('#rclient');
      if ($('#rsupplier')) st.supplierId = g('#rsupplier');
      if ($('#rmode')) st.mode = $('#rmode').value;
      st.lang = $('#rlang').value;
    };
    const ensure = async () => { if (!rep) await show(); return !!rep; };

    async function show() {
      readFilters();
      if (st.report === 'card' && !st.itemId) { $('#rview').innerHTML = `<p class="empty">${t('chooseItem')}</p>`; rep = null; return; }
      const p = { from: st.from, to: st.to, groupId: st.groupId, clientId: st.clientId, supplierId: st.supplierId, mode: st.mode, itemId: st.itemId };
      if (st.report === 'stock') { p.to = st.asof; p.from = null; }
      rep = await call('report', { name: st.report, params: p, lang: st.lang });
      const view = $('#rview');
      const scroll = view.scrollTop;
      view.setAttribute('dir', st.lang === 'ar' ? 'rtl' : 'ltr');
      view.innerHTML = withLang(st.lang, () => printHeaderHtml(rep.title, rep.subtitle) + (rep.hint ? `<p class="hint">${esc(rep.hint)}</p>` : '') + reportTableHtml(rep, { editable: true }));
      view.scrollTop = scroll;
      // physical count entry (stock count report)
      $$('.cell-input', view).forEach((inp, idx, all) => {
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); (all[idx + 1] || inp).focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (all[idx - 1] || inp).focus(); } });
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('change', async () => {
          const row = rep.rows[Number(inp.dataset.row)];
          const v = inp.value.trim() === '' ? null : num(inp.value);
          await call('counts.save', { item_id: row.item_id, date: rep.countDate, qty: v });
          row.c.phys = v;
          row.c.short = v === null ? null : row.c.bal - v;
          row.c.shortV = v === null ? null : row.c.short * row.unitCost;
          const tr = inp.closest('tr'); const cells = tr.children;
          const ci = rep.columns.findIndex((c) => c.key === 'short');
          cells[ci].textContent = fmtQty(row.c.short); cells[ci + 1].textContent = fmtMoney(row.c.shortV);
          cells[ci].classList.toggle('neg', row.c.short < 0);
          const tot = rep.rows[rep.rows.length - 1];
          tot.c.shortV = rep.rows.filter((r) => r.kind === 'data').reduce((s, r) => s + (r.c.shortV || 0), 0);
          const totTr = view.querySelector('tr.total:last-child');
          if (totTr) totTr.lastElementChild.textContent = fmtMoney(tot.c.shortV);
        });
      });
    }

    drawPage();
    show();
    this.leave = () => { if (itemCombo) itemCombo.destroy(); };
  },
};
