/* Shell: navigation, language toggle, login */
const NAV = [
  ['dashboard', '🏠'], '-', ['purchases', '⬇️'], ['issues', '⬆️'], ['transactions', '📋'], '-',
  ['items', '📦'], ['groups', '🗂️'], ['clients', '🏗️'], ['suppliers', '🚚'], ['opening', '🧮', 'openingBalances'], '-',
  ['reports', '📊'], ['settings', '⚙️'],
];

async function go(name, params) {
  const cur = App.screens[App.current];
  if (cur && cur.canLeave && !(await cur.canLeave())) return;
  if (cur && cur.leave) { try { cur.leave(); } catch (e) { /* ignore */ } }
  $$('.combo-list').forEach((el) => el.classList.add('hidden'));
  App.current = name;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.s === name));
  const scr = App.screens[name];
  scr.onKey = null;
  const main = $('#main');
  main.scrollTop = 0;
  try { await scr.render(main, params || {}); } catch (e) { console.error(e); if (!e.shown) toast(e.message, 'error'); }
}

function applyLang() {
  document.documentElement.lang = App.lang;
  document.documentElement.dir = App.lang === 'ar' ? 'rtl' : 'ltr';
  $('#nav').innerHTML = NAV.map((n) => (n === '-' ? '<hr>' : `<button data-s="${n[0]}"><span class="ico">${n[1]}</span>${t(n[2] || n[0])}</button>`)).join('');
  $$('#nav button').forEach((b) => { b.onclick = () => go(b.dataset.s); });
  $('#langBtn').textContent = '🌐 ' + t('langToggle');
  $('#logoutBtn').textContent = '🔒 ' + t('logout');
  document.title = appName();
}

async function refreshShell() {
  App.settings = await call('settings.get');
  App.lang = App.settings.lang === 'en' ? 'en' : 'ar';
  $('#brand').innerHTML = `${App.settings.logo ? `<img src="${App.settings.logo}">` : ''}<div class="bn">${esc(appName())}</div>`;
  applyLang();
  $('#logoutBtn').classList.toggle('hidden', !App.settings.has_password);
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.s === App.current));
}

function showLogin() {
  const el = $('#login');
  $('#app').classList.add('hidden');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="box">${App.settings.logo ? `<img src="${App.settings.logo}">` : ''}<div class="bn">${esc(appName())}</div>
    <input type="password" id="lpw" placeholder="${t('enterPassword')}" style="font-size:20px;text-align:center">
    <button class="btn btn-primary btn-big" id="lbtn">${t('login')}</button></div>`;
  const tryLogin = async () => {
    if (await call('auth.check', $('#lpw').value)) { el.classList.add('hidden'); $('#app').classList.remove('hidden'); go('dashboard'); } else { toast(t('wrongPassword'), 'error'); $('#lpw').select(); }
  };
  $('#lbtn').onclick = tryLogin;
  $('#lpw').onkeydown = (e) => { if (e.key === 'Enter') tryLogin(); };
  $('#lpw').focus();
}

document.addEventListener('keydown', (e) => {
  const scr = App.screens[App.current];
  if (scr && scr.onKey && !$('.modal-back')) scr.onKey(e);
});

(async function init() {
  await refreshShell();
  $('#langBtn').onclick = async () => {
    const lang = App.lang === 'ar' ? 'en' : 'ar';
    const cur = App.current;
    const scr = App.screens[cur]; if (scr && scr.canLeave && !(await scr.canLeave())) return;
    if (scr && scr.leave) scr.leave();
    App.current = null;
    await call('settings.set', { lang });
    await refreshShell();
    if (App.screens.reports.state) App.screens.reports.state.lang = lang;
    go(cur || 'dashboard');
  };
  $('#logoutBtn').onclick = () => showLogin();
  if (App.settings.has_password) showLogin();
  else { $('#app').classList.remove('hidden'); go('dashboard'); }
})();
