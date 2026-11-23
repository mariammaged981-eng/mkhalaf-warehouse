App.screens.settings = {
  icon: '⚙️',
  async render(main) {
    const s = await call('settings.get');
    App.settings = s;
    main.innerHTML = `<h1>⚙️ ${t('settings')}</h1>
    <div class="settings-grid">
      <div class="card"><h2>${t('general')}</h2>
        <div class="form-grid">
          <label class="full"><span>${t('appNameAr')}</span><input id="san" value="${esc(s.app_name_ar)}" dir="rtl"></label>
          <label class="full"><span>${t('appNameEn')}</span><input id="sen" value="${esc(s.app_name_en)}" dir="ltr"></label>
          <label class="full"><span>${t('costMethod')}</span><select id="scost"><option value="avg">${t('costAvg')}</option><option value="last">${t('costLast')}</option></select></label>
        </div>
        <div class="btn-row" style="margin-top:14px"><button class="btn btn-success btn-big" id="ssave">💾 ${t('save')}</button></div>
      </div>
      <div class="card"><h2>${t('logo')}</h2>
        <p>${s.logo ? `<img class="logo-prev" src="${s.logo}">` : `<span class="muted">${t('none')}</span>`}</p>
        <div class="btn-row"><button class="btn btn-primary" id="slogo">🖼️ ${t('chooseLogo')}</button>
        ${s.logo ? `<button class="btn btn-light" id="slogox">${t('removeLogo')}</button>` : ''}</div>
      </div>
      <div class="card"><h2>💾 ${t('backup')} / ${t('restore')}</h2>
        <div class="btn-row"><button class="btn btn-success btn-big" id="sbak">💾 ${t('backup')}</button>
        <button class="btn btn-light btn-big" id="sres">♻️ ${t('restore')}</button></div>
        <p class="hint">${t('autoBackups')}</p>
        <p class="hint">${t('dbLocation')}: <span dir="ltr">${esc(s.db_file)}</span></p>
        <div class="btn-row"><button class="btn btn-light btn-sm" id="sfold">📂 ${t('openFolder')}</button>
        <button class="btn btn-light btn-sm" id="sfoldb">📂 ${t('backup')}</button></div>
      </div>
      <div class="card"><h2>🔒 ${t('password')}</h2>
        <p><b>${s.has_password ? t('passwordOn') : t('passwordOff')}</b></p>
        <div class="btn-row"><input type="password" id="spw" placeholder="${t('newPassword')}">
        <button class="btn btn-primary" id="spwset">${t('setPassword')}</button>
        ${s.has_password ? `<button class="btn btn-light" id="spwx">${t('removePassword')}</button>` : ''}</div>
      </div>
      <div class="card"><h2>🧪 ${t('dataSection')}</h2>
        <div class="btn-row"><button class="btn btn-light" id="ssample">${t('loadSample')}</button>
        <button class="btn btn-danger" id="sclear">${t('clearData')}</button></div>
      </div>
    </div>`;
    $('#scost').value = s.cost_method || 'avg';
    $('#ssave').onclick = async () => {
      await call('settings.set', { app_name_ar: $('#san').value.trim() || 'مخزن م. خلف', app_name_en: $('#sen').value.trim() || 'M. Khalaf Warehouse', cost_method: $('#scost').value });
      toast(t('saved')); await refreshShell(); go('settings');
    };
    $('#slogo').onclick = async () => { if (await call('logo.choose')) { await refreshShell(); go('settings'); } };
    if ($('#slogox')) $('#slogox').onclick = async () => { await call('logo.clear'); await refreshShell(); go('settings'); };
    $('#sbak').onclick = async () => { if (await call('backup.create')) toast(t('backupDone')); };
    $('#sres').onclick = async () => {
      if (!await confirmBox(t('restoreWarn'), { danger: true })) return;
      if (await call('backup.restore')) { toast(t('restoreDone')); await loadLists(true); await refreshShell(); go('dashboard'); }
    };
    $('#sfold').onclick = () => call('open.folder', 'data');
    $('#sfoldb').onclick = () => call('open.folder', 'backups');
    $('#spwset').onclick = async () => {
      const pw = $('#spw').value; if (!pw) { $('#spw').focus(); return; }
      await call('auth.set', pw); toast(t('passwordSet')); go('settings');
    };
    if ($('#spwx')) $('#spwx').onclick = async () => { await call('auth.set', ''); toast(t('passwordRemoved')); go('settings'); };
    $('#ssample').onclick = async () => {
      if (!await confirmBox(t('sampleWarn'), { danger: true })) return;
      await call('data.sample'); await loadLists(true); toast(t('sampleLoaded')); go('dashboard');
    };
    $('#sclear').onclick = async () => {
      if (!await confirmBox(t('clearWarn'), { danger: true })) return;
      await call('data.clear'); await loadLists(true); toast(t('deleted')); go('dashboard');
    };
  },
};
