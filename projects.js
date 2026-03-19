/* ═══ Atlas HQ — Monday-Style Board UI ═══ */

var _currentProjectId = null;
var _boardGroups = [];
var _boardColumns = [];
var _boardTasks = [];
var _boardTaskValues = {};  /* { taskId: { columnId: value } } */
var _boardStaff = [];
var _groupCollapsed = {};

/* ─── Colors ─── */
var GROUP_COLORS = ['#579bfc','#fdab3d','#00c875','#e2445c','#a25ddc','#0086c0','#ff642e','#c4c4c4'];
var PERSON_COLORS = ['#579bfc','#00c875','#fdab3d','#e2445c','#a25ddc','#0086c0','#ff642e','#037f4c','#9d50dd','#225091'];

/* ─── Main Render ─── */
async function renderProjects() {
  try {
    var projects = await fetchProjects();
    var container = document.getElementById('projects-content');
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:4rem;">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:64px;height:64px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' +
        '<div class="empty-state-title" style="font-size:var(--text-base);">Create your first board</div>' +
        '<div class="empty-state-text">Boards help you track projects, tasks, and everything in between.</div>' +
        '<button class="btn btn-primary" onclick="openProjectModal()">+ New Board</button></div>';
      return;
    }

    if (!_currentProjectId || !projects.find(function(p) { return p.id === _currentProjectId; })) {
      _currentProjectId = projects[0].id;
    }

    await loadBoardData(_currentProjectId);
    renderBoard(container, projects);
  } catch (err) {
    console.error('[renderProjects]', err);
    showToast('Failed to load board.', 'error');
  }
}

async function loadBoardData(projectId) {
  var results = await Promise.allSettled([
    fetchBoardGroups(projectId, true),
    fetchBoardColumns(projectId, true),
    fetchTasks(true),
    fetchStaffList()
  ]);

  _boardGroups = (results[0].status === 'fulfilled') ? results[0].value : [];
  _boardColumns = (results[1].status === 'fulfilled') ? results[1].value : [];
  var allTasks = (results[2].status === 'fulfilled') ? results[2].value : [];
  _boardStaff = (results[3].status === 'fulfilled') ? results[3].value : [];

  _boardTasks = allTasks.filter(function(t) { return t.project_id === projectId; });

  /* Init defaults if new board */
  if (_boardGroups.length === 0 && _boardColumns.length === 0) {
    await initBoardDefaults(projectId);
    _boardGroups = await fetchBoardGroups(projectId, true);
    _boardColumns = await fetchBoardColumns(projectId, true);
  }

  /* Fetch task values */
  var taskIds = _boardTasks.map(function(t) { return t.id; });
  var values = [];
  if (taskIds.length > 0) {
    values = await fetchTaskValues(taskIds, true);
  }
  _boardTaskValues = {};
  values.forEach(function(v) {
    if (!_boardTaskValues[v.task_id]) _boardTaskValues[v.task_id] = {};
    _boardTaskValues[v.task_id][v.column_id] = v.value;
  });
}

function renderBoard(container, projects) {
  var colWidths = '40px 280px ' + _boardColumns.map(function(c) { return c.width + 'px'; }).join(' ') + ' 40px';

  var html = '';

  /* Board selector */
  html += '<div class="board-selector">';
  html += '<select class="select-field" style="width:auto;min-width:200px;" onchange="_currentProjectId=this.value;renderProjects()">';
  projects.forEach(function(p) {
    html += '<option value="' + p.id + '"' + (p.id === _currentProjectId ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
  });
  html += '</select>';
  html += '<button class="btn btn-sm btn-ghost" onclick="openProjectModal(_currentProjectId)">Settings</button>';
  html += '<button class="btn btn-sm btn-primary" onclick="openProjectModal()">+ New Board</button>';
  html += '</div>';

  /* Board wrapper */
  html += '<div class="board-wrapper">';

  /* Column headers */
  html += '<div class="board-header-row" style="grid-template-columns:' + colWidths + ';">';
  html += '<div class="board-col-header" style="border-right:none;"></div>';
  html += '<div class="board-col-header">Item</div>';
  _boardColumns.forEach(function(col) {
    html += '<div class="board-col-header" data-col-id="' + col.id + '">';
    html += '<span ondblclick="editColumnName(this,\'' + col.id + '\')">' + escapeHtml(col.name) + '</span>';
    html += '<div class="board-col-resize" onmousedown="startColumnResize(event,\'' + col.id + '\')"></div>';
    html += '</div>';
  });
  html += '<div class="board-add-col-btn" onclick="openAddColumnPicker(event)">+</div>';
  html += '</div>';

  /* Groups */
  _boardGroups.forEach(function(group) {
    var groupTasks = _boardTasks.filter(function(t) { return t.group_id === group.id; })
      .sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    var isCollapsed = _groupCollapsed[group.id] === true;

    html += '<div class="board-group" data-group-id="' + group.id + '">';

    /* Group header */
    html += '<div class="board-group-header" style="border-left:4px solid ' + group.color + ';background:' + group.color + '18;" onclick="toggleGroupCollapse(\'' + group.id + '\')">';
    html += '<span class="board-group-toggle' + (isCollapsed ? ' collapsed' : '') + '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 2l4 4-4 4"/></svg></span>';
    html += '<span class="board-group-name" onclick="event.stopPropagation()" ondblclick="this.contentEditable=true;this.focus()" onblur="saveGroupName(this,\'' + group.id + '\')" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur()}">' + escapeHtml(group.name) + '</span>';
    html += '<span class="board-group-count">' + groupTasks.length + ' item' + (groupTasks.length !== 1 ? 's' : '') + '</span>';
    html += '<button class="board-group-menu" onclick="event.stopPropagation();openGroupMenu(event,\'' + group.id + '\')">&#8943;</button>';
    html += '</div>';

    /* Group body */
    html += '<div class="board-group-body' + (isCollapsed ? ' collapsed' : '') + '" style="' + (isCollapsed ? 'max-height:0;' : '') + '">';

    /* Task rows */
    groupTasks.forEach(function(task) {
      html += '<div class="board-row" data-task-id="' + task.id + '" style="grid-template-columns:' + colWidths + ';" draggable="true" ondragstart="onTaskDragStart(event,\'' + task.id + '\')" ondragend="onTaskDragEnd(event)">';
      html += '<div class="board-cell-checkbox"><input type="checkbox" onclick="event.stopPropagation()"></div>';
      html += '<div class="board-cell board-cell-name" onclick="startNameEdit(this,\'' + task.id + '\')">' + escapeHtml(task.title) + '</div>';

      _boardColumns.forEach(function(col) {
        var val = (_boardTaskValues[task.id] && _boardTaskValues[task.id][col.id]) || '';
        html += '<div class="board-cell" data-col-id="' + col.id + '" data-col-type="' + col.type + '">';
        html += renderCellContent(task, col, val);
        html += '</div>';
      });

      html += '<div class="board-cell" style="border-right:none;"></div>';
      html += '</div>';
    });

    /* Add item row */
    html += '<div class="board-add-item" style="grid-template-columns:' + colWidths + ';">';
    html += '<div></div>';
    html += '<div><input type="text" class="board-add-item-input" placeholder="+ Add item" onkeydown="if(event.key===\'Enter\'&&this.value.trim()){addTaskToGroup(\'' + group.id + '\',this.value.trim());this.value=\'\';}" data-group-id="' + group.id + '"></div>';
    for (var ci = 0; ci < _boardColumns.length + 1; ci++) html += '<div></div>';
    html += '</div>';

    html += '</div>'; /* group-body */
    html += '</div>'; /* board-group */
  });

  /* Ungrouped tasks */
  var ungrouped = _boardTasks.filter(function(t) { return !t.group_id; });
  if (ungrouped.length > 0) {
    html += '<div class="board-group">';
    html += '<div class="board-group-header" style="border-left:4px solid #c4c4c4;background:#c4c4c418;">';
    html += '<span class="board-group-name" style="color:var(--color-tx-muted);">Ungrouped</span>';
    html += '<span class="board-group-count">' + ungrouped.length + '</span>';
    html += '</div>';
    html += '<div class="board-group-body">';
    ungrouped.forEach(function(task) {
      html += '<div class="board-row" data-task-id="' + task.id + '" style="grid-template-columns:' + colWidths + ';">';
      html += '<div class="board-cell-checkbox"><input type="checkbox"></div>';
      html += '<div class="board-cell board-cell-name" onclick="startNameEdit(this,\'' + task.id + '\')">' + escapeHtml(task.title) + '</div>';
      _boardColumns.forEach(function(col) {
        var val = (_boardTaskValues[task.id] && _boardTaskValues[task.id][col.id]) || '';
        html += '<div class="board-cell" data-col-id="' + col.id + '" data-col-type="' + col.type + '">' + renderCellContent(task, col, val) + '</div>';
      });
      html += '<div class="board-cell" style="border-right:none;"></div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  /* Add group button */
  html += '<div class="board-add-group"><button class="btn btn-ghost btn-sm" onclick="addGroup()">+ Add new group</button></div>';

  html += '</div>'; /* board-wrapper */

  /* Drop zone listeners */
  container.innerHTML = html;

  /* Attach drag-over listeners to group bodies */
  var groupBodies = container.querySelectorAll('.board-group-body');
  for (var gi = 0; gi < groupBodies.length; gi++) {
    groupBodies[gi].addEventListener('dragover', function(e) { e.preventDefault(); this.parentElement.classList.add('drop-target-group'); });
    groupBodies[gi].addEventListener('dragleave', function(e) { this.parentElement.classList.remove('drop-target-group'); });
    groupBodies[gi].addEventListener('drop', function(e) {
      e.preventDefault();
      this.parentElement.classList.remove('drop-target-group');
      var taskId = e.dataTransfer.getData('text/plain');
      var groupId = this.parentElement.getAttribute('data-group-id');
      if (taskId && groupId) moveTaskToGroup(taskId, groupId);
    });
  }
}

/* ─── Cell Content Rendering ─── */
function renderCellContent(task, col, val) {
  var settings = col.settings || {};
  var labels;

  switch (col.type) {
    case 'status':
      labels = settings.labels || [];
      if (!val) return '<div class="board-status-empty" onclick="event.stopPropagation();openStatusPicker(event,\'' + task.id + '\',\'' + col.id + '\')"></div>';
      var statusLabel = labels.find(function(l) { return l.name === val; });
      var statusColor = statusLabel ? statusLabel.color : '#c4c4c4';
      return '<div class="board-status-pill" style="background:' + statusColor + ';" onclick="event.stopPropagation();openStatusPicker(event,\'' + task.id + '\',\'' + col.id + '\')">' + escapeHtml(val) + '</div>';

    case 'person':
      if (!val) return '<div class="board-person-empty" onclick="event.stopPropagation();openPersonPicker(event,\'' + task.id + '\',\'' + col.id + '\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>';
      var person = _boardStaff.find(function(s) { return s.auth_user_id === val || s.id === val; });
      var pName = person ? ((person.first_name || '') + ' ' + (person.last_name || '')).trim() : 'Unknown';
      var pInitials = person ? (person.first_name || '').charAt(0) + (person.last_name || '').charAt(0) : '?';
      var pColor = PERSON_COLORS[Math.abs(hashStr(val)) % PERSON_COLORS.length];
      return '<div class="board-person-avatar" style="background:' + pColor + ';" onclick="event.stopPropagation();openPersonPicker(event,\'' + task.id + '\',\'' + col.id + '\')" title="' + escapeHtml(pName) + '">' + escapeHtml(pInitials) + '</div>';

    case 'date':
      if (!val) return '<span class="board-date-display" onclick="event.stopPropagation();startDateEdit(this,\'' + task.id + '\',\'' + col.id + '\')">—</span>';
      return '<span class="board-date-display" onclick="event.stopPropagation();startDateEdit(this,\'' + task.id + '\',\'' + col.id + '\')">' + formatDate(val) + '</span>';

    case 'priority':
      labels = settings.labels || [];
      if (!val) return '<div class="board-status-empty" onclick="event.stopPropagation();openPriorityPicker(event,\'' + task.id + '\',\'' + col.id + '\')"></div>';
      var priLabel = labels.find(function(l) { return l.name === val; });
      var priColor = priLabel ? priLabel.color : '#c4c4c4';
      return '<div class="board-priority-label" style="background:' + priColor + ';" onclick="event.stopPropagation();openPriorityPicker(event,\'' + task.id + '\',\'' + col.id + '\')">' + escapeHtml(val) + '</div>';

    case 'checkbox':
      return '<input type="checkbox"' + (val === 'true' ? ' checked' : '') + ' onchange="saveCellValue(\'' + task.id + '\',\'' + col.id + '\',this.checked?\'true\':\'false\')" onclick="event.stopPropagation()" style="width:16px;height:16px;cursor:pointer;">';

    case 'number':
      return '<span class="board-date-display" onclick="event.stopPropagation();startCellEdit(this,\'' + task.id + '\',\'' + col.id + '\',\'number\')">' + escapeHtml(val || '—') + '</span>';

    case 'text':
    default:
      return '<span class="board-date-display" onclick="event.stopPropagation();startCellEdit(this,\'' + task.id + '\',\'' + col.id + '\',\'text\')">' + escapeHtml(val || '') + '</span>';
  }
}

function hashStr(str) {
  var hash = 0;
  for (var i = 0; i < (str || '').length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  return hash;
}

/* ─── Inline Editing ─── */
function startNameEdit(el, taskId) {
  var current = el.textContent;
  el.innerHTML = '<input type="text" class="board-cell-edit" value="' + escapeHtml(current) + '">';
  var input = el.querySelector('input');
  input.focus();
  input.select();
  input.onblur = function() { saveTaskName(taskId, input.value.trim() || current, el); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { el.textContent = current; }
  };
}

async function saveTaskName(taskId, newName, el) {
  el.textContent = newName;
  try {
    await resilientWrite(function() {
      return sb.from('hq_tasks').update({ title: newName, updated_at: new Date().toISOString() }).eq('id', taskId);
    }, 'updateTaskName');
    var task = _boardTasks.find(function(t) { return t.id === taskId; });
    if (task) task.title = newName;
  } catch (err) { showToast('Failed to save name.', 'error'); }
}

function startCellEdit(el, taskId, colId, inputType) {
  var current = el.textContent === '—' ? '' : el.textContent;
  el.innerHTML = '<input type="' + (inputType === 'number' ? 'number' : 'text') + '" class="board-cell-edit" value="' + escapeHtml(current) + '">';
  var input = el.querySelector('input');
  input.focus();
  input.select();
  input.onblur = function() {
    var newVal = input.value.trim();
    saveCellValue(taskId, colId, newVal);
    el.textContent = newVal || (inputType === 'number' ? '—' : '');
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { el.textContent = current || (inputType === 'number' ? '—' : ''); }
  };
}

function startDateEdit(el, taskId, colId) {
  var currentVal = '';
  if (_boardTaskValues[taskId] && _boardTaskValues[taskId][colId]) currentVal = _boardTaskValues[taskId][colId];
  el.innerHTML = '<input type="date" class="board-date-input" value="' + currentVal + '">';
  var input = el.querySelector('input');
  input.focus();
  input.onchange = function() { saveCellValue(taskId, colId, input.value); el.innerHTML = renderDateDisplay(input.value, taskId, colId); };
  input.onblur = function() { el.innerHTML = renderDateDisplay(input.value || currentVal, taskId, colId); };
}

function renderDateDisplay(val, taskId, colId) {
  if (!val) return '<span class="board-date-display" onclick="event.stopPropagation();startDateEdit(this,\'' + taskId + '\',\'' + colId + '\')">—</span>';
  return '<span class="board-date-display" onclick="event.stopPropagation();startDateEdit(this,\'' + taskId + '\',\'' + colId + '\')">' + formatDate(val) + '</span>';
}

/* ─── Save Cell Value ─── */
async function saveCellValue(taskId, colId, newValue) {
  /* Optimistic update */
  if (!_boardTaskValues[taskId]) _boardTaskValues[taskId] = {};
  _boardTaskValues[taskId][colId] = newValue;

  try {
    await resilientWrite(function() {
      return sb.from('hq_task_values').upsert({
        task_id: taskId,
        column_id: colId,
        value: String(newValue),
        updated_at: new Date().toISOString()
      }, { onConflict: 'task_id,column_id' });
    }, 'saveCellValue');
    clearCache('taskValues');
  } catch (err) {
    console.error('[saveCellValue]', err);
    showToast('Failed to save.', 'error');
  }
}

/* ─── Picker Dropdowns ─── */
function closeAllPickers() {
  var pickers = document.querySelectorAll('.board-picker,.board-context-menu');
  for (var i = 0; i < pickers.length; i++) pickers[i].remove();
}

function positionPicker(picker, target) {
  var rect = target.getBoundingClientRect();
  picker.style.left = rect.left + 'px';
  picker.style.top = (rect.bottom + 4) + 'px';
  /* Keep within viewport */
  requestAnimationFrame(function() {
    var pr = picker.getBoundingClientRect();
    if (pr.right > window.innerWidth - 8) picker.style.left = (window.innerWidth - pr.width - 8) + 'px';
    if (pr.bottom > window.innerHeight - 8) picker.style.top = (rect.top - pr.height - 4) + 'px';
  });
}

function openStatusPicker(event, taskId, colId) {
  closeAllPickers();
  var col = _boardColumns.find(function(c) { return c.id === colId; });
  var labels = (col && col.settings && col.settings.labels) || [];
  var currentVal = (_boardTaskValues[taskId] && _boardTaskValues[taskId][colId]) || '';

  var picker = document.createElement('div');
  picker.className = 'board-picker';
  var html = '';
  labels.forEach(function(l) {
    html += '<div class="board-picker-option' + (l.name === currentVal ? ' active' : '') + '" onclick="selectStatus(event,\'' + taskId + '\',\'' + colId + '\',\'' + escapeHtml(l.name) + '\')">';
    html += '<div class="board-picker-dot" style="background:' + l.color + ';"></div>';
    html += '<span>' + escapeHtml(l.name) + '</span></div>';
  });
  /* Clear option */
  html += '<div class="board-picker-option" onclick="selectStatus(event,\'' + taskId + '\',\'' + colId + '\',\'\')" style="color:var(--color-tx-faint);"><span>Clear</span></div>';
  picker.innerHTML = html;
  document.body.appendChild(picker);
  positionPicker(picker, event.currentTarget);

  setTimeout(function() {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

function selectStatus(event, taskId, colId, value) {
  event.stopPropagation();
  closeAllPickers();
  saveCellValue(taskId, colId, value);
  /* Re-render just the cell */
  var cell = document.querySelector('.board-row[data-task-id="' + taskId + '"] .board-cell[data-col-id="' + colId + '"]');
  if (cell) {
    var col = _boardColumns.find(function(c) { return c.id === colId; });
    var task = _boardTasks.find(function(t) { return t.id === taskId; });
    if (col && task) cell.innerHTML = renderCellContent(task, col, value);
  }
}

function openPersonPicker(event, taskId, colId) {
  closeAllPickers();
  var currentVal = (_boardTaskValues[taskId] && _boardTaskValues[taskId][colId]) || '';

  var picker = document.createElement('div');
  picker.className = 'board-picker';
  var html = '<input type="text" class="board-picker-search" placeholder="Search people..." oninput="filterPersonPicker(this)">';
  _boardStaff.forEach(function(s) {
    var name = ((s.first_name || '') + ' ' + (s.last_name || '')).trim();
    var initials = (s.first_name || '').charAt(0) + (s.last_name || '').charAt(0);
    var pId = s.auth_user_id || s.id;
    var isActive = pId === currentVal;
    var pColor = PERSON_COLORS[Math.abs(hashStr(pId)) % PERSON_COLORS.length];
    html += '<div class="board-picker-option' + (isActive ? ' active' : '') + '" data-name="' + escapeHtml(name.toLowerCase()) + '" onclick="selectPerson(event,\'' + taskId + '\',\'' + colId + '\',\'' + pId + '\')">';
    html += '<div class="board-person-avatar" style="background:' + pColor + ';width:22px;height:22px;font-size:0.5rem;">' + escapeHtml(initials) + '</div>';
    html += '<span>' + escapeHtml(name) + '</span></div>';
  });
  html += '<div class="board-picker-option" onclick="selectPerson(event,\'' + taskId + '\',\'' + colId + '\',\'\')" style="color:var(--color-tx-faint);"><span>Unassign</span></div>';
  picker.innerHTML = html;
  document.body.appendChild(picker);
  positionPicker(picker, event.currentTarget);
  var searchInput = picker.querySelector('.board-picker-search');
  if (searchInput) searchInput.focus();

  setTimeout(function() {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

function filterPersonPicker(input) {
  var query = input.value.toLowerCase();
  var options = input.parentElement.querySelectorAll('.board-picker-option');
  for (var i = 0; i < options.length; i++) {
    var name = options[i].getAttribute('data-name') || '';
    options[i].style.display = (name.indexOf(query) !== -1 || !query) ? '' : 'none';
  }
}

function selectPerson(event, taskId, colId, value) {
  event.stopPropagation();
  closeAllPickers();
  saveCellValue(taskId, colId, value);
  var cell = document.querySelector('.board-row[data-task-id="' + taskId + '"] .board-cell[data-col-id="' + colId + '"]');
  if (cell) {
    var col = _boardColumns.find(function(c) { return c.id === colId; });
    var task = _boardTasks.find(function(t) { return t.id === taskId; });
    if (col && task) cell.innerHTML = renderCellContent(task, col, value);
  }
}

function openPriorityPicker(event, taskId, colId) {
  closeAllPickers();
  var col = _boardColumns.find(function(c) { return c.id === colId; });
  var labels = (col && col.settings && col.settings.labels) || [];
  var currentVal = (_boardTaskValues[taskId] && _boardTaskValues[taskId][colId]) || '';

  var picker = document.createElement('div');
  picker.className = 'board-picker';
  var html = '';
  labels.forEach(function(l) {
    html += '<div class="board-picker-option' + (l.name === currentVal ? ' active' : '') + '" onclick="selectStatus(event,\'' + taskId + '\',\'' + colId + '\',\'' + escapeHtml(l.name) + '\')">';
    html += '<div class="board-picker-dot" style="background:' + l.color + ';"></div>';
    html += '<span>' + escapeHtml(l.name) + '</span></div>';
  });
  html += '<div class="board-picker-option" onclick="selectStatus(event,\'' + taskId + '\',\'' + colId + '\',\'\')" style="color:var(--color-tx-faint);"><span>Clear</span></div>';
  picker.innerHTML = html;
  document.body.appendChild(picker);
  positionPicker(picker, event.currentTarget);

  setTimeout(function() {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

/* ─── Group Operations ─── */
function toggleGroupCollapse(groupId) {
  _groupCollapsed[groupId] = !_groupCollapsed[groupId];
  var group = document.querySelector('.board-group[data-group-id="' + groupId + '"]');
  if (!group) return;
  var body = group.querySelector('.board-group-body');
  var toggle = group.querySelector('.board-group-toggle');
  if (body) body.classList.toggle('collapsed');
  if (toggle) toggle.classList.toggle('collapsed');
}

async function saveGroupName(el, groupId) {
  el.contentEditable = 'false';
  var newName = el.textContent.trim();
  if (!newName) { el.textContent = 'Group'; newName = 'Group'; }
  try {
    await resilientWrite(function() {
      return sb.from('hq_board_groups').update({ name: newName }).eq('id', groupId);
    }, 'updateGroupName');
    clearCache('boardGroups');
  } catch (err) { showToast('Failed to rename group.', 'error'); }
}

async function addGroup() {
  var maxOrder = _boardGroups.reduce(function(m, g) { return Math.max(m, g.sort_order || 0); }, -1);
  var color = GROUP_COLORS[(maxOrder + 1) % GROUP_COLORS.length];
  try {
    await resilientWrite(function() {
      return sb.from('hq_board_groups').insert({
        project_id: _currentProjectId,
        name: 'New Group',
        color: color,
        sort_order: maxOrder + 1
      });
    }, 'addGroup');
    clearCache('boardGroups');
    renderProjects();
    showToast('Group added.', 'success');
  } catch (err) { showToast('Failed to add group.', 'error'); }
}

function openGroupMenu(event, groupId) {
  event.stopPropagation();
  closeAllPickers();
  var group = _boardGroups.find(function(g) { return g.id === groupId; });
  if (!group) return;

  var menu = document.createElement('div');
  menu.className = 'board-context-menu';
  var html = '<div class="board-context-item" onclick="closeAllPickers();renameGroupPrompt(\'' + groupId + '\')">Rename</div>';
  html += '<div style="padding:0.25rem 0.75rem;font-size:var(--text-xs);color:var(--color-tx-faint);">Color</div>';
  html += '<div class="board-color-dots">';
  GROUP_COLORS.forEach(function(c) {
    html += '<div class="board-color-dot' + (group.color === c ? ' active' : '') + '" style="background:' + c + ';" onclick="changeGroupColor(\'' + groupId + '\',\'' + c + '\')"></div>';
  });
  html += '</div>';
  html += '<div class="board-context-divider"></div>';
  html += '<div class="board-context-item danger" onclick="closeAllPickers();deleteGroup(\'' + groupId + '\')">Delete group</div>';
  menu.innerHTML = html;
  document.body.appendChild(menu);
  positionPicker(menu, event.currentTarget);

  setTimeout(function() {
    document.addEventListener('click', function handler(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

function renameGroupPrompt(groupId) {
  var nameEl = document.querySelector('.board-group[data-group-id="' + groupId + '"] .board-group-name');
  if (nameEl) { nameEl.contentEditable = 'true'; nameEl.focus(); }
}

async function changeGroupColor(groupId, color) {
  closeAllPickers();
  try {
    await resilientWrite(function() {
      return sb.from('hq_board_groups').update({ color: color }).eq('id', groupId);
    }, 'changeGroupColor');
    clearCache('boardGroups');
    renderProjects();
  } catch (err) { showToast('Failed to change color.', 'error'); }
}

function deleteGroup(groupId) {
  var otherGroups = _boardGroups.filter(function(g) { return g.id !== groupId; });
  if (otherGroups.length === 0) { showToast('Cannot delete the last group.', 'error'); return; }
  var targetGroupId = otherGroups[0].id;
  var targetName = otherGroups[0].name;
  customConfirm('Delete this group? Items will be moved to "' + targetName + '".', async function() {
    try {
      await resilientWrite(function() {
        return sb.from('hq_tasks').update({ group_id: targetGroupId }).eq('group_id', groupId);
      }, 'moveTasksFromGroup');
      await resilientWrite(function() {
        return sb.from('hq_board_groups').delete().eq('id', groupId);
      }, 'deleteGroup');
      clearCache('boardGroups');
      clearCache('tasks');
      renderProjects();
      showToast('Group deleted.', 'success');
    } catch (err) { showToast('Failed to delete group.', 'error'); }
  });
}

/* ─── Column Operations ─── */
function openAddColumnPicker(event) {
  closeAllPickers();
  var picker = document.createElement('div');
  picker.className = 'board-picker';
  picker.style.minWidth = '220px';
  var types = [
    { type: 'status', label: 'Status', icon: '#00c875', iconText: 'S' },
    { type: 'person', label: 'Person', icon: '#579bfc', iconText: 'P' },
    { type: 'date', label: 'Date', icon: '#fdab3d', iconText: 'D' },
    { type: 'priority', label: 'Priority', icon: '#e2445c', iconText: '!' },
    { type: 'text', label: 'Text', icon: '#c4c4c4', iconText: 'T' },
    { type: 'number', label: 'Number', icon: '#a25ddc', iconText: '#' },
    { type: 'checkbox', label: 'Checkbox', icon: '#0086c0', iconText: '\u2713' },
    { type: 'dropdown', label: 'Dropdown', icon: '#ff642e', iconText: '\u25BC' }
  ];
  var html = '<div style="padding:0.375rem 0.5rem;font-size:var(--text-xs);color:var(--color-tx-muted);font-weight:600;">ADD COLUMN</div>';
  html += '<div class="board-col-type-picker">';
  types.forEach(function(t) {
    html += '<div class="board-col-type-option" onclick="addColumn(\'' + t.type + '\')">';
    html += '<div class="board-col-type-icon" style="background:' + t.icon + ';color:white;">' + t.iconText + '</div>';
    html += '<span>' + t.label + '</span></div>';
  });
  html += '</div>';
  picker.innerHTML = html;
  document.body.appendChild(picker);
  positionPicker(picker, event.currentTarget);

  setTimeout(function() {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

async function addColumn(type) {
  closeAllPickers();
  var maxOrder = _boardColumns.reduce(function(m, c) { return Math.max(m, c.sort_order || 0); }, -1);
  var names = { status: 'Status', person: 'Person', date: 'Date', priority: 'Priority', text: 'Text', number: 'Number', checkbox: 'Checkbox', dropdown: 'Dropdown' };
  var settings = {};
  if (type === 'status') {
    settings = { labels: [
      { name: 'Not Started', color: '#c4c4c4' }, { name: 'Working on it', color: '#fdab3d' },
      { name: 'Stuck', color: '#e2445c' }, { name: 'Done', color: '#00c875' }
    ]};
  } else if (type === 'priority') {
    settings = { labels: [
      { name: 'Critical', color: '#e2445c' }, { name: 'High', color: '#fdab3d' },
      { name: 'Medium', color: '#579bfc' }, { name: 'Low', color: '#c4c4c4' }
    ]};
  } else if (type === 'dropdown') {
    settings = { options: ['Option 1', 'Option 2', 'Option 3'] };
  }

  try {
    await resilientWrite(function() {
      return sb.from('hq_board_columns').insert({
        project_id: _currentProjectId,
        name: names[type] || 'Column',
        type: type,
        sort_order: maxOrder + 1,
        width: type === 'text' ? 200 : 150,
        settings: settings
      });
    }, 'addColumn');
    clearCache('boardColumns');
    renderProjects();
    showToast('Column added.', 'success');
  } catch (err) { showToast('Failed to add column.', 'error'); }
}

function editColumnName(el, colId) {
  var current = el.textContent;
  el.contentEditable = 'true';
  el.focus();
  el.onblur = async function() {
    el.contentEditable = 'false';
    var newName = el.textContent.trim() || current;
    el.textContent = newName;
    try {
      await resilientWrite(function() {
        return sb.from('hq_board_columns').update({ name: newName }).eq('id', colId);
      }, 'renameColumn');
      clearCache('boardColumns');
    } catch (err) { showToast('Failed to rename column.', 'error'); }
  };
  el.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
}

/* Column resize */
var _resizingCol = null;
function startColumnResize(event, colId) {
  event.preventDefault();
  event.stopPropagation();
  var col = _boardColumns.find(function(c) { return c.id === colId; });
  if (!col) return;
  _resizingCol = { colId: colId, startX: event.clientX, startWidth: col.width };

  function onMouseMove(e) {
    var delta = e.clientX - _resizingCol.startX;
    var newWidth = Math.max(80, _resizingCol.startWidth + delta);
    col.width = newWidth;
    /* Re-render column widths */
    var colWidths = '40px 280px ' + _boardColumns.map(function(c) { return c.width + 'px'; }).join(' ') + ' 40px';
    var rows = document.querySelectorAll('.board-header-row, .board-row, .board-add-item');
    for (var i = 0; i < rows.length; i++) rows[i].style.gridTemplateColumns = colWidths;
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (_resizingCol) {
      var finalCol = _boardColumns.find(function(c) { return c.id === _resizingCol.colId; });
      if (finalCol) {
        resilientWrite(function() {
          return sb.from('hq_board_columns').update({ width: finalCol.width }).eq('id', finalCol.id);
        }, 'resizeColumn').catch(function() {});
        clearCache('boardColumns');
      }
      _resizingCol = null;
    }
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/* ─── Task Operations ─── */
async function addTaskToGroup(groupId, title) {
  if (!title) return;
  var maxOrder = _boardTasks.filter(function(t) { return t.group_id === groupId; })
    .reduce(function(m, t) { return Math.max(m, t.sort_order || 0); }, -1);
  try {
    await resilientWrite(function() {
      return sb.from('hq_tasks').insert({
        project_id: _currentProjectId,
        group_id: groupId,
        title: title,
        status: 'Backlog',
        sort_order: maxOrder + 1
      });
    }, 'addTask');
    clearCache('tasks');
    renderProjects();
  } catch (err) { showToast('Failed to add item.', 'error'); }
}

async function moveTaskToGroup(taskId, newGroupId) {
  try {
    await resilientWrite(function() {
      return sb.from('hq_tasks').update({ group_id: newGroupId, updated_at: new Date().toISOString() }).eq('id', taskId);
    }, 'moveTask');
    clearCache('tasks');
    renderProjects();
    showToast('Item moved.', 'success');
  } catch (err) { showToast('Failed to move item.', 'error'); }
}

/* Drag & Drop */
function onTaskDragStart(event, taskId) {
  event.dataTransfer.setData('text/plain', taskId);
  event.currentTarget.classList.add('dragging');
}
function onTaskDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
}

/* ─── Project/Board CRUD ─── */
function openProjectModal(projectId) {
  var title = projectId ? 'Board Settings' : 'New Board';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');
  var project = null;
  if (projectId && dataCache.projects) {
    project = dataCache.projects.find(function(p) { return p.id === projectId; });
  }
  body.innerHTML = '<div class="form-row"><label class="field-label">Board Name</label><input type="text" id="proj-name" class="input-field" placeholder="Board name" value="' + escapeHtml((project && project.name) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Description</label><textarea id="proj-desc" class="input-field" placeholder="What is this board for?">' + escapeHtml((project && project.description) || '') + '</textarea></div>';

  var footer = document.getElementById('hq-modal-footer');
  if (projectId) {
    footer.innerHTML = '<button class="btn btn-danger-ghost" onclick="deleteProject(\'' + projectId + '\')">Delete Board</button><div style="flex:1;"></div><button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Save</button>';
  } else {
    footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Create</button>';
  }
  document.getElementById('hq-modal-save').onclick = function() { saveProject(projectId); };
  openModal('hq-modal');
}

async function saveProject(projectId) {
  var name = document.getElementById('proj-name').value.trim();
  if (!name) { showToast('Board name is required.', 'error'); return; }
  var data = { name: name, description: document.getElementById('proj-desc').value.trim(), updated_at: new Date().toISOString() };
  try {
    if (projectId) {
      await resilientWrite(function() { return sb.from('hq_projects').update(data).eq('id', projectId); }, 'updateProject');
    } else {
      data.owner_id = currentUser ? currentUser.id : null;
      data.status = 'In Progress';
      var result = await resilientWrite(function() { return sb.from('hq_projects').insert(data).select('id').single(); }, 'insertProject');
      if (result && result.data) {
        _currentProjectId = result.data.id;
        await initBoardDefaults(result.data.id);
      }
    }
    clearCache('projects');
    closeModal('hq-modal');
    renderProjects();
    showToast(projectId ? 'Board updated.' : 'Board created!', 'success');
  } catch (err) { showToast('Failed to save board.', 'error'); }
}

function deleteProject(projectId) {
  customConfirm('Delete this board and all its data? This cannot be undone.', async function() {
    try {
      await resilientWrite(function() { return sb.from('hq_projects').delete().eq('id', projectId); }, 'deleteProject');
      clearCache('projects');
      clearCache('boardGroups');
      clearCache('boardColumns');
      clearCache('tasks');
      _currentProjectId = null;
      closeModal('hq-modal');
      renderProjects();
      showToast('Board deleted.', 'success');
    } catch (err) { showToast('Failed to delete board.', 'error'); }
  });
}
