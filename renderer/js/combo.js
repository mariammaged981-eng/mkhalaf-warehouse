/* Search-as-you-type picker (by code or Arabic/English name).
   Enter selects the highlighted entry and then the normal Enter navigation moves to the next field. */
class Combo {
  constructor(input, opts) {
    this.input = input;
    this.o = opts; // { source(), code(x), name(x), sub(x), onSelect(x), onAddNew(text) }
    this.value = null;
    this.list = document.createElement('div');
    this.list.className = 'combo-list hidden';
    document.body.appendChild(this.list);
    this.active = -1;
    this.results = [];
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', () => { this.value = null; this.open(); });
    input.addEventListener('focus', () => { input.select(); });
    input.addEventListener('dblclick', () => this.open(true));
    input.addEventListener('keydown', (e) => this.key(e));
    input.addEventListener('blur', () => setTimeout(() => this.blur(), 150));
    this.list.addEventListener('mousedown', (e) => {
      const el = e.target.closest('[data-i]');
      if (!el) return;
      e.preventDefault();
      const i = Number(el.dataset.i);
      if (i === -2) this.addNew(); else this.pick(this.results[i], true);
    });
  }
  label(x) { return x ? `${this.o.code(x) ? this.o.code(x) + ' - ' : ''}${this.o.name(x)}` : ''; }
  set(x) { this.value = x || null; this.input.value = this.label(x); }
  filter(q) {
    const all = this.o.source();
    q = (q || '').trim();
    if (!q) return all.slice(0, 80);
    const exact = all.filter((x) => String(this.o.code(x)) === q);
    const rest = all.filter((x) => !exact.includes(x) && (I18N.matches(this.label(x) + ' ' + (this.o.sub ? this.o.sub(x) : ''), q) || String(this.o.code(x)).startsWith(q)));
    return exact.concat(rest).slice(0, 80);
  }
  open(all) {
    this.results = this.filter(all ? '' : this.input.value);
    this.active = this.results.length ? 0 : -1;
    this.render();
  }
  render() {
    const q = this.input.value.trim();
    let html = this.results.map((x, i) => `<div class="combo-item ${i === this.active ? 'active' : ''}" data-i="${i}">
      <b>${esc(this.o.code(x) || '')}</b> <span>${esc(this.o.name(x))}</span>${this.o.sub ? `<small>${esc(this.o.sub(x) || '')}</small>` : ''}</div>`).join('');
    if (this.o.onAddNew) html += `<div class="combo-item add ${this.active === -2 ? 'active' : ''}" data-i="-2">${esc(q ? t('addNewNamed', q) : t('addNew'))}</div>`;
    this.list.innerHTML = html;
    const r = this.input.getBoundingClientRect();
    Object.assign(this.list.style, { top: r.bottom + 2 + 'px', left: r.left + 'px', minWidth: Math.max(r.width, 300) + 'px' });
    this.list.classList.remove('hidden');
    const a = this.list.querySelector('.active');
    if (a) a.scrollIntoView({ block: 'nearest' });
    // keep the list inside the window
    const lr = this.list.getBoundingClientRect();
    if (lr.right > window.innerWidth) this.list.style.left = Math.max(4, window.innerWidth - lr.width - 4) + 'px';
    if (lr.bottom > window.innerHeight) this.list.style.top = Math.max(4, r.top - lr.height - 2) + 'px';
  }
  isOpen() { return !this.list.classList.contains('hidden'); }
  close() { this.list.classList.add('hidden'); }
  key(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.isOpen()) { this.open(true); return; }
      const max = this.results.length - 1;
      const hasAdd = !!this.o.onAddNew;
      if (e.key === 'ArrowDown') this.active = this.active === -2 ? 0 : this.active >= max ? (hasAdd ? -2 : 0) : this.active + 1;
      else this.active = this.active === -2 ? max : this.active <= 0 ? (hasAdd ? -2 : max) : this.active - 1;
      this.render();
    } else if (e.key === 'Escape' && this.isOpen()) {
      e.preventDefault(); e.stopPropagation(); this.close();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (this.isOpen()) {
        if (this.active >= 0) { this.pick(this.results[this.active]); return; } // let Enter continue to next field
        if (this.active === -2 && e.key === 'Enter') { e.preventDefault(); this.addNew(); return; }
        if (this.input.value.trim() && this.o.onAddNew && e.key === 'Enter') { e.preventDefault(); this.addNew(); return; }
      }
      if (!this.value && e.key === 'Enter') { e.preventDefault(); this.open(); }
    }
  }
  pick(x, focusNext) {
    this.set(x);
    this.close();
    if (this.o.onSelect) this.o.onSelect(x);
    if (focusNext) this.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  async addNew() {
    this.close();
    const text = this.input.value.trim();
    const x = await this.o.onAddNew(text);
    if (x) this.pick(x, true); else this.input.focus();
  }
  blur() {
    if (document.activeElement === this.input) return;
    this.close();
    if (!this.value && this.input.value.trim()) {
      const r = this.filter(this.input.value);
      if (r.length === 1) { this.pick(r[0]); return; }
    }
    this.input.value = this.label(this.value);
  }
  destroy() { this.list.remove(); }
}
