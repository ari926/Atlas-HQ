/* ═══ Atlas HQ — Automations Engine ═══ */

var _projectAutomations = [];

/* ─── Trigger & Action Definitions ─── */
var AUTOMATION_TRIGGERS = [
  { type: 'status_changed', label: 'Status changes', icon: 'S', color: '#00c875',
    desc: 'When a status column changes to a specific value' },
  { type: 'person_assigned', label: 'Person is assigned', icon: 'P', color: '#579bfc',
    desc: 'When someone is assigned to an item' },
  { type: 'item_created', label: 'Item is created', icon: '+', color: '#fdab3d',
    desc: 'When a new item is added to the board' },
  { type: 'date_arrived', label: 'Date arrives', icon: 'D', color: '#e2445c',
    desc: 'When a date column reaches today' },
  { type: 'group_changed', label: 'Item moves to group', icon: 'G', color: '#a25ddc',
    desc: 'When an item is moved to a specific group' }
];

var AUTOMATION_ACTIONS = [
  { type: 'set_status', label: 'Set status', icon: 'S', color: '#00c875',
    desc: 'Change a status column to a value' },
  { type: 'assign_person', label: 'Assign person', icon: 'P', color: '#579bfc',
    desc: 'Assign a person to the item' },
  { type: 'move_to_group', label: 'Move to group', icon: 'G', color: '#a25ddc',
    desc: 'Move the item to a different group' },
  { type: 'send_notification', label: 'Send notification', icon: 'N', color: '#0086c0',
    desc: 'Send an in-app notification' },
  { type: 'set_date', label: 'Set date', icon: 'D', color: '#fdab3d',
    desc: 'Set a date column to a value (e.g., today + N days)' }
];

/* ─── Fetch Automations ─── */
async function fetchAutomations(projectId, force) {
  if (!projectId) return [];
  if (!force && _projectAutomations.length > 0 && _projectAutomations[0] && _projectAutomations[0].project_id === projectId) return _projectAutomations;
  try {
    var result = await resilientQuery(function() {
      return sb.from('hq_automations').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    }, 'fetchAutomations');
    _projectAutomations = result.data || [];
  } catch (err) {
    console.error('[fetchAutomations]', err);
    _projectAutomations = [];
  }
  return _projectAutomations;
}

/* ─── Check & Execute Automations ─── */
function checkAutomations(triggerType, context) {
  if (!_projectAutomations || _projectAutomations.length === 0) return;

  _projectAutomations.forEach(function(auto) {
    if (!auto.is_active) return;
    if (!matchesTrigger(auto, triggerType, context)) return;

    /* Execute the action */
    executeAutomationAction(auto, context);
  });
}

function matchesTrigger(auto, triggerType, context) {
  var triggerMap = {
    'value_changed': function() {
      if (auto.trigger_type === 'status_changed') {
        var cfg = auto.trigger_config || {};
        if (cfg.column_id && cfg.column_id !== context.colId) return false;
        if (cfg.value && cfg.value !== context.newValue) return false;
        if (context.colType !== 'status' && context.colType !== 'priority') return false;
        return true;
      }
      if (auto.trigger_type === 'person_assigned') {
        if (context.colType !== 'person') return false;
        if (!context.newValue) return false;
        var cfg2 = auto.trigger_config || {};
        if (cfg2.person_id && cfg2.person_id !== context.newValue) return false;
        return true;
      }
      return false;
    },
    'item_created': function() {
      if (auto.trigger_type !== 'item_created') return false;
      var cfg = auto.trigger_config || {};
      if (cfg.group_id && cfg.group_id !== context.groupId) return false;
      return true;
    },
    'group_changed': function() {
      if (auto.trigger_type !== 'group_changed') return false;
      var cfg = auto.trigger_config || {};
      if (cfg.group_id && cfg.group_id !== context.newGroupId) return false;
      return true;
    }
  };

  var checker = triggerMap[triggerType];
  return checker ? checker() : false;
}

function executeAutomationAction(auto, context) {
  var taskId = context.taskId;
  if (!taskId) return;

  var cfg = auto.action_config || {};

  switch (auto.action_type) {
    case 'set_status':
      if (cfg.column_id && cfg.value) {
        saveCellValue(taskId, cfg.column_id, cfg.value);
        showToast('Automation "' + (auto.name || 'Untitled') + '" ran.', 'info');
      }
      break;

    case 'assign_person':
      if (cfg.column_id && cfg.person_id) {
        saveCellValue(taskId, cfg.column_id, cfg.person_id);
        showToast('Automation "' + (auto.name || 'Untitled') + '" ran.', 'info');
      }
      break;

    case 'move_to_group':
      if (cfg.group_id) {
        moveTaskToGroup(taskId, cfg.group_id);
        showToast('Automation "' + (auto.name || 'Untitled') + '" ran.', 'info');
      }
      break;

    case 'send_notification':
      if (cfg.message) {
        /* Notify the assigned person or all staff */
        var personCol = _boardColumns.find(function(c) { return c.type === 'person'; });
        var assignedId = personCol && _boardTaskValues[taskId] ? _boardTaskValues[taskId][personCol.id] : null;
        var task = _boardTasks.find(function(t) { return t.id === taskId; });
        if (assignedId) {
          sendInAppNotification(assignedId, cfg.message, 'Automation: ' + (auto.name || 'Untitled'), '#projects', taskId);
        }
        showToast('Automation "' + (auto.name || 'Untitled') + '" sent notification.', 'info');
      }
      break;

    case 'set_date':
      if (cfg.column_id) {
        var d = new Date();
        if (cfg.offset_days) d.setDate(d.getDate() + parseInt(cfg.offset_days, 10));
        var dateVal = d.toISOString().substring(0, 10);
        saveCellValue(taskId, cfg.column_id, dateVal);
        showToast('Automation "' + (auto.name || 'Untitled') + '" set date.', 'info');
      }
      break;

    default:
      console.warn('[Automation] Unknown action type:', auto.action_type);
  }
}

/* ─── Automations Panel (Modal) ─── */
async function openAutomationsPanel() {
  if (!_currentProjectId) { showToast('Select a board first.', 'error'); return; }

  var automations = await fetchAutomations(_currentProjectId, true);
  var title = 'Automations';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');

  var html = '<div style="margin-bottom:1rem;">';
  html += '<button class="btn btn-primary btn-sm" onclick="renderAutomationBuilder()">+ New Automation</button>';
  html += '</div>';

  if (automations.length === 0) {
    html += '<div class="empty-state" style="padding:2rem;">';
    html += '<div class="empty-state-title">No automations yet</div>';
    html += '<div class="empty-state-text">Automate repetitive tasks by creating rules that trigger actions.</div>';
    html += '</div>';
  } else {
    html += '<div class="automation-list">';
    automations.forEach(function(a) {
      var triggerDef = AUTOMATION_TRIGGERS.find(function(t) { return t.type === a.trigger_type; }) || { label: a.trigger_type, color: '#c4c4c4', icon: '?' };
      var actionDef = AUTOMATION_ACTIONS.find(function(act) { return act.type === a.action_type; }) || { label: a.action_type };
      html += '<div class="automation-card">';
      html += '<div class="automation-icon" style="background:' + triggerDef.color + '22;color:' + triggerDef.color + ';">' + triggerDef.icon + '</div>';
      html += '<div class="automation-info">';
      html += '<div class="automation-name">' + escapeHtml(a.name || 'Untitled') + '</div>';
      html += '<div class="automation-desc">When ' + escapeHtml(triggerDef.label) + ' &rarr; ' + escapeHtml(actionDef.label) + '</div>';
      html += '</div>';
      html += '<div class="automation-actions">';
      html += '<label class="toggle-switch" title="' + (a.is_active ? 'Active' : 'Inactive') + '"><input type="checkbox"' + (a.is_active ? ' checked' : '') + ' onchange="toggleAutomation(\'' + a.id + '\',this.checked)"><span class="toggle-slider"></span></label>';
      html += '<button class="btn btn-ghost btn-sm" onclick="renderAutomationBuilder(\'' + a.id + '\')">Edit</button>';
      html += '<button class="btn btn-danger-ghost btn-sm" onclick="deleteAutomation(\'' + a.id + '\')">&times;</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  body.innerHTML = html;
  var footer = document.getElementById('hq-modal-footer');
  footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Close</button>';
  openModal('hq-modal');
}

/* ─── Automation Builder ─── */
function renderAutomationBuilder(automationId) {
  var auto = null;
  if (automationId) {
    auto = _projectAutomations.find(function(a) { return a.id === automationId; });
  }

  var title = auto ? 'Edit Automation' : 'New Automation';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');

  var html = '';
  html += '<div class="form-row"><label class="field-label">Automation Name</label>';
  html += '<input type="text" id="auto-name" class="input-field" placeholder="e.g., When done, move to Done group" value="' + escapeHtml((auto && auto.name) || '') + '"></div>';

  /* Trigger step */
  html += '<div class="automation-builder-step">';
  html += '<div class="automation-builder-step-title">When this happens...</div>';
  html += '<select id="auto-trigger-type" class="select-field" onchange="onAutomationTriggerChange()">';
  html += '<option value="">Select a trigger</option>';
  AUTOMATION_TRIGGERS.forEach(function(t) {
    html += '<option value="' + t.type + '"' + (auto && auto.trigger_type === t.type ? ' selected' : '') + '>' + escapeHtml(t.label) + '</option>';
  });
  html += '</select>';
  html += '<div id="auto-trigger-config" style="margin-top:0.75rem;"></div>';
  html += '</div>';

  html += '<div class="automation-arrow">&#8595;</div>';

  /* Action step */
  html += '<div class="automation-builder-step">';
  html += '<div class="automation-builder-step-title">Do this...</div>';
  html += '<select id="auto-action-type" class="select-field" onchange="onAutomationActionChange()">';
  html += '<option value="">Select an action</option>';
  AUTOMATION_ACTIONS.forEach(function(a2) {
    html += '<option value="' + a2.type + '"' + (auto && auto.action_type === a2.type ? ' selected' : '') + '>' + escapeHtml(a2.label) + '</option>';
  });
  html += '</select>';
  html += '<div id="auto-action-config" style="margin-top:0.75rem;"></div>';
  html += '</div>';

  body.innerHTML = html;

  /* Show existing config */
  if (auto) {
    window._autoEditTriggerConfig = auto.trigger_config || {};
    window._autoEditActionConfig = auto.action_config || {};
    onAutomationTriggerChange();
    onAutomationActionChange();
  } else {
    window._autoEditTriggerConfig = {};
    window._autoEditActionConfig = {};
  }

  var footer = document.getElementById('hq-modal-footer');
  footer.innerHTML = '<button class="btn btn-secondary" onclick="openAutomationsPanel()">Back</button><button class="btn btn-primary" onclick="saveAutomation(\'' + (automationId || '') + '\')">Save</button>';
}

function onAutomationTriggerChange() {
  var type = document.getElementById('auto-trigger-type').value;
  var container = document.getElementById('auto-trigger-config');
  if (!container) return;
  var cfg = window._autoEditTriggerConfig || {};
  var html = '';

  if (type === 'status_changed') {
    html += '<label class="field-label">Column</label>';
    html += '<select id="auto-trigger-col" class="select-field" style="margin-bottom:0.5rem;">';
    html += '<option value="">Any status column</option>';
    _boardColumns.forEach(function(c) {
      if (c.type === 'status' || c.type === 'priority') {
        html += '<option value="' + c.id + '"' + (cfg.column_id === c.id ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
      }
    });
    html += '</select>';
    html += '<label class="field-label">Value</label>';
    html += '<input type="text" id="auto-trigger-val" class="input-field" placeholder="e.g., Done" value="' + escapeHtml(cfg.value || '') + '">';
  } else if (type === 'person_assigned') {
    html += '<label class="field-label">Specific person (optional)</label>';
    html += '<select id="auto-trigger-person" class="select-field">';
    html += '<option value="">Any person</option>';
    _boardStaff.forEach(function(s) {
      var pid = s.auth_user_id || s.id;
      var pName = ((s.first_name || '') + ' ' + (s.last_name || '')).trim();
      html += '<option value="' + pid + '"' + (cfg.person_id === pid ? ' selected' : '') + '>' + escapeHtml(pName) + '</option>';
    });
    html += '</select>';
  } else if (type === 'item_created' || type === 'group_changed') {
    html += '<label class="field-label">In group (optional)</label>';
    html += '<select id="auto-trigger-group" class="select-field">';
    html += '<option value="">Any group</option>';
    _boardGroups.forEach(function(g) {
      html += '<option value="' + g.id + '"' + (cfg.group_id === g.id ? ' selected' : '') + '>' + escapeHtml(g.name) + '</option>';
    });
    html += '</select>';
  } else if (type === 'date_arrived') {
    html += '<label class="field-label">Date column</label>';
    html += '<select id="auto-trigger-datecol" class="select-field">';
    _boardColumns.forEach(function(c) {
      if (c.type === 'date') {
        html += '<option value="' + c.id + '"' + (cfg.column_id === c.id ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
      }
    });
    html += '</select>';
  }

  container.innerHTML = html;
}

function onAutomationActionChange() {
  var type = document.getElementById('auto-action-type').value;
  var container = document.getElementById('auto-action-config');
  if (!container) return;
  var cfg = window._autoEditActionConfig || {};
  var html = '';

  if (type === 'set_status') {
    html += '<label class="field-label">Column</label>';
    html += '<select id="auto-action-col" class="select-field" style="margin-bottom:0.5rem;">';
    _boardColumns.forEach(function(c) {
      if (c.type === 'status' || c.type === 'priority') {
        html += '<option value="' + c.id + '"' + (cfg.column_id === c.id ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
      }
    });
    html += '</select>';
    html += '<label class="field-label">Set to</label>';
    html += '<input type="text" id="auto-action-val" class="input-field" placeholder="e.g., Done" value="' + escapeHtml(cfg.value || '') + '">';
  } else if (type === 'assign_person') {
    html += '<label class="field-label">Person column</label>';
    html += '<select id="auto-action-col" class="select-field" style="margin-bottom:0.5rem;">';
    _boardColumns.forEach(function(c) {
      if (c.type === 'person') {
        html += '<option value="' + c.id + '"' + (cfg.column_id === c.id ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
      }
    });
    html += '</select>';
    html += '<label class="field-label">Assign to</label>';
    html += '<select id="auto-action-person" class="select-field">';
    _boardStaff.forEach(function(s) {
      var pid = s.auth_user_id || s.id;
      var pName = ((s.first_name || '') + ' ' + (s.last_name || '')).trim();
      html += '<option value="' + pid + '"' + (cfg.person_id === pid ? ' selected' : '') + '>' + escapeHtml(pName) + '</option>';
    });
    html += '</select>';
  } else if (type === 'move_to_group') {
    html += '<label class="field-label">Move to group</label>';
    html += '<select id="auto-action-group" class="select-field">';
    _boardGroups.forEach(function(g) {
      html += '<option value="' + g.id + '"' + (cfg.group_id === g.id ? ' selected' : '') + '>' + escapeHtml(g.name) + '</option>';
    });
    html += '</select>';
  } else if (type === 'send_notification') {
    html += '<label class="field-label">Notification message</label>';
    html += '<input type="text" id="auto-action-msg" class="input-field" placeholder="e.g., Task requires review" value="' + escapeHtml(cfg.message || '') + '">';
  } else if (type === 'set_date') {
    html += '<label class="field-label">Date column</label>';
    html += '<select id="auto-action-col" class="select-field" style="margin-bottom:0.5rem;">';
    _boardColumns.forEach(function(c) {
      if (c.type === 'date') {
        html += '<option value="' + c.id + '"' + (cfg.column_id === c.id ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
      }
    });
    html += '</select>';
    html += '<label class="field-label">Days from today (0 = today)</label>';
    html += '<input type="number" id="auto-action-offset" class="input-field" value="' + (cfg.offset_days || 0) + '">';
  }

  container.innerHTML = html;
}

function gatherTriggerConfig() {
  var type = document.getElementById('auto-trigger-type').value;
  var cfg = {};
  if (type === 'status_changed') {
    var colEl = document.getElementById('auto-trigger-col');
    var valEl = document.getElementById('auto-trigger-val');
    if (colEl && colEl.value) cfg.column_id = colEl.value;
    if (valEl && valEl.value) cfg.value = valEl.value;
  } else if (type === 'person_assigned') {
    var personEl = document.getElementById('auto-trigger-person');
    if (personEl && personEl.value) cfg.person_id = personEl.value;
  } else if (type === 'item_created' || type === 'group_changed') {
    var groupEl = document.getElementById('auto-trigger-group');
    if (groupEl && groupEl.value) cfg.group_id = groupEl.value;
  } else if (type === 'date_arrived') {
    var dateColEl = document.getElementById('auto-trigger-datecol');
    if (dateColEl && dateColEl.value) cfg.column_id = dateColEl.value;
  }
  return cfg;
}

function gatherActionConfig() {
  var type = document.getElementById('auto-action-type').value;
  var cfg = {};
  if (type === 'set_status') {
    var colEl = document.getElementById('auto-action-col');
    var valEl = document.getElementById('auto-action-val');
    if (colEl) cfg.column_id = colEl.value;
    if (valEl) cfg.value = valEl.value;
  } else if (type === 'assign_person') {
    var colEl2 = document.getElementById('auto-action-col');
    var personEl = document.getElementById('auto-action-person');
    if (colEl2) cfg.column_id = colEl2.value;
    if (personEl) cfg.person_id = personEl.value;
  } else if (type === 'move_to_group') {
    var groupEl = document.getElementById('auto-action-group');
    if (groupEl) cfg.group_id = groupEl.value;
  } else if (type === 'send_notification') {
    var msgEl = document.getElementById('auto-action-msg');
    if (msgEl) cfg.message = msgEl.value;
  } else if (type === 'set_date') {
    var colEl3 = document.getElementById('auto-action-col');
    var offsetEl = document.getElementById('auto-action-offset');
    if (colEl3) cfg.column_id = colEl3.value;
    if (offsetEl) cfg.offset_days = parseInt(offsetEl.value, 10) || 0;
  }
  return cfg;
}

async function saveAutomation(automationId) {
  var name = (document.getElementById('auto-name').value || '').trim() || 'Untitled Automation';
  var triggerType = document.getElementById('auto-trigger-type').value;
  var actionType = document.getElementById('auto-action-type').value;

  if (!triggerType) { showToast('Select a trigger.', 'error'); return; }
  if (!actionType) { showToast('Select an action.', 'error'); return; }

  var triggerConfig = gatherTriggerConfig();
  var actionConfig = gatherActionConfig();

  var data = {
    name: name,
    trigger_type: triggerType,
    trigger_config: triggerConfig,
    action_type: actionType,
    action_config: actionConfig,
    updated_at: new Date().toISOString()
  };

  try {
    if (automationId) {
      await resilientWrite(function() {
        return sb.from('hq_automations').update(data).eq('id', automationId);
      }, 'updateAutomation');
    } else {
      data.project_id = _currentProjectId;
      data.created_by = currentUser ? currentUser.id : null;
      data.is_active = true;
      await resilientWrite(function() {
        return sb.from('hq_automations').insert(data);
      }, 'insertAutomation');
    }
    showToast(automationId ? 'Automation updated.' : 'Automation created!', 'success');
    openAutomationsPanel(); /* Return to list */
  } catch (err) {
    showToast('Failed to save automation.', 'error');
  }
}

async function deleteAutomation(automationId) {
  customConfirm('Delete this automation?', async function() {
    try {
      await resilientWrite(function() {
        return sb.from('hq_automations').delete().eq('id', automationId);
      }, 'deleteAutomation');
      showToast('Automation deleted.', 'success');
      openAutomationsPanel();
    } catch (err) { showToast('Failed to delete automation.', 'error'); }
  });
}

async function toggleAutomation(automationId, active) {
  try {
    await resilientWrite(function() {
      return sb.from('hq_automations').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', automationId);
    }, 'toggleAutomation');
    /* Update local cache */
    var auto = _projectAutomations.find(function(a) { return a.id === automationId; });
    if (auto) auto.is_active = active;
    showToast(active ? 'Automation enabled.' : 'Automation paused.', 'success');
  } catch (err) { showToast('Failed to toggle automation.', 'error'); }
}
