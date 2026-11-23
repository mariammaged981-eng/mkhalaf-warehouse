App.screens.dashboard = {
  icon: '🏠',
  async render(main) {
    const d = await call('dashboard');
    const logo = App.settings.logo ? `<img src="${App.settings.logo}">` : '';
    main.innerHTML = `
      <div class="card welcome">${logo}<div class="bn">${esc(appName())}</div><div class="muted">${fmtDate(todayISO())}</div></div>
      <div class="quick">
        <button class="btn btn-success" data-go="purchases">⬇️ ${t('newPurchase')}</button>
        <button class="btn btn-primary" data-go="issues">⬆️ ${t('newIssue')}</button>
        <button class="btn btn-light" data-go="reports">📊 ${t('reports')}</button>
        <button class="btn btn-light" data-go="items">📦 ${t('items')}</button>
      </div>
      <div class="tiles">
        <div class="tile"><div class="lbl">${t('stockValue')}</div><div class="val">${fmtMoney(d.stockValue)}</div><div class="sub">${t('itemsCount')}: ${d.itemsCount}</div></div>
        <div class="tile green"><div class="lbl">${t('monthIn')}</div><div class="val">${fmtMoney(d.monthIn)}</div><div class="sub">${I18N.T[App.lang].months[new Date().getMonth()]} ${new Date().getFullYear()}</div></div>
        <div class="tile amber"><div class="lbl">${t('monthOut')}</div><div class="val">${fmtMoney(d.monthOut)}</div><div class="sub">${I18N.T[App.lang].months[new Date().getMonth()]} ${new Date().getFullYear()}</div></div>
        <div class="tile red"><div class="lbl">${t('lowStock')}</div><div class="val">${d.low.length}</div><div class="sub">&nbsp;</div></div>
      </div>
      ${d.docCount === 0 ? `<div class="card welcome"><p>${t('emptyDb')}</p><button class="btn btn-primary btn-big" id="sampleBtn">${t('loadSample')}</button></div>` : ''}
      <div class="cols2">
        <div class="card"><h2>⚠️ ${t('lowStock')}</h2>
          ${d.low.length ? `<div class="tbl-wrap" style="max-height:360px"><table class="grid"><thead><tr><th>${t('itemCode')}</th><th>${t('itemName')}</th><th>${t('balance')}</th><th>${t('minQty')}</th></tr></thead><tbody>
          ${d.low.map((x) => `<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td class="n" style="color:var(--red);font-weight:700">${fmtQty(x.qty)} ${esc(x.unit || '')}</td><td class="n">${fmtQty(x.min_qty)}</td></tr>`).join('')}
          </tbody></table></div>` : `<p class="muted">${t('none')}</p>`}
        </div>
        <div class="card"><h2>🕘 ${t('recentDocs')}</h2>
          ${d.recent.length ? `<table class="grid"><thead><tr><th>${t('docNo')}</th><th>${t('date')}</th><th>${t('docType')}</th><th>${t('party')}</th><th>${t('total')}</th></tr></thead><tbody>
          ${d.recent.map((x) => `<tr data-doc="${x.id}" style="cursor:pointer"><td>${x.id}</td><td>${fmtDate(x.date)}</td><td><span class="badge ${x.type}">${t(x.type)}</span></td><td>${esc(x.party_name || '')}</td><td class="n">${fmtMoney(x.total)}</td></tr>`).join('')}
          </tbody></table>` : `<p class="muted">${t('none')}</p>`}
        </div>
      </div>`;
    $$('[data-go]', main).forEach((b) => { b.onclick = () => go(b.dataset.go); });
    $$('[data-doc]', main).forEach((tr) => { tr.ondblclick = tr.onclick = () => openDoc(Number(tr.dataset.doc)); });
    const sb = $('#sampleBtn', main);
    if (sb) sb.onclick = async () => { await call('data.sample'); await loadLists(true); toast(t('sampleLoaded')); go('dashboard'); };
  },
};
