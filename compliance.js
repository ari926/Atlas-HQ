/* ═══ Atlas HQ — Compliance ═══ */

async function renderCompliance() {
  try {
    var items = await fetchComplianceItems();
    var container = document.getElementById('compliance-content');
    if (!container) return;

    /* Apply filters */
    var catFilter = document.getElementById('compliance-filter-category');
    var statusFilter = document.getElementById('compliance-filter-status');
    var stateFilter = document.getElementById('compliance-filter-state');
    var category = catFilter ? catFilter.value : '';
    var status = statusFilter ? statusFilter.value : '';
    var state = stateFilter ? stateFilter.value : '';

    var filtered = items.filter(function(item) {
      if (category && item.category !== category) return false;
      if (status && item.status !== status) return false;
      if (state && item.state !== state) return false;
      return true;
    });

    if (filtered.length === 0 && items.length === 0) {
      container.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><div class="empty-state-title">No compliance items</div><div class="empty-state-text">Add your first compliance requirement to start tracking.</div><button class="btn btn-primary btn-sm" onclick="openComplianceModal()">+ Add Item</button></div>';
      return;
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No items match filters</div><div class="empty-state-text">Try adjusting your filter criteria.</div></div>';
      return;
    }

    var html = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
    filtered.forEach(function(item) {
      var dotColor = 'gray';
      if (item.status === 'Compliant') dotColor = 'green';
      else if (item.status === 'Due Soon') dotColor = 'amber';
      else if (item.status === 'Overdue') dotColor = 'red';
      else if (item.status === 'In Progress') dotColor = 'blue';

      var dueText = '';
      if (item.due_date) {
        var days = daysUntil(item.due_date);
        dueText = 'Due: ' + formatDate(item.due_date);
        if (days < 0) dueText += ' (' + Math.abs(days) + ' days overdue)';
        else if (days === 0) dueText += ' (Due today)';
        else if (days <= 30) dueText += ' (' + days + ' days)';
      }

      html += '<div class="compliance-item" onclick="openComplianceModal(\'' + item.id + '\')">';
      html += '<div class="compliance-dot ' + dotColor + '"></div>';
      html += '<div class="compliance-info">';
      html += '<div class="compliance-title">' + escapeHtml(item.title) + '</div>';
      html += '<div class="compliance-due">';
      html += '<span class="badge badge-muted" style="margin-right:0.375rem;">' + escapeHtml(item.category) + '</span>';
      if (item.state) html += '<span class="badge badge-primary" style="margin-right:0.375rem;">' + escapeHtml(item.state) + '</span>';
      if (dueText) html += dueText;
      html += '</div></div>';
      var statusClass = item.status === 'Compliant' ? 'badge-compliant' : item.status === 'Due Soon' ? 'badge-due-soon' : item.status === 'Overdue' ? 'badge-overdue' : item.status === 'In Progress' ? 'badge-in-progress' : 'badge-pending';
      html += '<span class="badge ' + statusClass + '">' + escapeHtml(item.status) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    console.error('[renderCompliance]', err);
    showToast('Failed to load compliance data.', 'error');
  }
}

function openComplianceModal(itemId) {
  var title = itemId ? 'Edit Compliance Item' : 'New Compliance Item';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');
  var item = null;
  if (itemId && dataCache.compliance) {
    item = dataCache.compliance.filter(function(c) { return c.id === itemId; })[0];
  }

  function opt(val, label, current) { return '<option value="' + val + '"' + (current === val ? ' selected' : '') + '>' + label + '</option>'; }
  var currentCat = (item && item.category) || '';
  var currentStatus = (item && item.status) || 'Pending';
  var currentState = (item && item.state) || '';

  body.innerHTML = '<div class="form-row"><label class="field-label">Title</label><input type="text" id="comp-title" class="input-field" value="' + escapeHtml((item && item.title) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Description</label><textarea id="comp-desc" class="input-field">' + escapeHtml((item && item.description) || '') + '</textarea></div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label class="field-label">Category</label><select id="comp-category" class="select-field">' + opt('State License','State License',currentCat) + opt('Inspection','Inspection',currentCat) + opt('Audit','Audit',currentCat) + opt('Training','Training',currentCat) + opt('Regulatory Filing','Regulatory Filing',currentCat) + opt('Other','Other',currentCat) + '</select></div>' +
    '<div class="form-row"><label class="field-label">Status</label><select id="comp-status" class="select-field">' + opt('Pending','Pending',currentStatus) + opt('In Progress','In Progress',currentStatus) + opt('Due Soon','Due Soon',currentStatus) + opt('Compliant','Compliant',currentStatus) + opt('Overdue','Overdue',currentStatus) + opt('Not Applicable','Not Applicable',currentStatus) + '</select></div></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Due Date</label><input type="date" id="comp-due" class="input-field" value="' + ((item && item.due_date) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">State</label><select id="comp-state" class="select-field"><option value="">N/A</option>' + opt('PA','Pennsylvania',currentState) + opt('OH','Ohio',currentState) + opt('MD','Maryland',currentState) + opt('NJ','New Jersey',currentState) + opt('MO','Missouri',currentState) + opt('WV','West Virginia',currentState) + '</select></div></div>' +
    '<div class="form-row"><label class="field-label">Notes</label><textarea id="comp-notes" class="input-field">' + escapeHtml((item && item.notes) || '') + '</textarea></div>';

  if (itemId) {
    var footer = document.getElementById('hq-modal-footer');
    footer.innerHTML = '<button class="btn btn-danger-ghost" onclick="deleteComplianceItem(\'' + itemId + '\')">Delete</button><div style="flex:1;"></div><button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Save</button>';
    document.getElementById('hq-modal-save').onclick = function() { saveComplianceItem(itemId); };
  } else {
    var footer = document.getElementById('hq-modal-footer');
    footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Save</button>';
    document.getElementById('hq-modal-save').onclick = function() { saveComplianceItem(null); };
  }
  openModal('hq-modal');
}

async function saveComplianceItem(itemId) {
  var title = document.getElementById('comp-title').value.trim();
  if (!title) { showToast('Title is required.', 'error'); return; }
  var data = {
    title: title,
    description: document.getElementById('comp-desc').value.trim(),
    category: document.getElementById('comp-category').value,
    status: document.getElementById('comp-status').value,
    due_date: document.getElementById('comp-due').value || null,
    state: document.getElementById('comp-state').value || null,
    notes: document.getElementById('comp-notes').value.trim(),
    updated_at: new Date().toISOString()
  };
  try {
    if (itemId) {
      await resilientWrite(function() { return supabase.from('hq_compliance_items').update(data).eq('id', itemId); }, 'updateCompliance');
    } else {
      await resilientWrite(function() { return supabase.from('hq_compliance_items').insert(data); }, 'insertCompliance');
    }
    clearCache('compliance');
    closeModal('hq-modal');
    renderCompliance();
    showToast('Compliance item saved.', 'success');
  } catch (err) { console.error('[saveComplianceItem]', err); showToast('Failed to save.', 'error'); }
}

function deleteComplianceItem(itemId) {
  customConfirm('Delete this compliance item?', async function() {
    try {
      await resilientWrite(function() { return supabase.from('hq_compliance_items').delete().eq('id', itemId); }, 'deleteCompliance');
      clearCache('compliance');
      closeModal('hq-modal');
      renderCompliance();
      showToast('Item deleted.', 'success');
    } catch (err) { console.error('[deleteComplianceItem]', err); showToast('Failed to delete.', 'error'); }
  });
}
