/* Report & voucher HTML — the same markup is used on screen, for printing and for PDF. */
function fmtCell(type, v) {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'money') return fmtMoney(v);
  if (type === 'qty') return fmtQty(v);
  if (type === 'date') return fmtDate(v);
  if (type === 'int') return String(v);
  return esc(v);
}

function reportTableHtml(rep, { editable } = {}) {
  const cols = rep.columns;
  if (!cols.length) return `<p class="empty">${esc(rep.subtitle || t('none'))}</p>`;
  const hasGroups = cols.some((c) => c.group);
  let head = '';
  if (hasGroups) {
    let r1 = ''; let r2 = ''; let i = 0;
    while (i < cols.length) {
      const c = cols[i];
      if (!c.group) { r1 += `<th rowspan="2" class="${c.wide ? 'wide' : ''}">${esc(c.label)}</th>`; i++; continue; }
      let j = i; while (j + 1 < cols.length && cols[j + 1].group === c.group) j++;
      r1 += `<th colspan="${j - i + 1}" class="grp">${esc(c.group)}</th>`;
      for (let k = i; k <= j; k++) r2 += `<th>${esc(cols[k].label)}</th>`;
      i = j + 1;
    }
    head = `<tr>${r1}</tr><tr>${r2}</tr>`;
  } else {
    head = `<tr>${cols.map((c) => `<th class="${c.wide ? 'wide' : ''}">${esc(c.label)}</th>`).join('')}</tr>`;
  }
  const firstNum = Math.max(1, cols.findIndex((c) => !['text', 'date'].includes(c.type)));
  const body = rep.rows.map((row, ri) => {
    if (row.kind === 'section') return `<tr class="section"><td colspan="${cols.length}">${esc(row.label)}</td></tr>`;
    let tds = '';
    let start = 0;
    if (row.label) { tds += `<td colspan="${firstNum}" class="lbl">${esc(row.label)}</td>`; start = firstNum; }
    for (let i = start; i < cols.length; i++) {
      const c = cols[i]; const v = row.c ? row.c[c.key] : null;
      const numCls = ['money', 'qty', 'int'].includes(c.type) ? 'n' : '';
      const neg = typeof v === 'number' && v < -1e-9 ? ' neg' : '';
      if (c.input && editable && row.kind === 'data') {
        tds += `<td class="n inp"><input class="cell-input num" data-row="${ri}" data-key="${c.key}" value="${v === null || v === undefined ? '' : v}"></td>`;
      } else tds += `<td class="${numCls}${neg} ${c.wide ? 'wide' : ''}">${fmtCell(c.type, v)}</td>`;
    }
    return `<tr class="${row.kind}${row.warn ? ' warn' : ''}">${tds}</tr>`;
  }).join('');
  return `<table class="rpt ${rep.small ? 'small' : ''}"><thead>${head}</thead><tbody>${body || `<tr><td colspan="${cols.length}" class="empty">${t('none')}</td></tr>`}</tbody></table>`;
}

function printHeaderHtml(title, subtitle) {
  const logo = App.settings.logo ? `<img class="ph-logo" src="${App.settings.logo}">` : '';
  return `<div class="ph">
    <div class="ph-side">${logo}</div>
    <div class="ph-center"><div class="ph-name">${esc(appName())}</div><div class="ph-title">${esc(title)}</div>
      ${subtitle ? `<div class="ph-sub">${esc(subtitle)}</div>` : ''}</div>
    <div class="ph-side ph-date">${t('printDate')}<br><b>${fmtDate(todayISO())}</b></div>
  </div>`;
}

function printDocument(inner, { landscape } = {}) {
  const dir = App.lang === 'ar' ? 'rtl' : 'ltr';
  return `<!DOCTYPE html><html lang="${App.lang}" dir="${dir}"><head><meta charset="UTF-8">
<link rel="stylesheet" href="fonts.css"><link rel="stylesheet" href="report.css">
<style>@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }</style></head>
<body class="print">${inner}</body></html>`;
}

function reportPrintHtml(rep) {
  return printDocument(printHeaderHtml(rep.title, rep.subtitle) + reportTableHtml(rep), { landscape: rep.landscape });
}

const VOUCHER_TITLE = { issue: 'voucherIssue', issue_return: 'voucherIssueReturn', purchase: 'voucherPurchase', purchase_return: 'voucherPurchaseReturn' };

function voucherHtml(doc) {
  const isIssue = doc.type.startsWith('issue');
  const rows = doc.lines.map((l, i) => `<tr><td class="n">${i + 1}</td><td>${esc(l.item_code)}</td><td class="wide">${esc(l.item_name)}</td>
    ${isIssue ? `<td>${esc(l.cat || '')}</td>` : ''}<td>${esc(l.unit || '')}</td><td class="n">${fmtQty(l.qty)}</td>
    <td class="n">${fmtMoney(l.price)}</td><td class="n">${fmtMoney(l.qty * l.price)}</td></tr>`).join('');
  const total = doc.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const one = (sigs) => `<div class="sigs">${sigs.map((s) => `<div>${esc(s)}<br><br>..........................</div>`).join('')}</div>`;
  const inner = `${printHeaderHtml(t(VOUCHER_TITLE[doc.type]) + ` ${t('voucherNo')} ${doc.id}`, '')}
  <table class="info"><tr>
    <td><b>${t('date')}:</b> ${fmtDate(doc.date)}</td>
    <td><b>${isIssue ? t('client') : t('supplier')}:</b> ${esc(doc.party_name || '')}</td>
    <td><b>${isIssue ? t('requestNo') : t('invoiceNo')}:</b> ${esc(doc.ref_no || '')}</td>
  </tr>${doc.notes ? `<tr><td colspan="3"><b>${t('notes')}:</b> ${esc(doc.notes)}</td></tr>` : ''}</table>
  <table class="rpt"><thead><tr><th>${t('no_')}</th><th>${t('itemCode')}</th><th class="wide">${t('itemName')}</th>${isIssue ? `<th>${t('cat')}</th>` : ''}
    <th>${t('unit')}</th><th>${t('qty')}</th><th>${isIssue ? t('cost') : t('price')}</th><th>${t('lineTotal')}</th></tr></thead>
    <tbody>${rows}<tr class="total"><td colspan="${isIssue ? 7 : 6}" class="lbl">${t('docTotal')}</td><td class="n">${fmtMoney(total)}</td></tr></tbody></table>
  ${one(isIssue ? [t('receiver'), t('storekeeper'), t('manager')] : [t('storekeeper'), t('manager')])}`;
  return printDocument(inner);
}

async function printVoucher(id, mode = 'print') {
  const doc = await call('docs.get', id);
  const html = voucherHtml(doc);
  if (mode === 'pdf') return call('print.pdf', { html, defaultName: `voucher_${doc.id}` });
  return call('print.html', { html });
}
