/* Login and registration. After sign-in, guest entries are moved into the account. */
(function () {
  const { session, api } = window.App;
  const GUEST_KEY = 'footprint.guestLogs';
  const form = document.querySelector('[data-auth-form]');
  const mode = form.dataset.authForm;
  const errorBox = form.querySelector('[data-error]');
  const info = document.querySelector('[data-info]');

  if (session.token) { location.replace('/dashboard'); return; }

  if (new URLSearchParams(location.search).get('expired')) {
    info.hidden = false;
    info.textContent = 'Your session has expired. Please log in again.';
  }

  async function importGuestLogs() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(GUEST_KEY)) || []; } catch (e) { list = []; }
    if (!list.length) return 0;
    const result = await api('/activities/import', { method: 'POST', body: { activities: list } });
    localStorage.removeItem(GUEST_KEY);
    return result.imported;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    const body = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const data = await api('/auth/' + mode, { method: 'POST', body });
      session.save(data.token, data.user);
      const imported = await importGuestLogs().catch(() => 0);
      location.href = '/dashboard' + (imported ? `?imported=${imported}` : '');
    } catch (err) {
      errorBox.textContent = err.message;
      button.disabled = false;
    }
  });
})();
