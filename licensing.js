/* ═══ Atlas HQ — Licensing ═══ */

async function renderLicensing() {
  try {
    var licenses = await fetchLicenses();
    var container = document.getElementById('licensing-content');
    if (!container) return;

    if (licenses.length === 0) {
      container.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/></svg><div class="empty-state-title">No licenses</div><div class="empty-state-text">Add your first business license to start tracking.</div><button class="btn btn-primary btn-sm" onclick="openLicenseModal()">+ Add License</button></div>';
      return;
    }

    /* Group by state */
    var states = ['PA', 'OH', 'MD', 'NJ', 'MO', 'WV'];
    var stateNames = { PA: 'Pennsylvania', OH: 'Ohio', MD: 'Maryland', NJ: 'New Jersey', MO: 'Missouri', WV: 'West Virginia' };
    var grouped = {};
    states.forEach(function(s) { grouped[s] = []; });
    licenses.forEach(function(l) {
      if (grouped[l.state]) grouped[l.state].push(l);
    });

    var html = '';
    states.forEach(function(state) {
      var stateLicenses = grouped[state];
      if (stateLicenses.length === 0) return;

      html += '<div class="state-group">';
      html += '<div class="state-group-header"><span class="state-badge">' + state + '</span><span class="state-group-title">' + stateNames[state] + ' (' + stateLicenses.length + ')</span></div>';
      html += '<div class="license-grid">';
      stateLicenses.forEach(function(l) {
        var days = daysUntil(l.expiration_date);
        var statusClass, statusText;
        if (l.status === 'Expired' || (days !== null && days < 0)) {
          statusClass = 'badge-expired';
          statusText = l.status === 'Expired' ? 'Expired' : 'Expired ' + Math.abs(days) + 'd ago';
        } else if (l.status === 'Suspended' || l.status === 'Revoked') {
          statusClass = 'badge-error';
          statusText = l.status;
        } else if (l.status === 'Pending Renewal') {
          statusClass = 'badge-due-soon';
          statusText = 'Pending Renewal';
        } else if (days !== null && days <= 30) {
          statusClass = 'badge-due-soon';
          statusText = 'Expires in ' + days + 'd';
        } else {
          statusClass = 'badge-active';
          statusText = 'Active';
        }

        html += '<div class="license-card" onclick="openLicenseModal(\'' + l.id + '\')">';
        html += '<div class="license-card-status"><span class="badge ' + statusClass + '">' + statusText + '</span></div>';
        html += '<div class="license-card-type">' + escapeHtml(l.license_type) + '</div>';
        html += '<div class="license-card-number">' + escapeHtml(l.license_number || 'No number') + '</div>';
        html += '<div class="license-card-detail"><span>Issued</span><span>' + formatDate(l.issued_date) + '</span></div>';
        html += '<div class="license-card-detail"><span>Expires</span><span>' + formatDate(l.expiration_date) + '</span></div>';
        if (l.renewal_date) html += '<div class="license-card-detail"><span>Renewal</span><span>' + formatDate(l.renewal_date) + '</span></div>';
        if (l.issuing_authority) html += '<div class="license-card-detail"><span>Authority</span><span>' + escapeHtml(l.issuing_authority) + '</span></div>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    container.innerHTML = html;
  } catch (err) {
    console.error('[renderLicensing]', err);
    showToast('Failed to load licenses.', 'error');
  }
}

function openLicenseModal(licenseId) {
  var title = licenseId ? 'Edit License' : 'New License';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');
  var lic = null;
  if (licenseId && dataCache.licenses) {
    lic = dataCache.licenses.filter(function(l) { return l.id === licenseId; })[0];
  }

  function opt(val, label, current) { return '<option value="' + val + '"' + (current === val ? ' selected' : '') + '>' + label + '</option>'; }
  var currentState = (lic && lic.state) || 'PA';
  var currentStatus = (lic && lic.status) || 'Active';

  body.innerHTML = '<div class="form-row"><label class="field-label">License Type</label><input type="text" id="lic-type" class="input-field" placeholder="e.g. Distributor License" value="' + escapeHtml((lic && lic.license_type) || '') + '"></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">License Number</label><input type="text" id="lic-number" class="input-field" value="' + escapeHtml((lic && lic.license_number) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">State</label><select id="lic-state" class="select-field">' + opt('PA','Pennsylvania',currentState) + opt('OH','Ohio',currentState) + opt('MD','Maryland',currentState) + opt('NJ','New Jersey',currentState) + opt('MO','Missouri',currentState) + opt('WV','West Virginia',currentState) + '</select></div></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Issued Date</label><input type="date" id="lic-issued" class="input-field" value="' + ((lic && lic.issued_date) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Expiration Date</label><input type="date" id="lic-expires" class="input-field" value="' + ((lic && lic.expiration_date) || '') + '"></div></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Renewal Date</label><input type="date" id="lic-renewal" class="input-field" value="' + ((lic && lic.renewal_date) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Status</label><select id="lic-status" class="select-field">' + opt('Active','Active',currentStatus) + opt('Pending Renewal','Pending Renewal',currentStatus) + opt('Expired','Expired',currentStatus) + opt('Suspended','Suspended',currentStatus) + opt('Revoked','Revoked',currentStatus) + '</select></div></div>' +
    '<div class="form-row"><label class="field-label">Issuing Authority</label><input type="text" id="lic-authority" class="input-field" value="' + escapeHtml((lic && lic.issuing_authority) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Notes</label><textarea id="lic-notes" class="input-field">' + escapeHtml((lic && lic.notes) || '') + '</textarea></div>';

  var footer = document.getElementById('hq-modal-footer');
  if (licenseId) {
    footer.innerHTML = '<button class="btn btn-danger-ghost" onclick="deleteLicense(\'' + licenseId + '\')">Delete</button><div style="flex:1;"></div><button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Save</button>';
  } else {
    footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Save</button>';
  }
  document.getElementById('hq-modal-save').onclick = function() { saveLicense(licenseId); };
  openModal('hq-modal');
}

async function saveLicense(licenseId) {
  var licType = document.getElementById('lic-type').value.trim();
  if (!licType) { showToast('License type is required.', 'error'); return; }
  var data = {
    license_type: licType,
    license_number: document.getElementById('lic-number').value.trim(),
    state: document.getElementById('lic-state').value,
    issued_date: document.getElementById('lic-issued').value || null,
    expiration_date: document.getElementById('lic-expires').value || null,
    renewal_date: document.getElementById('lic-renewal').value || null,
    status: document.getElementById('lic-status').value,
    issuing_authority: document.getElementById('lic-authority').value.trim(),
    notes: document.getElementById('lic-notes').value.trim(),
    updated_at: new Date().toISOString()
  };
  try {
    if (licenseId) {
      await resilientWrite(function() { return supabase.from('hq_licenses').update(data).eq('id', licenseId); }, 'updateLicense');
    } else {
      await resilientWrite(function() { return supabase.from('hq_licenses').insert(data); }, 'insertLicense');
    }
    clearCache('licenses');
    closeModal('hq-modal');
    renderLicensing();
    showToast('License saved.', 'success');
  } catch (err) { console.error('[saveLicense]', err); showToast('Failed to save.', 'error'); }
}

function deleteLicense(licenseId) {
  customConfirm('Delete this license?', async function() {
    try {
      await resilientWrite(function() { return supabase.from('hq_licenses').delete().eq('id', licenseId); }, 'deleteLicense');
      clearCache('licenses');
      closeModal('hq-modal');
      renderLicensing();
      showToast('License deleted.', 'success');
    } catch (err) { console.error('[deleteLicense]', err); showToast('Failed to delete.', 'error'); }
  });
}
