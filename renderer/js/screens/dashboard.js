App.screens.dashboard = {
  icon: 'home',
  async render(main) {
    const d = await call('dashboard');
    const logo = App.settings.logo ? `<img src="${App.settings.logo}">` : '';
    main.innerHTML = `
      <div class="hero">${logo}<div><div class="hn">${esc(appName())}</div><div class="hd">${fmtDate(todayISO())} · ${I18N.T[App.lang].months[new Date().getMonth()]}</div></div>
        <span class="spacer"></span><div class="hstat"><div class="l">${t('itemsCount')}</div><div class="v">${d.itemsCount}</div></div></div>
      <div class="quick">
        <button class="btn btn-success" data-go="purchases">${ic('in')}${t('newPurchase')}</button>
        <button class="btn btn-primary" data-go="issues">${ic('out')}${t('newIssue')}</button>
        <button class="btn btn-light" data-go="reports">${ic('chart')}${t('reports')}</button>
        <button class="btn btn-light" data-go="items">${ic('package')}${t('items')}</button>
      </div>
      <div class="tiles">
        <div class="tile"><div class="chip">${ic('wallet')}</div><div><div class="lbl">${t('stockValue')}</div><div class="val">${fmtMoney(d.stockValue)}</div><div class="sub">${t('asOf')} ${fmtDate(todayISO())}</div></div></div>
        <div class="tile green"><div class="chip">${ic('in')}</div><div><div class="lbl">${t('monthIn')}</div><div class="val">${fmtMoney(d.monthIn)}</div><div class="sub">${I18N.T[App.lang].months[new Date().getMonth()]} ${new Date().getFullYear()}</div></div></div>
        <div class="tile amber"><div class="chip">${ic('out')}</div><div><div class="lbl">${t('monthOut')}</div><div class="val">${fmtMoney(d.monthOut)}</div><div class="sub">${I18N.T[App.lang].months[new Date().getMonth()]} ${new Date().getFullYear()}</div></div></div>
        <div class="tile red"><div class="chip">${ic('alert')}</div><div><div class="lbl">${t('lowStock')}</div><div class="val">${d.low.length}</div><div class="sub">&nbsp;</div></div></div>
      </div>
      ${d.docCount === 0 ? `<div class="card empty-state">${ic('flask')}<p>${t('emptyDb')}</p><button class="btn btn-primary btn-big" id="sampleBtn">${ic('flask')}${t('loadSample')}</button></div>` : ''}
      <div class="cols2">
        <div class="card"><h2>${ic('alert')}${t('lowStock')}</h2>
          ${d.low.length ? `<div class="tbl-wrap" style="max-height:360px"><table class="grid"><thead><tr><th>${t('itemCode')}</th><th>${t('itemName')}</th><th>${t('balance')}</th><th>${t('minQty')}</th></tr></thead><tbody>
          ${d.low.map((x) => `<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td class="n low-qty">${fmtQty(x.qty)} ${esc(x.unit || '')}</td><td class="n">${fmtQty(x.min_qty)}</td></tr>`).join('')}
          </tbody></table></div>` : `<div class="empty-state">${ic('clipboard')}${t('none')}</div>`}
        </div>
        <div class="card"><h2>${ic('clock')}${t('recentDocs')}</h2>
          ${d.recent.length ? `<div class="tbl-wrap" style="max-height:360px"><table class="grid"><thead><tr><th>${t('docNo')}</th><th>${t('date')}</th><th>${t('docType')}</th><th>${t('party')}</th><th>${t('total')}</th></tr></thead><tbody>
          ${d.recent.map((x) => `<tr data-doc="${x.id}" style="cursor:pointer"><td>${x.id}</td><td>${fmtDate(x.date)}</td><td><span class="badge ${x.type}">${t(x.type)}</span></td><td>${esc(x.party_name || '')}</td><td class="n">${fmtMoney(x.total)}</td></tr>`).join('')}
          </tbody></table></div>` : `<div class="empty-state">${ic('clock')}${t('none')}</div>`}
        </div>
      </div>`;
    $$('[data-go]', main).forEach((b) => { b.onclick = () => go(b.dataset.go); });
    $$('[data-doc]', main).forEach((tr) => { tr.ondblclick = tr.onclick = () => openDoc(Number(tr.dataset.doc)); });
    const sb = $('#sampleBtn', main);
    if (sb) sb.onclick = async () => { await call('data.sample'); await loadLists(true); toast(t('sampleLoaded')); go('dashboard'); };
  },
};
