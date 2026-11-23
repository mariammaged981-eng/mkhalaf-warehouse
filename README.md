# مخزن م. خلف — M. Khalaf Warehouse

Offline warehouse / inventory management for Windows. Arabic (RTL) and English, local SQLite database, one-click backup/restore. No internet, no server and no Node.js are needed to run it.

برنامج إدارة مخزن يعمل بدون إنترنت على ويندوز، عربي وإنجليزي، وقاعدة البيانات محفوظة على نفس الجهاز مع نسخ احتياطي واسترجاع بضغطة واحدة.

---

## 1. Install (for users) — التثبيت

**Option A: download the ready installer (recommended)**

1. Open the **Releases** page of this repository (right side of the GitHub page) and download `MKhalafWarehouse-Setup-1.0.0.exe`.
   (Every push also builds the files under **Actions → latest run → Artifacts → MKhalafWarehouse-Windows**.)
2. Run `MKhalafWarehouse-Setup-1.0.0.exe` and follow the steps. A desktop shortcut **مخزن م. خلف** is created.
   - `MKhalafWarehouse-1.0.0-portable.exe` is the same app without installing (runs from a USB stick).
3. If Windows SmartScreen shows "Windows protected your PC", click **More info**, then **Run anyway** (the app is not code-signed).

> Every update pushed to `main` rebuilds the Windows and Mac files and attaches them to the Release for the version in `package.json` (bump the version for a new release).

**طريقة التثبيت:** من صفحة المشروع على GitHub افتح **Releases** وحمّل `MKhalafWarehouse-Setup-1.0.0.exe`. لو ظهرت رسالة حماية ويندوز اضغط **More info** ثم **Run anyway**.

### macOS (for testing on a Mac) — على الماك

1. From **Releases**, download `MKhalafWarehouse-1.0.0-mac-universal.dmg` (works on Apple Silicon M1/M2/M3/M4 and Intel Macs).
2. Open the .dmg and drag **M. Khalaf Warehouse** into **Applications**.
3. The app is not notarized by Apple, so the first time:
   - **Right-click** (or Control-click) the app in Applications → **Open** → **Open**.
   - If macOS still refuses ("cannot be opened" or "is damaged"): open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to the app's name, then confirm.
   - Last resort: open **Terminal** and run `xattr -cr "/Applications/M. Khalaf Warehouse.app"`, then open the app normally.
4. Data on the Mac is stored in `~/Library/Application Support/M. Khalaf Warehouse/data/`.

## 2. Build it yourself (for developers) — البناء من الكود

Node.js is needed only to *build* the installer, not to run the app.

1. Install **Node.js 22 LTS** from <https://nodejs.org> (Windows installer, default options).
2. Download this repository (green **Code** button → **Download ZIP**, then unzip), or `git clone` it.
3. Open **Command Prompt** in the project folder and run:

   ```bat
   npm install
   npm start            :: run the app directly to try it
   npm test             :: quick self-test of the stock calculations
   npm run dist         :: build the installer + portable exe into the dist\ folder
   ```

   On a Mac: `npm install`, `npm start`, and `npm run dist:mac` (creates the .dmg in `dist/`).

4. The installer is `dist\MKhalafWarehouse-Setup-1.0.0.exe`.

## 3. First steps — أول استخدام

1. **Try it with sample data:** on the home screen press **تحميل بيانات تجريبية / Load sample data** (also in Settings). It creates 23 items, opening balances and about two months of purchases and issues. When you are ready for real work use **Settings → Delete all data** (a backup is taken automatically first).
2. **Settings (الإعدادات):** change the app name (Arabic/English), add a logo, choose the valuation method (weighted average or last purchase price) and optionally set a login password.
3. **Master data:** Groups (8 groups preloaded), Items, Sites/Clients (7 preloaded), Suppliers (2 preloaded). All lists support add, edit, delete and Arabic search.
4. **Opening balances (أرصدة أول المدة):** type the starting quantity and price of every item once.
5. **Incoming (الوارد):** date (today by default), supplier, invoice no., then lines. Switch to **مرتجع مشتريات** for purchase returns.
6. **Outgoing (المنصرف):** date, site/client, supply request no., then lines. The available quantity is shown and over-issuing is blocked. Switch to **مرتجع للمخازن** for returns. **Save & print** prints the issue voucher (إذن صرف).
7. **All transactions (كل الحركات):** filter, edit, delete or re-print any document; stock recalculates automatically.
8. **Reports (التقارير):** monthly summary (إجمالي), client report, stock count (جرد) with physical count & shortage, item card (كارت صنف), purchases by supplier, current stock & value, low stock. Every report can be shown, printed, exported to Excel and PDF, in Arabic or English.

### Fast data entry — إدخال سريع

| Key | Action |
|---|---|
| Type a code or part of a name | search-as-you-type (Arabic letters like ة/ه, ى/ي, أ/ا are treated as the same) |
| ↑ ↓ then **Enter** | choose and move to the next field |
| **Enter** on the last field | adds a new line automatically |
| "+ New" in the list / the ＋ button | add a new item, client or supplier without leaving the screen |
| **Ctrl+S** | save |
| **Ctrl+P** | save and print voucher |
| Dates | type `5/11` or `5/11/2026` (day/month/year) |

## 4. Data, backup & restore — البيانات والنسخ الاحتياطي

- Database file: `%APPDATA%\M. Khalaf Warehouse\data\warehouse.db` (Settings shows the exact path and an **Open folder** button).
- **Settings → Backup** saves a copy anywhere (USB stick, another drive). **Restore** replaces the current data with a chosen backup (the current data is auto-saved first).
- An automatic backup is saved in `...\data\backups\` every time the app closes (the last 20 are kept).
- Uninstalling the app does **not** delete the data.

## 5. How stock is calculated — طريقة حساب المخزون

- Balance = opening + purchases − purchase returns − issued + returns to warehouse.
- **Weighted average cost** (default): every purchase updates the average; issues and returns move stock at the current average.
- **Last purchase price** (Settings): stock is valued at the most recent purchase price.
- A transaction that would make any item's balance negative on any date (including back-dated edits and deletions) is refused with a clear message.
- In the monthly summary, *Incoming* = purchases − purchase returns and *Outgoing* = issued − returns to warehouse, all valued at cost. The client report shows the prices typed on each issue voucher.

## 6. Project structure

```
main.js            Electron main process: window, IPC API, printing, PDF/Excel export, backup
preload.js         safe bridge between the window and main process
src/db.js          SQLite (sql.js, WebAssembly — no native modules) schema & data access
src/reports.js     stock engine (average / last price) and all report builders
src/excel.js       .xlsx export (right-to-left sheets in Arabic)
src/sample.js      sample data
shared/i18n.js     Arabic/English texts, number/date formatting, Arabic search normalisation
renderer/          the user interface (HTML/CSS/JS) + bundled Cairo Arabic font
test/smoke.js      engine tests (npm test)
test/e2e.js        drives the real app and takes screenshots (npm run test:e2e)
```

Font: [Cairo](https://fonts.google.com/specimen/Cairo), SIL Open Font License, bundled for offline use.
