/* Signed-in dashboard: summaries, charts, insights, goals and the activity log. */
(function () {
  const { session, api, kg, prettyDay, escapeHtml, badge, today, mountActivityForm } = window.App;
  const F = window.FOOTPRINT;
  const $ = (sel) => document.querySelector(sel);
  const charts = {};
  let filter = 'all';
  let showAll = false;

  if (!session.token) { location.replace('/login'); return; }

  const user = session.user || {};
  $('[data-greeting]').textContent = `Hi ${user.name ? user.name.split(' ')[0] : 'there'}, here is your footprint`;
  const imported = new URLSearchParams(location.search).get('imported');
  if (imported) {
    $('[data-imported]').hidden = false;
    $('[data-imported]').textContent = `${imported} guest ${imported === '1' ? 'entry was' : 'entries were'} added to your account.`;
    history.replaceState(null, '', '/dashboard');
  }

  function chart(id, config) {
    if (charts[id]) { charts[id].data = config.data; charts[id].update(); return; }
    charts[id] = new Chart(document.getElementById(id), config);
  }

  function renderSummary(s) {
    $('[data-subtitle]').textContent = `Week of ${prettyDay(s.weekly[s.weekly.length - 1].weekStart)}`;
    $('[data-stat=today]').textContent = kg(s.totals.today);
    $('[data-stat=last7]').textContent = kg(s.totals.last7Days);
    $('[data-stat=all]').textContent = kg(s.totals.allTime);
    $('[data-stat=entries]').textContent = `${s.totals.entries} entries`;
    $('[data-stat=streak]').textContent = `${s.streak.current} ${s.streak.current === 1 ? 'day' : 'days'}`;
    $('[data-stat=longest]').textContent = s.streak.loggedToday
      ? `Longest: ${s.streak.longest} days`
      : s.streak.current ? 'Log today to keep it going' : `Longest: ${s.streak.longest} days`;

    chart('dailyChart', {
      type: 'bar',
      data: {
        labels: s.daily.map((d) => prettyDay(d.day)),
        datasets: [{ label: 'kg CO2e', data: s.daily.map((d) => d.total), backgroundColor: '#2f7d6d', borderRadius: 4 }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'kg CO2e' } } } }
    });

    const cats = Object.keys(F.CATEGORIES);
    chart('categoryChart', {
      type: 'doughnut',
      data: {
        labels: cats.map((c) => F.CATEGORIES[c].label),
        datasets: [{ data: cats.map((c) => s.byCategoryLast7Days[c]), backgroundColor: cats.map((c) => F.CATEGORIES[c].color), borderWidth: 0 }]
      },
      options: { maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom' } } }
    });

    const c = s.community;
    if (c.average === null) {
      $('[data-community-text]').textContent = 'No community data for the last 7 days yet.';
    } else {
      const diff = c.differencePercent;
      const phrase = diff === 0 ? 'the same as' : `${Math.abs(diff)}% ${diff < 0 ? 'below' : 'above'}`;
      $('[data-community-text]').textContent =
        `Over the last 7 days you emitted ${kg(c.you)}, ${phrase} the average of ${kg(c.average)} across ${c.users} active ${c.users === 1 ? 'member' : 'members'}.`;
    }
    chart('communityChart', {
      type: 'bar',
      data: {
        labels: ['You', 'Community average'],
        datasets: [{ data: [c.you, c.average || 0], backgroundColor: ['#2f7d6d', '#b9c7c2'], borderRadius: 6 }]
      },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });

    const weeks = s.weekly.slice().reverse();
    $('[data-weekly]').innerHTML = weeks.map((w, i) => {
      const prev = weeks[i + 1];
      let change = '-';
      if (prev && prev.total > 0 && w.entries) {
        const pct = Math.round(((w.total - prev.total) / prev.total) * 100);
        change = `<span class="${pct <= 0 ? 'good' : 'bad'}">${pct > 0 ? '+' : ''}${pct}%</span>`;
      }
      return `<tr><td>${prettyDay(w.weekStart)}${i === 0 ? ' <span class="muted">(this week)</span>' : ''}</td>
        <td>${w.entries}</td><td>${w.activeDays}/7</td><td class="num">${kg(w.total)}</td><td class="num">${change}</td></tr>`;
    }).join('');
  }

  function renderInsights(ins) {
    $('[data-weekly-focus]').textContent = ins.weeklyGoal || 'Log a few activities to unlock personalised insights.';

    $('[data-ranking]').innerHTML = ins.categoryRanking.length
      ? ins.categoryRanking.map((r) => `
        <div class="rank-row">
          <span>${r.label}</span>
          <div class="bar"><div style="width:${r.share}%;background:${F.CATEGORIES[r.category].color}"></div></div>
          <span class="muted">${kg(r.total)} · ${r.share}%</span>
        </div>`).join('')
      : '<p class="muted">No data yet.</p>';

    $('[data-top]').innerHTML = ins.topActivities.map((a) =>
      `<li>${badge(a.category)} ${escapeHtml(a.label)} <span class="muted">${kg(a.co2)}</span></li>`).join('') || '<li class="muted">No data yet.</li>';

    $('[data-tips]').innerHTML = ins.tips.map((t) => `
      <li>${badge(t.category)}
        <p>${escapeHtml(t.text)}</p>
        ${t.estimatedSavingKg ? `<small class="good">Could save about ${kg(t.estimatedSavingKg)} a week</small>` : ''}
      </li>`).join('');

    const g = ins.goal;
    $('[data-goal-percent]').value = String(g.reductionPercent);
    if (!g.hasBaseline) {
      $('[data-goal]').innerHTML = `<p>${g.message}</p><p class="muted">So far this week: <strong>${kg(g.current)}</strong></p>`;
    } else {
      const width = Math.min(100, g.usedPercent);
      const pace = Math.min(100, Math.round((g.daysElapsed / 7) * 100));
      $('[data-goal]').innerHTML = `
        <div class="goal-numbers">
          <div><span class="muted">This week</span><strong>${kg(g.current)}</strong></div>
          <div><span class="muted">Target</span><strong>${kg(g.target)}</strong></div>
          <div><span class="muted">Last week</span><strong>${kg(g.baseline)}</strong></div>
        </div>
        <div class="progress ${g.status}" title="${g.usedPercent}% of weekly target used">
          <div class="progress-fill" style="width:${width}%"></div>
          <div class="progress-pace" style="left:${pace}%" title="Expected pace for day ${g.daysElapsed}"></div>
        </div>
        <p class="goal-status ${g.status}">${g.message} ${g.status !== 'over' ? `${kg(g.remaining)} left for the rest of the week.` : ''}</p>`;
    }

    $('[data-goal-history]').innerHTML = ins.goalHistory.length
      ? `<h3>Recent weeks</h3><ul class="history">${ins.goalHistory.map((h) => `
          <li class="${h.met ? 'good' : 'bad'}">${h.met ? '✓' : '✕'} Week of ${prettyDay(h.weekStart)}: ${kg(h.total)}
          <span class="muted">(${h.changePercent > 0 ? '+' : ''}${h.changePercent}% vs previous week)</span></li>`).join('')}</ul>`
      : '';
  }

  async function renderLog() {
    const q = filter === 'all' ? '' : `?category=${filter}`;
    const { activities } = await api('/activities' + q);
    const total = activities.reduce((s, a) => s + a.co2, 0);
    $('[data-filter-total]').textContent = filter === 'all'
      ? `${activities.length} entries · ${kg(total)}`
      : `${F.CATEGORIES[filter].label}: ${activities.length} entries · ${kg(total)}`;
    $('[data-log]').innerHTML = activities.length
      ? activities.slice(0, showAll ? 1000 : 25).map((a) => `
        <li>
          <div>${badge(a.category)} <strong>${escapeHtml(a.label)}</strong>
            <span class="muted">${a.activityKey ? `${Math.round(a.quantity * 100) / 100} ${a.unit}` : ''} · ${prettyDay(a.day)}</span></div>
          <div class="log-right"><strong>${kg(a.co2)}</strong>
            <button class="icon-btn" data-delete="${a.id}" aria-label="Delete entry">✕</button></div>
        </li>`).join('')
      : '<li class="empty">No activities in this category yet.</li>';
    const more = $('[data-more]');
    more.hidden = showAll || activities.length <= 25;
    more.textContent = `Show all ${activities.length} entries`;
  }

  async function refresh() {
    const t = today();
    const [summary, insights] = await Promise.all([api('/dashboard?today=' + t), api('/dashboard/insights?today=' + t)]);
    renderSummary(summary);
    renderInsights(insights);
    await renderLog();
  }

  mountActivityForm($('[data-activity-form]'), async (record) => {
    await api('/activities', { method: 'POST', body: record });
    await refresh();
  });

  $('[data-filters]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === btn));
    renderLog();
  });

  $('[data-log]').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    await api('/activities/' + btn.dataset.delete, { method: 'DELETE' });
    refresh();
  });

  $('[data-more]').addEventListener('click', () => { showAll = true; renderLog(); });

  $('[data-goal-percent]').addEventListener('change', async (e) => {
    const { user: updated } = await api('/auth/me', { method: 'PATCH', body: { weeklyReductionPercent: Number(e.target.value) } });
    session.setUser(updated);
    const insights = await api('/dashboard/insights?today=' + today());
    renderInsights(insights);
  });

  refresh().catch((err) => {
    $('[data-weekly-focus]').textContent = 'Could not load your dashboard: ' + err.message;
  });
})();
