/* Items, groups, clients, suppliers: list + search + add/edit/delete */
function masterFields(table) {
  if (table === 'items') {
    return [
      { key: 'code', label: t('itemCode') },
      { key: 'name', label: t('itemName'), required: true },
      { key: 'cat', label: t('cat') },
      { key: 'group_id', label: t('group'), type: 'select', numeric: true, options: [{ value: '', label: '—' }, ...App.cache.item_groups.map((g) => ({ value: g.id, label: `${g.code} - ${g.name}` }))] },
      { key: 'unit', label: t('unit') },
      { key: 'min_qty', label: t('minQty'), type: 'number' },
      { key: 'notes', label: t('notes'), full: true },
    ];
  }
  if (table === 'item_groups') return [{ key: 'code', label: t('groupCode') }, { key: 'name', label: t('groupName'), required: true }];
  return [{ key: 'code', label: t('code') }, { key: 'name', label: t('name'), required: true }, { key: 'phone', label: t('phone') }, { key: 'notes', label: t('notes') }];
}
const MASTER_NEW = { items: 'newItem', item_groups: 'newGroup', clients: 'newClient', suppliers: 'newSupplier' };

// Opens the add/edit form. Returns the saved record (with id) or null.
async function editMaster(table, rec) {
  await loadLists();
  const fields = masterFields(table);
  rec = { ...(rec || {}) };
  if (!rec.id && !rec.code) rec.code = await call('master.nextCode', { table });
  if (table === 'items' && !rec.id && rec.unit === undefined) rec.unit = 'قطعة';
  const saved = await modal({
    title: rec.id ? `${t('edit')}: ${rec.name}` : t(MASTER_NEW[table]),
    body: formHtml(fields, rec),
    onOpen: (root) => enterNav($('.modal-body', root), () => $('.modal-actions .btn-primary', root).click()),
    buttons: [
      { label: t('cancel'), value: null },
      { label: t('save'), cls: 'btn-primary', action: async (root) => {
        const data = readForm(root, fields);
        if (!data.name) { toast(t('required'), 'error'); $('[name="name"]', root).focus(); return false; }
        try {
          const id = await call('master.save', { table, rec: { ...data, id: rec.id } });
          return { ...rec, ...data, id };
        } catch (e) { return false; }
      } },
    ],
  });
  if (saved) { await loadLists(true); toast(t('saved')); return App.cache[table].find((x) => x.id === saved.id) || saved; }
  return null;
}

function masterScreen(table, titleKey, icon) {
  return {
    icon,
    titleKey,
    async render(main) {
      await loadLists(true);
      const isItems = table === 'items';
      main.innerHTML = `<h1>${icon} ${t(titleKey)} <span class="spacer"></span>
        <input class="search" placeholder="${t('search')}" id="mq">
        <button class="btn btn-primary btn-big" id="madd">＋ ${t(MASTER_NEW[table])}</button></h1>
        <div class="tbl-wrap"><table class="grid"><thead><tr>
        ${isItems ? `<th>${t('itemCode')}</th><th>${t('itemName')}</th><th>${t('cat')}</th><th>${t('group')}</th><th>${t('unit')}</th><th>${t('minQty')}</th><th>${t('balance')}</th>`
    : table === 'item_groups' ? `<th>${t('groupCode')}</th><th>${t('groupName')}</th>` : `<th>${t('code')}</th><th>${t('name')}</th><th>${t('phone')}</th><th>${t('notes')}</th>`}
        <th></th></tr></thead><tbody id="mbody"></tbody></table></div>`;
      const bal = isItems ? await call('stock.balances') : {};
      const draw = () => {
        const q = $('#mq').value;
        const rows = App.cache[table].filter((r) => matches(`${r.code} ${r.name} ${r.cat || ''} ${r.group_name || ''}`, q));
        $('#mbody').innerHTML = rows.map((r) => `<tr data-id="${r.id}">
          ${isItems ? `<td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.cat || '')}</td><td>${esc(r.group_name || '')}</td><td>${esc(r.unit || '')}</td><td class="n">${fmtQty(r.min_qty || '')}</td>
             <td class="n" style="${bal[r.id] && r.min_qty > 0 && bal[r.id].qty < r.min_qty ? 'color:var(--red);font-weight:700' : ''}">${fmtQty(bal[r.id] ? bal[r.id].qty : 0)}</td>`
    : table === 'item_groups' ? `<td>${esc(r.code)}</td><td>${esc(r.name)}</td>` : `<td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.phone || '')}</td><td>${esc(r.notes || '')}</td>`}
          <td class="acts">${isItems ? `<button class="btn btn-light btn-sm" data-a="card">📄 ${t('rptCard')}</button> ` : ''}<button class="btn btn-light btn-sm" data-a="edit">✏️ ${t('edit')}</button> <button class="btn btn-light btn-sm" data-a="del">🗑️ ${t('del')}</button></td></tr>`).join('')
          || `<tr><td colspan="9" class="muted" style="text-align:center;padding:20px">${t('none')}</td></tr>`;
      };
      draw();
      $('#mq').oninput = draw;
      $('#mq').focus();
      $('#madd').onclick = async () => { if (await editMaster(table)) draw(); };
      $('#mbody').onclick = async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const id = Number(b.closest('tr').dataset.id);
        const rec = App.cache[table].find((x) => x.id === id);
        if (b.dataset.a === 'edit') { if (await editMaster(table, rec)) draw(); }
        if (b.dataset.a === 'card') go('reports', { report: 'card', itemId: id });
        if (b.dataset.a === 'del' && await confirmBox(`${t('confirmDelete')}\n${rec.name}`, { danger: true })) {
          try { await call('master.delete', { table, id }); await loadLists(true); toast(t('deleted')); draw(); } catch (err) { /* shown */ }
        }
      };
      $('#mbody').ondblclick = async (e) => {
        const tr = e.target.closest('tr[data-id]'); if (!tr) return;
        const rec = App.cache[table].find((x) => x.id === Number(tr.dataset.id));
        if (await editMaster(table, rec)) draw();
      };
    },
  };
}
App.screens.items = masterScreen('items', 'items', '📦');
App.screens.groups = masterScreen('item_groups', 'groups', '🗂️');
App.screens.clients = masterScreen('clients', 'clients', '🏗️');
App.screens.suppliers = masterScreen('suppliers', 'suppliers', '🚚');
