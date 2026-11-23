/* Shared translations + formatting helpers. Works in Node (main process) and the browser (renderer). */
(function (root) {
  const T = {
    ar: {
      appNameDefault: 'مخزن م. خلف',
      langToggle: 'English',
      // navigation
      dashboard: 'الرئيسية', purchases: 'الوارد (المشتريات)', issues: 'المنصرف (العملاء)',
      transactions: 'كل الحركات', items: 'الأصناف', groups: 'المجموعات', clients: 'المحاجر / العملاء',
      suppliers: 'الموردين', openingBalances: 'أرصدة أول المدة', reports: 'التقارير', settings: 'الإعدادات',
      logout: 'خروج', secWork: 'الحركات', secData: 'البيانات الأساسية', secOther: 'التقارير والإعدادات',
      // common
      add: 'إضافة', edit: 'تعديل', del: 'حذف', save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق', search: 'بحث...',
      yes: 'نعم', no: 'لا', confirmDelete: 'هل أنت متأكد من الحذف؟', saved: 'تم الحفظ', deleted: 'تم الحذف',
      print: 'طباعة', exportExcel: 'تصدير Excel', exportPdf: 'تصدير PDF', show: 'عرض', newDoc: 'جديد',
      actions: 'إجراءات', total: 'الإجمالي', grandTotal: 'الإجمالي العام', none: 'لا توجد بيانات',
      all: 'الكل', from: 'من', to: 'إلى', month: 'الشهر', year: 'السنة', date: 'التاريخ', notes: 'ملاحظات',
      no_: 'م', required: 'هذا الحقل مطلوب', code: 'الكود', name: 'الاسم', phone: 'التليفون',
      printDate: 'تاريخ الطباعة', period: 'الفترة', asOf: 'حتى تاريخ', page: 'صفحة',
      addNew: '+ جديد', addNewNamed: 'إضافة "{0}" كجديد', errorTitle: 'خطأ',
      months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
      // master data
      item: 'الصنف', itemCode: 'الكود', itemName: 'اسم الصنف', cat: 'CAT', group: 'النوع / المجموعة',
      unit: 'الوحدة', minQty: 'حد الطلب (أقل كمية)', groupCode: 'رقم المجموعة', groupName: 'اسم المجموعة',
      client: 'المحجر / العميل', supplier: 'المورد', newItem: 'صنف جديد', newClient: 'عميل جديد',
      newSupplier: 'مورد جديد', newGroup: 'مجموعة جديدة', inUse: 'لا يمكن الحذف لأنه مستخدم في حركات',
      codeExists: 'هذا الكود مستخدم بالفعل', balance: 'الرصيد', cost: 'التكلفة',
      // opening
      openingQty: 'كمية أول المدة', openingPrice: 'سعر أول المدة', openingValue: 'قيمة أول المدة',
      openingHint: 'أدخل الكمية والسعر الافتتاحي لكل صنف مرة واحدة عند بداية استخدام البرنامج.',
      // documents
      purchase: 'وارد (مشتريات)', purchase_return: 'مرتجع مشتريات', issue: 'منصرف', issue_return: 'مرتجع للمخازن',
      docType: 'نوع الحركة', invoiceNo: 'فاتورة رقم', requestNo: 'طلب توريد رقم', refNo: 'رقم المستند',
      docNo: 'رقم الحركة', voucherNo: 'رقم', qty: 'الكمية', price: 'السعر', value: 'القيمة', available: 'الكمية المتاحة',
      qtyIssued: 'الكمية المنصرفة', qtyReturned: 'الكمية المرتجعة', lineTotal: 'الإجمالي', docTotal: 'إجمالي الحركة',
      addLine: '+ سطر جديد', removeLine: 'حذف السطر', saveDoc: 'حفظ (Ctrl+S)', saveAndPrint: 'حفظ وطباعة',
      newPurchase: 'وارد جديد', newIssue: 'منصرف جديد', editDoc: 'تعديل حركة', party: 'الجهة',
      overIssue: 'لا يمكن صرف {0} من "{1}" — الكمية المتاحة {2} فقط',
      negativeStock: 'لا يمكن الحفظ: رصيد الصنف "{0}" سيصبح بالسالب ({1}) بتاريخ {2}',
      noLines: 'أضف صنفاً واحداً على الأقل', choosePartySupplier: 'اختر المورد', choosePartyClient: 'اختر العميل',
      invalidDate: 'تاريخ غير صحيح (يوم/شهر/سنة)', enterHint: 'Enter للانتقال للحقل التالي — يُضاف سطر جديد تلقائياً',
      voucherIssue: 'إذن صرف', voucherIssueReturn: 'إذن ارتجاع للمخازن', voucherPurchase: 'إذن استلام (وارد)',
      voucherPurchaseReturn: 'إذن مرتجع مشتريات', receiver: 'المستلم', storekeeper: 'أمين المخزن', manager: 'المدير',
      printVoucher: 'طباعة الإذن', filterType: 'كل الأنواع', lines: 'عدد الأصناف',
      // dashboard
      stockValue: 'قيمة المخزون الحالية', monthIn: 'وارد هذا الشهر', monthOut: 'منصرف هذا الشهر',
      lowStock: 'أصناف تحت حد الطلب', itemsCount: 'عدد الأصناف', recentDocs: 'آخر الحركات',
      emptyDb: 'لا توجد حركات بعد. يمكنك تحميل بيانات تجريبية لتجربة البرنامج.', loadSample: 'تحميل بيانات تجريبية',
      // reports
      rptClient: 'تقرير العملاء (المنصرف)', rptSummary: 'ملخص المخزن الشهري (إجمالي)', rptCount: 'الجرد',
      rptCard: 'كارت صنف', rptPurchases: 'تقرير المشتريات بالمورد', rptStock: 'المخزون الحالي وقيمته',
      rptLow: 'الأصناف تحت حد الطلب', chooseReport: 'اختر التقرير', allClients: 'كل العملاء',
      allSuppliers: 'كل الموردين', allGroups: 'كل المجموعات', chooseItem: 'اختر الصنف',
      opening: 'أول المدة', incoming: 'الوارد', outgoing: 'المنصرف', closing: 'صافي آخر المدة',
      prevBalance: 'رصيد سابق', purchasesCol: 'مشتريات', issuedCol: 'منصرف', purchaseReturnsCol: 'مرتجع مشتريات',
      returnsCol: 'مرتجع للمخازن', physical: 'الجرد الفعلي', shortage: 'العجز', shortageValue: 'قيمة العجز',
      groupTotal: 'اجمالي {0}', stockTotal: 'اجمالي المخزن', clientTotal: 'إجمالي {0}', supplierTotal: 'إجمالي {0}',
      in: 'وارد', out: 'منصرف', runningBalance: 'الرصيد', openingRow: 'رصيد أول المدة', avgCost: 'متوسط التكلفة',
      status: 'الحالة', low: 'تحت الحد', ok: 'جيد', physicalHint: 'اكتب الجرد الفعلي في العمود المخصص ليحسب البرنامج العجز تلقائياً.',
      fromTo: 'من {0} إلى {1}', untilDate: 'حتى {0}', needed: 'الكمية المطلوبة',
      // settings
      appNameAr: 'اسم البرنامج (عربي)', appNameEn: 'اسم البرنامج (English)', logo: 'الشعار (اللوجو)',
      chooseLogo: 'اختيار صورة', removeLogo: 'إزالة الشعار', costMethod: 'طريقة تقييم المخزون',
      costAvg: 'المتوسط المرجح', costLast: 'آخر سعر شراء', password: 'كلمة المرور (اختياري)',
      newPassword: 'كلمة مرور جديدة', setPassword: 'تعيين كلمة المرور', removePassword: 'إلغاء كلمة المرور',
      passwordSet: 'تم تعيين كلمة المرور', passwordRemoved: 'تم إلغاء كلمة المرور', passwordOn: 'الدخول بكلمة مرور مفعّل',
      passwordOff: 'الدخول بدون كلمة مرور', backup: 'نسخة احتياطية', restore: 'استرجاع نسخة',
      backupDone: 'تم حفظ النسخة الاحتياطية', restoreDone: 'تم الاسترجاع بنجاح',
      restoreWarn: 'سيتم استبدال كل البيانات الحالية بالنسخة المختارة. متابعة؟', dataSection: 'البيانات',
      clearData: 'مسح كل البيانات', clearWarn: 'سيتم مسح كل الأصناف والحركات نهائياً (تُحفظ نسخة احتياطية تلقائياً أولاً). متابعة؟',
      sampleWarn: 'سيتم مسح البيانات الحالية وتحميل بيانات تجريبية. متابعة؟', sampleLoaded: 'تم تحميل البيانات التجريبية',
      dbLocation: 'مكان ملف قاعدة البيانات', autoBackups: 'يتم حفظ نسخة احتياطية تلقائية عند كل إغلاق للبرنامج.',
      general: 'عام', language: 'اللغة', openFolder: 'فتح المجلد',
      // login
      login: 'دخول', wrongPassword: 'كلمة المرور غير صحيحة', enterPassword: 'أدخل كلمة المرور',
    },
    en: {
      appNameDefault: 'M. Khalaf Warehouse',
      langToggle: 'عربي',
      dashboard: 'Home', purchases: 'Incoming (Purchases)', issues: 'Outgoing (Clients)',
      transactions: 'All transactions', items: 'Items', groups: 'Groups', clients: 'Sites / Clients',
      suppliers: 'Suppliers', openingBalances: 'Opening balances', reports: 'Reports', settings: 'Settings',
      logout: 'Log out', secWork: 'Transactions', secData: 'Master data', secOther: 'Reports & settings',
      add: 'Add', edit: 'Edit', del: 'Delete', save: 'Save', cancel: 'Cancel', close: 'Close', search: 'Search...',
      yes: 'Yes', no: 'No', confirmDelete: 'Are you sure you want to delete?', saved: 'Saved', deleted: 'Deleted',
      print: 'Print', exportExcel: 'Export Excel', exportPdf: 'Export PDF', show: 'Show', newDoc: 'New',
      actions: 'Actions', total: 'Total', grandTotal: 'Grand total', none: 'No data',
      all: 'All', from: 'From', to: 'To', month: 'Month', year: 'Year', date: 'Date', notes: 'Notes',
      no_: 'No.', required: 'This field is required', code: 'Code', name: 'Name', phone: 'Phone',
      printDate: 'Print date', period: 'Period', asOf: 'As of', page: 'Page',
      addNew: '+ New', addNewNamed: 'Add "{0}" as new', errorTitle: 'Error',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      item: 'Item', itemCode: 'Code', itemName: 'Item name', cat: 'CAT', group: 'Group / Type',
      unit: 'Unit', minQty: 'Minimum stock level', groupCode: 'Group no.', groupName: 'Group name',
      client: 'Site / Client', supplier: 'Supplier', newItem: 'New item', newClient: 'New client',
      newSupplier: 'New supplier', newGroup: 'New group', inUse: 'Cannot delete: it is used in transactions',
      codeExists: 'This code is already used', balance: 'Balance', cost: 'Cost',
      openingQty: 'Opening qty', openingPrice: 'Opening price', openingValue: 'Opening value',
      openingHint: 'Enter the starting quantity and price of every item once, when you first start using the app.',
      purchase: 'Purchase (incoming)', purchase_return: 'Purchase return', issue: 'Issue (outgoing)', issue_return: 'Return to warehouse',
      docType: 'Type', invoiceNo: 'Invoice no.', requestNo: 'Supply request no.', refNo: 'Reference no.',
      docNo: 'No.', voucherNo: 'No.', qty: 'Quantity', price: 'Price', value: 'Value', available: 'Available qty',
      qtyIssued: 'Qty issued', qtyReturned: 'Qty returned', lineTotal: 'Total', docTotal: 'Document total',
      addLine: '+ New line', removeLine: 'Remove line', saveDoc: 'Save (Ctrl+S)', saveAndPrint: 'Save & print',
      newPurchase: 'New incoming', newIssue: 'New outgoing', editDoc: 'Edit transaction', party: 'Party',
      overIssue: 'Cannot issue {0} of "{1}" — only {2} available',
      negativeStock: 'Cannot save: balance of "{0}" would become negative ({1}) on {2}',
      noLines: 'Add at least one item', choosePartySupplier: 'Choose the supplier', choosePartyClient: 'Choose the client',
      invalidDate: 'Invalid date (day/month/year)', enterHint: 'Enter moves to the next field — a new line is added automatically',
      voucherIssue: 'Issue voucher', voucherIssueReturn: 'Return-to-warehouse voucher', voucherPurchase: 'Goods received voucher',
      voucherPurchaseReturn: 'Purchase return voucher', receiver: 'Received by', storekeeper: 'Storekeeper', manager: 'Manager',
      printVoucher: 'Print voucher', filterType: 'All types', lines: 'Lines',
      stockValue: 'Current stock value', monthIn: 'Incoming this month', monthOut: 'Outgoing this month',
      lowStock: 'Items below minimum', itemsCount: 'Items', recentDocs: 'Recent transactions',
      emptyDb: 'No transactions yet. You can load sample data to try the app.', loadSample: 'Load sample data',
      rptClient: 'Client report (issues)', rptSummary: 'Monthly warehouse summary', rptCount: 'Stock count',
      rptCard: 'Item card (movement)', rptPurchases: 'Purchases by supplier', rptStock: 'Current stock & value',
      rptLow: 'Items below minimum', chooseReport: 'Choose a report', allClients: 'All clients',
      allSuppliers: 'All suppliers', allGroups: 'All groups', chooseItem: 'Choose an item',
      opening: 'Opening balance', incoming: 'Incoming', outgoing: 'Outgoing', closing: 'Closing balance',
      prevBalance: 'Previous balance', purchasesCol: 'Purchases', issuedCol: 'Issued', purchaseReturnsCol: 'Purchase returns',
      returnsCol: 'Returns to warehouse', physical: 'Physical count', shortage: 'Shortage', shortageValue: 'Shortage value',
      groupTotal: 'Total {0}', stockTotal: 'Warehouse total', clientTotal: 'Total {0}', supplierTotal: 'Total {0}',
      in: 'In', out: 'Out', runningBalance: 'Balance', openingRow: 'Opening balance', avgCost: 'Unit cost',
      status: 'Status', low: 'Low', ok: 'OK', physicalHint: 'Type the physical count in its column and the shortage is calculated automatically.',
      fromTo: 'From {0} to {1}', untilDate: 'Until {0}', needed: 'Qty needed',
      appNameAr: 'App name (Arabic)', appNameEn: 'App name (English)', logo: 'Logo',
      chooseLogo: 'Choose image', removeLogo: 'Remove logo', costMethod: 'Stock valuation method',
      costAvg: 'Weighted average cost', costLast: 'Last purchase price', password: 'Password (optional)',
      newPassword: 'New password', setPassword: 'Set password', removePassword: 'Remove password',
      passwordSet: 'Password set', passwordRemoved: 'Password removed', passwordOn: 'Password login is ON',
      passwordOff: 'No password required', backup: 'Backup', restore: 'Restore',
      backupDone: 'Backup saved', restoreDone: 'Restored successfully',
      restoreWarn: 'All current data will be replaced by the chosen backup. Continue?', dataSection: 'Data',
      clearData: 'Delete all data', clearWarn: 'All items and transactions will be deleted (an automatic backup is saved first). Continue?',
      sampleWarn: 'Current data will be erased and replaced with sample data. Continue?', sampleLoaded: 'Sample data loaded',
      dbLocation: 'Database file location', autoBackups: 'An automatic backup is saved every time the app closes.',
      general: 'General', language: 'Language', openFolder: 'Open folder',
      login: 'Log in', wrongPassword: 'Wrong password', enterPassword: 'Enter password',
    },
  };

  function t(lang, key, ...args) {
    let s = (T[lang] && T[lang][key]);
    if (s === undefined) s = T.en[key] !== undefined ? T.en[key] : key;
    if (typeof s === 'string') args.forEach((a, i) => { s = s.split('{' + i + '}').join(a); });
    return s;
  }

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  function fmtMoney(n) {
    if (n === null || n === undefined || n === '') return '';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtQty(n) {
    if (n === null || n === undefined || n === '') return '';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }
  // ISO yyyy-mm-dd -> dd/mm/yyyy
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  // dd/mm/yyyy (or d/m, d/m/yy, d-m-yyyy) -> ISO, or null if invalid
  function parseDate(s) {
    if (!s) return null;
    s = String(s).trim().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const p = s.split(/[\/\-.\s]+/).filter(Boolean).map(Number);
    if (p.length < 2 || p.some(isNaN)) return null;
    let [d, m, y] = p;
    if (!y) y = new Date().getFullYear();
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function monthRange(year, month /* 1-12 */) {
    const last = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
  }
  // Arabic-aware normalisation for search
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '') // diacritics + tatweel
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
      .replace(/\s+/g, ' ')
      .trim();
  }
  function matches(text, query) {
    const q = norm(query);
    if (!q) return true;
    const h = norm(text);
    return q.split(' ').every((w) => h.includes(w));
  }

  const api = { T, t, r2, fmtMoney, fmtQty, fmtDate, parseDate, todayISO, monthRange, norm, matches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof window !== 'undefined' ? window : globalThis);
