// Export a report structure to .xlsx (RTL sheet when Arabic).
const ExcelJS = require('exceljs');
const { t, fmtDate, todayISO } = require('../shared/i18n');

async function exportReport(report, settings, file) {
  const lang = report.lang;
  const wb = new ExcelJS.Workbook();
  wb.creator = settings.app_name_en || 'Warehouse';
  const ws = wb.addWorksheet((report.name || 'Report').slice(0, 30), {
    views: [{ rightToLeft: lang === 'ar', state: 'frozen', ySplit: 0 }],
    pageSetup: { paperSize: 9, orientation: report.landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cols = report.columns;
  const n = cols.length;
  const font = { name: 'Arial', size: 11 };
  const appName = lang === 'ar' ? settings.app_name_ar : settings.app_name_en;

  const titleRow = (text, size, bold = true) => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, n);
    r.getCell(1).font = { ...font, size, bold };
    r.getCell(1).alignment = { horizontal: 'center' };
  };
  titleRow(appName, 16);
  titleRow(report.title, 13);
  if (report.subtitle) titleRow(report.subtitle, 11, false);
  titleRow(`${t(lang, 'printDate')}: ${fmtDate(todayISO())}`, 10, false);
  ws.addRow([]);

  const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE7F3' } };
  const hasGroups = cols.some((c) => c.group);
  let headerStart;
  if (hasGroups) {
    const r1 = ws.addRow(cols.map((c) => c.group || c.label));
    const r2 = ws.addRow(cols.map((c) => (c.group ? c.label : '')));
    headerStart = r1.number;
    let i = 0;
    while (i < n) {
      const c = cols[i];
      if (!c.group) { ws.mergeCells(r1.number, i + 1, r2.number, i + 1); i++; continue; }
      let j = i; while (j + 1 < n && cols[j + 1].group === c.group) j++;
      if (j > i) ws.mergeCells(r1.number, i + 1, r1.number, j + 1);
      i = j + 1;
    }
    [r1, r2].forEach((r) => styleHeader(r));
  } else {
    const r = ws.addRow(cols.map((c) => c.label));
    headerStart = r.number;
    styleHeader(r);
  }
  function styleHeader(r) {
    for (let i = 1; i <= n; i++) {
      const c = r.getCell(i);
      c.font = { ...font, bold: true }; c.fill = headFill; c.border = border;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
  }
  ws.views[0].ySplit = ws.lastRow.number;

  const firstNum = cols.findIndex((c) => !['text', 'date'].includes(c.type));
  for (const row of report.rows) {
    if (row.kind === 'section') {
      const r = ws.addRow([row.label]);
      ws.mergeCells(r.number, 1, r.number, n);
      r.getCell(1).font = { ...font, bold: true, color: { argb: 'FF1F4E79' } };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      r.getCell(1).border = border;
      continue;
    }
    const vals = cols.map((c) => {
      const v = row.c ? row.c[c.key] : null;
      if (v === null || v === undefined || v === '') return null;
      if (c.type === 'date') return fmtDate(v);
      if (['qty', 'money', 'int'].includes(c.type)) return Math.round(Number(v) * 1000) / 1000;
      return v;
    });
    if (row.label) vals[0] = row.label;
    const r = ws.addRow(vals);
    if (row.label && firstNum > 1) ws.mergeCells(r.number, 1, r.number, firstNum);
    cols.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      cell.font = { ...font, bold: row.kind !== 'data' };
      cell.border = border;
      if (c.type === 'money') cell.numFmt = '#,##0.00';
      if (c.type === 'qty') cell.numFmt = '#,##0.###';
      if (row.kind === 'subtotal') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      if (row.kind === 'total') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
      if (row.warn) cell.font = { ...cell.font, color: { argb: 'FFC00000' } };
    });
  }
  cols.forEach((c, i) => {
    let w = String(c.label).length + 2;
    if (c.wide) w = Math.max(w, 28);
    else if (c.type === 'money') w = Math.max(w, 14);
    else if (c.type === 'qty') w = Math.max(w, 10);
    else if (c.type === 'date') w = 12;
    else w = Math.max(w, 12);
    ws.getColumn(i + 1).width = w;
  });
  ws.pageSetup.printTitlesRow = `${headerStart}:${ws.views[0].ySplit}`;
  await wb.xlsx.writeFile(file);
}

module.exports = { exportReport };
