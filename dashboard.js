/* ═══ Atlas HQ — Dashboard ═══ */

async function renderHQDashboard() {
  try {
    var results = await Promise.allSettled([
      fetchProjects(),
      fetchTasks(),
      fetchComplianceItems(),
      fetchLicenses(),
      fetchEmployees()
    ]);
    var projects = (results[0].status === 'fulfilled') ? results[0].value : [];
    var tasks = (results[1].status === 'fulfilled') ? results[1].value : [];
    var compliance = (results[2].status === 'fulfilled') ? results[2].value : [];
    var licenses = (results[3].status === 'fulfilled') ? results[3].value : [];
    var employees = (results[4].status === 'fulfilled') ? results[4].value : [];

    /* KPI Cards */
    var activeProjects = projects.filter(function(p) { return p.status !== 'Archived' && p.status !== 'Done'; }).length;
    var openTasks = tasks.filter(function(t) { return t.status !== 'Done'; }).length;

    var now = new Date(); now.setHours(0,0,0,0);
    var thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    var expiringLicenses = licenses.filter(function(l) {
      if (!l.expiration_date || l.status === 'Revoked') return false;
      var exp = new Date(l.expiration_date);
      return exp <= thirtyDays;
    }).length;

    var overdueCompliance = compliance.filter(function(c) {
      if (!c.due_date) return false;
      return new Date(c.due_date) < now && c.status !== 'Compliant' && c.status !== 'Not Applicable';
    }).length;

    var activeEmployees = employees.filter(function(e) { return e.status === 'Active'; }).length;

    var kpiHtml = '';
    kpiHtml += '<div class="kpi-card">';
    kpiHtml += '<div class="kpi-icon teal"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg></div>';
    kpiHtml += '<div class="kpi-label">Active Projects</div>';
    kpiHtml += '<div class="kpi-value">' + activeProjects + '</div>';
    kpiHtml += '<div class="kpi-delta" style="color:var(--color-tx-muted);">' + openTasks + ' open tasks</div>';
    kpiHtml += '</div>';

    kpiHtml += '<div class="kpi-card">';
    kpiHtml += '<div class="kpi-icon ' + (overdueCompliance > 0 ? 'red' : 'green') + '"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>';
    kpiHtml += '<div class="kpi-label">Compliance</div>';
    kpiHtml += '<div class="kpi-value">' + (overdueCompliance > 0 ? overdueCompliance + ' Overdue' : 'All Clear') + '</div>';
    kpiHtml += '<div class="kpi-delta" style="color:var(--color-tx-muted);">' + compliance.length + ' total items tracked</div>';
    kpiHtml += '</div>';

    kpiHtml += '<div class="kpi-card">';
    kpiHtml += '<div class="kpi-icon ' + (expiringLicenses > 0 ? 'orange' : 'blue') + '"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/></svg></div>';
    kpiHtml += '<div class="kpi-label">Licenses</div>';
    kpiHtml += '<div class="kpi-value">' + licenses.length + '</div>';
    kpiHtml += '<div class="kpi-delta" style="color:' + (expiringLicenses > 0 ? 'var(--color-warning)' : 'var(--color-tx-muted)') + ';">' + (expiringLicenses > 0 ? expiringLicenses + ' expiring soon' : 'All current') + '</div>';
    kpiHtml += '</div>';

    kpiHtml += '<div class="kpi-card">';
    kpiHtml += '<div class="kpi-icon blue"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>';
    kpiHtml += '<div class="kpi-label">Employees</div>';
    kpiHtml += '<div class="kpi-value">' + activeEmployees + '</div>';
    kpiHtml += '<div class="kpi-delta" style="color:var(--color-tx-muted);">' + employees.length + ' total records</div>';
    kpiHtml += '</div>';

    document.getElementById('dashboard-kpis').innerHTML = kpiHtml;

    /* Upcoming Deadlines */
    var deadlines = [];
    compliance.forEach(function(c) {
      if (c.due_date && c.status !== 'Compliant' && c.status !== 'Not Applicable') {
        deadlines.push({ type: 'Compliance', title: c.title, date: c.due_date, status: c.status });
      }
    });
    licenses.forEach(function(l) {
      if (l.expiration_date && l.status !== 'Revoked') {
        deadlines.push({ type: 'License', title: l.license_type + ' (' + l.state + ')', date: l.expiration_date, status: l.status });
      }
    });
    tasks.forEach(function(t) {
      if (t.due_date && t.status !== 'Done') {
        deadlines.push({ type: 'Task', title: t.title, date: t.due_date, status: t.status });
      }
    });
    deadlines.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
    var upcomingDeadlines = deadlines.slice(0, 8);

    var deadlineHtml = '';
    if (upcomingDeadlines.length === 0) {
      deadlineHtml = '<div class="empty-state"><div class="empty-state-title">No upcoming deadlines</div></div>';
    } else {
      deadlineHtml = '<div class="activity-feed">';
      upcomingDeadlines.forEach(function(d) {
        var days = daysUntil(d.date);
        var dotColor = days < 0 ? 'var(--color-error)' : days <= 7 ? 'var(--color-warning)' : days <= 30 ? 'var(--color-orange)' : 'var(--color-success)';
        var timeText = days < 0 ? Math.abs(days) + ' days overdue' : days === 0 ? 'Due today' : days + ' days remaining';
        deadlineHtml += '<div class="activity-item">';
        deadlineHtml += '<div class="activity-dot" style="background:' + dotColor + ';"></div>';
        deadlineHtml += '<div style="flex:1;">';
        deadlineHtml += '<div class="activity-text">' + escapeHtml(d.title) + '</div>';
        deadlineHtml += '<div class="activity-time"><span class="badge badge-muted" style="margin-right:0.25rem;">' + escapeHtml(d.type) + '</span> ' + formatDate(d.date) + ' &middot; ' + timeText + '</div>';
        deadlineHtml += '</div></div>';
      });
      deadlineHtml += '</div>';
    }
    document.getElementById('dashboard-deadlines').innerHTML = deadlineHtml;

    /* Recent Activity — placeholder until audit log is built */
    var activityHtml = '<div class="activity-feed">';
    activityHtml += '<div class="activity-item"><div class="activity-dot" style="background:var(--color-primary);"></div><div style="flex:1;"><div class="activity-text">HQ Dashboard loaded</div><div class="activity-time">Just now</div></div></div>';
    if (projects.length > 0) {
      var latestProject = projects[0];
      activityHtml += '<div class="activity-item"><div class="activity-dot" style="background:var(--color-blue);"></div><div style="flex:1;"><div class="activity-text">Latest project: ' + escapeHtml(latestProject.name) + '</div><div class="activity-time">' + formatDateTime(latestProject.created_at) + '</div></div></div>';
    }
    activityHtml += '</div>';
    document.getElementById('dashboard-activity').innerHTML = activityHtml;

  } catch (err) {
    console.error('[renderHQDashboard]', err);
    showToast('Failed to load dashboard data.', 'error');
  }
}
