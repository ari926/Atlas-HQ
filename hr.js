/* ═══ Atlas HQ — Human Resources ═══ */

var _hrTab = 'staff'; /* 'staff' or 'drivers' */

function switchHRTab(tab) {
  _hrTab = tab;
  var staffBtn = document.getElementById('hr-tab-staff');
  var driversBtn = document.getElementById('hr-tab-drivers');
  if (staffBtn) staffBtn.classList.toggle('active', tab === 'staff');
  if (driversBtn) driversBtn.classList.toggle('active', tab === 'drivers');
  renderHR();
}

async function renderHR() {
  try {
    var container = document.getElementById('hr-content');
    if (!container) return;

    if (_hrTab === 'staff') {
      await renderHRStaff(container);
    } else {
      await renderHRDrivers(container);
    }
  } catch (err) {
    console.error('[renderHR]', err);
    showToast('Failed to load HR data.', 'error');
  }
}

async function renderHRStaff(container) {
  var employees = await fetchEmployees();

  if (employees.length === 0) {
    container.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><div class="empty-state-title">No employees</div><div class="empty-state-text">Add your first employee to start building the directory.</div><button class="btn btn-primary btn-sm" onclick="openEmployeeModal()">+ Add Employee</button></div>';
    return;
  }

  var html = '<div class="table-wrap"><table class="data-table"><thead><tr>';
  html += '<th>Name</th><th>Email</th><th>Phone</th><th>Department</th><th>Role</th><th>Status</th><th>Hire Date</th><th>Actions</th>';
  html += '</tr></thead><tbody>';

  employees.forEach(function(e) {
    var statusClass = e.status === 'Active' ? 'badge-active' : e.status === 'On Leave' ? 'badge-due-soon' : 'badge-error';
    html += '<tr>';
    html += '<td><strong>' + escapeHtml((e.first_name || '') + ' ' + (e.last_name || '')) + '</strong></td>';
    html += '<td>' + escapeHtml(e.email || '—') + '</td>';
    html += '<td>' + escapeHtml(e.phone || '—') + '</td>';
    html += '<td>' + escapeHtml(e.department || '—') + '</td>';
    html += '<td>' + escapeHtml(e.role || '—') + '</td>';
    html += '<td><span class="badge ' + statusClass + '">' + escapeHtml(e.status) + '</span></td>';
    html += '<td>' + formatDate(e.hire_date) + '</td>';
    html += '<td><button class="btn btn-sm btn-ghost" onclick="openEmployeeModal(\'' + e.id + '\')">Edit</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function renderHRDrivers(container) {
  var drivers = await fetchDrivers();

  if (drivers.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No drivers found</div><div class="empty-state-text">Drivers are managed in Atlas V2 (app.talaria.com).</div></div>';
    return;
  }

  var active = drivers.filter(function(d) { return d.is_active !== false; });
  var inactive = drivers.filter(function(d) { return d.is_active === false; });

  var html = '<p style="font-size:var(--text-xs);color:var(--color-tx-muted);margin-bottom:1rem;">Drivers are managed in Atlas V2. This is a read-only view for reference. ' + active.length + ' active, ' + inactive.length + ' inactive.</p>';
  html += '<div class="table-wrap"><table class="data-table"><thead><tr>';
  html += '<th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th>';
  html += '</tr></thead><tbody>';

  active.forEach(function(d) {
    html += '<tr>';
    html += '<td>' + escapeHtml(d.display_id || '—') + '</td>';
    html += '<td>' + escapeHtml((d.first_name || '') + ' ' + (d.last_name || '')) + '</td>';
    html += '<td>' + escapeHtml(d.email || '—') + '</td>';
    html += '<td>' + escapeHtml(d.phone || '—') + '</td>';
    html += '<td>' + escapeHtml(d.role || '—') + '</td>';
    html += '<td><span class="badge badge-active">Active</span></td>';
    html += '</tr>';
  });
  inactive.forEach(function(d) {
    html += '<tr style="opacity:0.6;">';
    html += '<td>' + escapeHtml(d.display_id || '—') + '</td>';
    html += '<td>' + escapeHtml((d.first_name || '') + ' ' + (d.last_name || '')) + '</td>';
    html += '<td>' + escapeHtml(d.email || '—') + '</td>';
    html += '<td>' + escapeHtml(d.phone || '—') + '</td>';
    html += '<td>' + escapeHtml(d.role || '—') + '</td>';
    html += '<td><span class="badge badge-error">' + escapeHtml(d.inactive_reason || 'Inactive') + '</span></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function openEmployeeModal(employeeId) {
  var title = employeeId ? 'Edit Employee' : 'New Employee';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');
  var emp = null;
  if (employeeId && dataCache.employees) {
    emp = dataCache.employees.filter(function(e) { return e.id === employeeId; })[0];
  }

  function opt(val, label, current) { return '<option value="' + val + '"' + (current === val ? ' selected' : '') + '>' + label + '</option>'; }
  var currentDept = (emp && emp.department) || '';
  var currentStatus = (emp && emp.status) || 'Active';

  body.innerHTML = '<div class="form-grid"><div class="form-row"><label class="field-label">First Name</label><input type="text" id="emp-first" class="input-field" value="' + escapeHtml((emp && emp.first_name) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Last Name</label><input type="text" id="emp-last" class="input-field" value="' + escapeHtml((emp && emp.last_name) || '') + '"></div></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Email</label><input type="email" id="emp-email" class="input-field" value="' + escapeHtml((emp && emp.email) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Phone</label><input type="tel" id="emp-phone" class="input-field" value="' + escapeHtml((emp && emp.phone) || '') + '"></div></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Department</label><select id="emp-dept" class="select-field"><option value="">Select...</option>' + opt('Operations','Operations',currentDept) + opt('Compliance','Compliance',currentDept) + opt('Finance','Finance',currentDept) + opt('HR','HR',currentDept) + opt('IT','IT',currentDept) + opt('Executive','Executive',currentDept) + opt('Other','Other',currentDept) + '</select></div>' +
    '<div class="form-row"><label class="field-label">Role / Title</label><input type="text" id="emp-role" class="input-field" value="' + escapeHtml((emp && emp.role) || '') + '"></div></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Hire Date</label><input type="date" id="emp-hire" class="input-field" value="' + ((emp && emp.hire_date) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Status</label><select id="emp-status" class="select-field">' + opt('Active','Active',currentStatus) + opt('Inactive','Inactive',currentStatus) + opt('On Leave','On Leave',currentStatus) + opt('Terminated','Terminated',currentStatus) + '</select></div></div>' +
    '<div class="form-row"><label class="field-label">Notes</label><textarea id="emp-notes" class="input-field">' + escapeHtml((emp && emp.notes) || '') + '</textarea></div>';

  var footer = document.getElementById('hq-modal-footer');
  if (employeeId) {
    footer.innerHTML = '<button class="btn btn-danger-ghost" onclick="deleteEmployee(\'' + employeeId + '\')">Delete</button><div style="flex:1;"></div><button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Save</button>';
  } else {
    footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Save</button>';
  }
  document.getElementById('hq-modal-save').onclick = function() { saveEmployee(employeeId); };
  openModal('hq-modal');
}

async function saveEmployee(employeeId) {
  var first = document.getElementById('emp-first').value.trim();
  var last = document.getElementById('emp-last').value.trim();
  if (!first || !last) { showToast('First and last name are required.', 'error'); return; }
  var data = {
    first_name: first,
    last_name: last,
    email: document.getElementById('emp-email').value.trim() || null,
    phone: document.getElementById('emp-phone').value.trim() || null,
    department: document.getElementById('emp-dept').value || null,
    role: document.getElementById('emp-role').value.trim() || null,
    hire_date: document.getElementById('emp-hire').value || null,
    status: document.getElementById('emp-status').value,
    notes: document.getElementById('emp-notes').value.trim() || null,
    updated_at: new Date().toISOString()
  };
  try {
    if (employeeId) {
      await resilientWrite(function() { return supabase.from('hq_employees').update(data).eq('id', employeeId); }, 'updateEmployee');
    } else {
      await resilientWrite(function() { return supabase.from('hq_employees').insert(data); }, 'insertEmployee');
    }
    clearCache('employees');
    closeModal('hq-modal');
    renderHR();
    showToast('Employee saved.', 'success');
  } catch (err) { console.error('[saveEmployee]', err); showToast('Failed to save.', 'error'); }
}

function deleteEmployee(employeeId) {
  customConfirm('Delete this employee record?', async function() {
    try {
      await resilientWrite(function() { return supabase.from('hq_employees').delete().eq('id', employeeId); }, 'deleteEmployee');
      clearCache('employees');
      closeModal('hq-modal');
      renderHR();
      showToast('Employee deleted.', 'success');
    } catch (err) { console.error('[deleteEmployee]', err); showToast('Failed to delete.', 'error'); }
  });
}
