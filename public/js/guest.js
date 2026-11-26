/* Guest logger: activities are stored in localStorage in this browser. */
(function () {
  const { session, kg, prettyDay, escapeHtml, badge, today, mountActivityForm } = window.App;
  const F = window.FOOTPRINT;
  const STORE_KEY = 'footprint.guestLogs';

  if (session.token) { location.replace('/dashboard'); return; }

  let filter = 'all';
  let categoryChart;
  let activityChart;

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  };
  const save = (list) => localStorage.setItem(STORE_KEY, JSON.stringify(list));

  function totalsByCategory(list) {
    const t = { transport: 0, food: 0, energy: 0 };
    list.forEach((a) => { t[a.category] += a.co2; });
    return t;
  }

  function render() {
    const list = load();
    const total = list.reduce((s, a) => s + a.co2, 0);
    const todayTotal = list.filter((a) => a.day === today()).reduce((s, a) => s + a.co2, 0);
    const byCat = totalsByCategory(list);
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

    document.querySelector('[data-total]').textContent = kg(total);
    document.querySelector('[data-count]').textContent = list.length;
    document.querySelector('[data-today]').textContent = kg(todayTotal);
    document.querySelector('[data-highest]').textContent = top && top[1] > 0 ? F.CATEGORIES[top[0]].label : '-';

    const cats = Object.keys(F.CATEGORIES);
    const catData = {
      labels: cats.map((c) => F.CATEGORIES[c].label),
      datasets: [{ data: cats.map((c) => Math.round(byCat[c] * 100) / 100), backgroundColor: cats.map((c) => F.CATEGORIES[c].color), borderWidth: 0 }]
    };
    if (categoryChart) { categoryChart.data = catData; categoryChart.update(); } else {
      categoryChart = new Chart(document.getElementById('categoryChart'), {
        type: 'doughnut', data: catData,
        options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } }
      });
    }

    const filtered = list.filter((a) => filter === 'all' || a.category === filter);
    const byActivity = {};
    filtered.forEach((a) => {
      if (!byActivity[a.label]) byActivity[a.label] = { co2: 0, category: a.category };
      byActivity[a.label].co2 += a.co2;
    });
    const rows = Object.entries(byActivity).sort((a, b) => b[1].co2 - a[1].co2).slice(0, 8);
    const actData = {
      labels: rows.map((r) => r[0]),
      datasets: [{ label: 'kg CO2e', data: rows.map((r) => Math.round(r[1].co2 * 100) / 100), backgroundColor: rows.map((r) => F.CATEGORIES[r[1].category].color), borderRadius: 4 }]
    };
    if (activityChart) { activityChart.data = actData; activityChart.update(); } else {
      activityChart = new Chart(document.getElementById('activityChart'), {
        type: 'bar', data: actData,
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'kg CO2e' } } } }
      });
    }

    const filteredTotal = filtered.reduce((s, a) => s + a.co2, 0);
    document.querySelector('[data-filter-total]').textContent =
      filter === 'all' ? '' : `${F.CATEGORIES[filter].label}: ${kg(filteredTotal)} across ${filtered.length} entries`;

    const ul = document.querySelector('[data-log]');
    ul.innerHTML = filtered.length
      ? filtered.slice().sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : b.id - a.id)).map((a) => `
        <li>
          <div>${badge(a.category)} <strong>${escapeHtml(a.label)}</strong>
            <span class="muted">${a.activityKey ? `${Math.round(a.quantity * 100) / 100} ${a.unit}` : ''} · ${prettyDay(a.day)}</span></div>
          <div class="log-right"><strong>${kg(a.co2)}</strong>
            <button class="icon-btn" data-delete="${a.id}" aria-label="Delete entry">✕</button></div>
        </li>`).join('')
      : '<li class="empty">No activities yet. Add your first one above.</li>';
    document.querySelector('[data-clear]').hidden = list.length === 0;
  }

  mountActivityForm(document.querySelector('[data-activity-form]'), async (record) => {
    const list = load();
    list.push({ ...record, id: Date.now() });
    save(list);
    render();
  });

  document.querySelector('[data-filters]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });

  document.querySelector('[data-log]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    save(load().filter((a) => String(a.id) !== btn.dataset.delete));
    render();
  });

  document.querySelector('[data-clear]').addEventListener('click', () => {
    if (window.confirm('Remove all guest entries from this browser?')) { save([]); render(); }
  });

  render();
})();
