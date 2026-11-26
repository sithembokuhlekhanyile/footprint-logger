/* Shared helpers: API calls, session storage, formatting and the activity form. */
(function () {
  const TOKEN_KEY = 'footprint.token';
  const USER_KEY = 'footprint.user';
  const F = window.FOOTPRINT;

  const session = {
    get token() { return localStorage.getItem(TOKEN_KEY); },
    get user() {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
    },
    save(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    setUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  };

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (session.token) headers.Authorization = 'Bearer ' + session.token;
    const res = await fetch('/api' + path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (res.status === 401 && session.token) {
      session.clear();
      if (!location.pathname.startsWith('/login')) location.href = '/login?expired=1';
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function today() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function kg(n) {
    if (n === null || n === undefined) return '-';
    return (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' kg';
  }

  function prettyDay(day) {
    const d = new Date(day + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function badge(category) {
    const c = F.CATEGORIES[category];
    return `<span class="badge badge-${category}">${c ? c.label : category}</span>`;
  }

  function renderNav() {
    const nav = document.querySelector('[data-nav]');
    if (!nav) return;
    const user = session.user;
    const here = location.pathname.replace(/\.html$/, '');
    const link = (href, text) => `<a href="${href}" class="${here === href ? 'active' : ''}">${text}</a>`;
    nav.innerHTML = user
      ? `${link('/dashboard', 'Dashboard')}<span class="nav-user">${escapeHtml(user.name)}</span><button class="link-btn" data-logout>Log out</button>`
      : `${link('/', 'Quick log')}${link('/login', 'Log in')}<a href="/register" class="btn btn-small">Sign up</a>`;
    const logout = nav.querySelector('[data-logout]');
    if (logout) logout.addEventListener('click', () => { session.clear(); location.href = '/'; });
  }

  /**
   * Renders the activity form into `form` and calls onSubmit(activity)
   * with a ready-to-store record. Returns a reset function.
   */
  function mountActivityForm(form, onSubmit) {
    const catSel = form.querySelector('[name=category]');
    const actSel = form.querySelector('[name=activityKey]');
    const qty = form.querySelector('[name=quantity]');
    const unit = form.querySelector('[data-unit]');
    const custom = form.querySelector('[data-custom]');
    const preview = form.querySelector('[data-preview]');
    const dayInput = form.querySelector('[name=day]');
    const errorBox = form.querySelector('[data-error]');
    dayInput.value = today();
    dayInput.max = today();

    function fillActivities() {
      const cat = catSel.value;
      const opts = F.ACTIVITIES.filter((a) => cat === 'all' || a.category === cat)
        .map((a) => `<option value="${a.key}">${a.label} (${a.factor} kg per ${a.unit})</option>`);
      opts.push('<option value="__custom">Custom activity...</option>');
      actSel.innerHTML = opts.join('');
      update();
    }

    function update() {
      const isCustom = actSel.value === '__custom';
      custom.hidden = !isCustom;
      custom.querySelectorAll('input,select').forEach((el) => { el.required = isCustom && el.dataset.optional === undefined; });
      if (isCustom) {
        unit.textContent = 'units';
        const co2 = Number(form.querySelector('[name=co2]').value) || 0;
        preview.textContent = kg(co2) + ' CO2e';
      } else {
        const a = F.byKey[actSel.value];
        unit.textContent = a.unit;
        preview.textContent = kg(F.calculate(a.key, Number(qty.value) || 0)) + ' CO2e';
      }
    }

    catSel.addEventListener('change', fillActivities);
    actSel.addEventListener('change', update);
    form.addEventListener('input', update);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.textContent = '';
      const day = dayInput.value || today();
      let record;
      if (actSel.value === '__custom') {
        const label = form.querySelector('[name=label]').value.trim();
        const category = form.querySelector('[name=customCategory]').value;
        const co2 = Number(form.querySelector('[name=co2]').value);
        if (!label || !(co2 >= 0)) { errorBox.textContent = 'Enter a name and a CO2 value for the custom activity.'; return; }
        record = { activityKey: null, label, category, quantity: Number(qty.value) || 1, unit: 'item', co2: Math.round(co2 * 100) / 100, day };
      } else {
        const a = F.byKey[actSel.value];
        const quantity = Number(qty.value);
        if (!(quantity > 0)) { errorBox.textContent = 'Enter a quantity above zero.'; return; }
        record = { activityKey: a.key, label: a.label, category: a.category, quantity, unit: a.unit, co2: F.calculate(a.key, quantity), day };
      }
      try {
        await onSubmit(record);
        qty.value = '';
        form.querySelector('[name=label]').value = '';
        form.querySelector('[name=co2]').value = '';
        update();
      } catch (err) {
        errorBox.textContent = err.message;
      }
    });

    fillActivities();
  }

  window.App = { session, api, today, kg, prettyDay, escapeHtml, badge, renderNav, mountActivityForm };
  document.addEventListener('DOMContentLoaded', renderNav);
})();
