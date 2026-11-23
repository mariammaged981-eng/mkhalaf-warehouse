App.screens.opening = {
  icon: 'calculator',
  async render(main) {
    await loadLists(true);
    const items = App.cache.items;
    main.innerHTML = `<h1>${ic('calculator')}${t('openingBalances')} <span class="spacer"></span>
      <input class="search" id="oq" placeholder="${t('search')}">
      <button class="btn btn-light" id="oadd">${ic('plus')}${t('newItem')}</button>
      <button class="btn btn-success btn-big" id="osave">${ic('save')}${t('save')}</button></h1>
      <p class="hint">${t('openingHint')} — ${t('enterHint')}</p>
      <div class="tbl-wrap"><table class="grid"><thead><tr><th>${t('itemCode')}</th><th>${t('itemName')}</th><th>${t('group')}</th><th>${t('unit')}</th>
      <th style="width:150px">${t('openingQty')}</th><th style="width:150px">${t('openingPrice')}</th><th>${t('openingValue')}</th></tr></thead>
      <tbody id="obody">${items.map((it) => `<tr data-id="${it.id}" data-s="${esc(it.code + ' ' + it.name + ' ' + (it.group_name || ''))}">
        <td>${esc(it.code)}</td><td>${esc(it.name)}</td><td>${esc(it.group_name || '')}</td><td>${esc(it.unit || '')}</td>
        <td><input class="num oq" value="${it.opening_qty || ''}"></td><td><input class="num op" value="${it.opening_price || ''}"></td>
        <td class="n ov">${fmtMoney((it.opening_qty || 0) * (it.opening_price || 0))}</td></tr>`).join('')}
      </tbody><tfoot><tr><th colspan="6">${t('total')}</th><th class="n" id="otot"></th></tr></tfoot></table></div>`;
    const body = $('#obody');
    let dirty = false;
    const total = () => {
      let s = 0;
      $$('tr', body).forEach((tr) => { const v = num($('.oq', tr).value) * num($('.op', tr).value); $('.ov', tr).textContent = fmtMoney(v); s += v; });
      $('#otot').textContent = fmtMoney(s);
    };
    total();
    body.addEventListener('input', () => { dirty = true; total(); });
    enterNav(body);
    $('#oq').oninput = () => { const q = $('#oq').value; $$('tr', body).forEach((tr) => tr.classList.toggle('hidden', !matches(tr.dataset.s, q))); };
    $('#oadd').onclick = async () => { if (await editMaster('items')) { if (!dirty || await confirmBox(t('save') + '?')) { if (dirty) await save(); go('opening'); } } };
    const save = async () => {
      const rows = $$('tr', body).map((tr) => ({ id: Number(tr.dataset.id), opening_qty: num($('.oq', tr).value), opening_price: num($('.op', tr).value) }));
      const r = await call('opening.save', rows);
      dirty = false;
      if (r && r.warning) toast(t('negativeStock', r.warning.item, fmtQty(r.warning.balance), fmtDate(r.warning.date)), 'error');
      else toast(t('saved'));
      await loadLists(true);
    };
    $('#osave').onclick = save;
    this.onKey = (e) => { if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    const first = $('.oq', body); if (first) first.focus();
  },
};
