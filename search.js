/* ═══ Atlas HQ — AI Search ═══ */

/* Local full-text search across all HQ data.
   Claude API integration via Cloudflare Worker will be added in a future session. */

var _searchDebounce = null;

async function executeAISearch(query) {
  if (!query || !query.trim()) return;
  query = query.trim().toLowerCase();

  var resultsEl = document.getElementById('ai-search-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div class="search-loading"><span>Searching...</span></div>';

  try {
    var results = await Promise.allSettled([
      fetchProjects(),
      fetchTasks(),
      fetchComplianceItems(),
      fetchLicenses(),
      fetchEmployees(),
      fetchDocuments()
    ]);

    var projects = (results[0].status === 'fulfilled') ? results[0].value : [];
    var tasks = (results[1].status === 'fulfilled') ? results[1].value : [];
    var compliance = (results[2].status === 'fulfilled') ? results[2].value : [];
    var licenses = (results[3].status === 'fulfilled') ? results[3].value : [];
    var employees = (results[4].status === 'fulfilled') ? results[4].value : [];
    var documents = (results[5].status === 'fulfilled') ? results[5].value : [];

    var matches = [];

    /* Search projects */
    projects.forEach(function(p) {
      var text = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
      if (text.indexOf(query) !== -1) {
        matches.push({ type: 'Project', title: p.name, meta: p.status + ' &middot; ' + (p.priority || 'Medium') + ' priority', page: 'projects', iconBg: 'var(--color-primary-hl)', iconColor: 'var(--color-primary)', icon: 'PRJ' });
      }
    });

    /* Search tasks */
    tasks.forEach(function(t) {
      var text = ((t.title || '') + ' ' + (t.description || '')).toLowerCase();
      if (text.indexOf(query) !== -1) {
        matches.push({ type: 'Task', title: t.title, meta: t.status + (t.due_date ? ' &middot; Due ' + formatDate(t.due_date) : ''), page: 'projects', iconBg: 'var(--color-blue-hl)', iconColor: 'var(--color-blue)', icon: 'TSK' });
      }
    });

    /* Search compliance */
    compliance.forEach(function(c) {
      var text = ((c.title || '') + ' ' + (c.description || '') + ' ' + (c.notes || '') + ' ' + (c.category || '')).toLowerCase();
      if (text.indexOf(query) !== -1) {
        matches.push({ type: 'Compliance', title: c.title, meta: c.category + ' &middot; ' + c.status + (c.state ? ' &middot; ' + c.state : ''), page: 'compliance', iconBg: 'var(--color-success-hl)', iconColor: 'var(--color-success)', icon: 'CMP' });
      }
    });

    /* Search licenses */
    licenses.forEach(function(l) {
      var text = ((l.license_type || '') + ' ' + (l.license_number || '') + ' ' + (l.state || '') + ' ' + (l.issuing_authority || '') + ' ' + (l.notes || '')).toLowerCase();
      if (text.indexOf(query) !== -1) {
        matches.push({ type: 'License', title: l.license_type + ' (' + l.state + ')', meta: (l.license_number || 'No number') + ' &middot; ' + l.status, page: 'licensing', iconBg: 'var(--color-orange-hl)', iconColor: 'var(--color-orange)', icon: 'LIC' });
      }
    });

    /* Search employees */
    employees.forEach(function(e) {
      var text = ((e.first_name || '') + ' ' + (e.last_name || '') + ' ' + (e.email || '') + ' ' + (e.role || '') + ' ' + (e.department || '')).toLowerCase();
      if (text.indexOf(query) !== -1) {
        matches.push({ type: 'Employee', title: (e.first_name || '') + ' ' + (e.last_name || ''), meta: (e.department || 'No dept') + ' &middot; ' + (e.role || 'No role') + ' &middot; ' + e.status, page: 'hr', iconBg: 'var(--color-warning-hl)', iconColor: 'var(--color-warning)', icon: 'EMP' });
      }
    });

    /* Search documents */
    documents.forEach(function(d) {
      var text = ((d.name || '') + ' ' + (d.mime_type || '')).toLowerCase();
      if (text.indexOf(query) !== -1) {
        matches.push({ type: 'Document', title: d.name, meta: formatFileSize(d.size_bytes) + ' &middot; ' + formatDate(d.created_at), page: 'documents', iconBg: 'var(--color-error-hl)', iconColor: 'var(--color-error)', icon: 'DOC' });
      }
    });

    /* Render results */
    if (matches.length === 0) {
      resultsEl.innerHTML = '<div class="search-hint">No results found for "' + escapeHtml(query) + '"</div>';
      return;
    }

    var html = '<div style="padding:0.5rem 0.75rem;font-size:var(--text-xs);color:var(--color-tx-muted);">' + matches.length + ' result' + (matches.length !== 1 ? 's' : '') + '</div>';
    matches.slice(0, 20).forEach(function(m) {
      html += '<div class="search-result-item" onclick="closeAISearch();navigateTo(\'' + m.page + '\')">';
      html += '<div class="search-result-icon" style="background:' + m.iconBg + ';color:' + m.iconColor + ';">' + m.icon + '</div>';
      html += '<div><div class="search-result-title">' + escapeHtml(m.title) + '</div>';
      html += '<div class="search-result-meta">' + m.type + ' &middot; ' + m.meta + '</div></div>';
      html += '</div>';
    });
    if (matches.length > 20) {
      html += '<div style="text-align:center;padding:0.75rem;font-size:var(--text-xs);color:var(--color-tx-faint);">+ ' + (matches.length - 20) + ' more results</div>';
    }
    resultsEl.innerHTML = html;
  } catch (err) {
    console.error('[executeAISearch]', err);
    resultsEl.innerHTML = '<div class="search-hint">Search failed. Please try again.</div>';
  }
}
