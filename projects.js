/* ═══ Atlas HQ — Monday-Style Board UI ═══ */

var _currentProjectId = null;
var _boardGroups = [];
var _boardColumns = [];
var _boardTasks = [];
var _boardTaskValues = {};  /* { taskId: { columnId: value } } */
var _boardStaff = [];
var _groupCollapsed = {};
var _boardSearchQuery = '';
var _boardSelectedTasks = {};  /* { taskId: true } */
var _boardSortCol = null;
var _boardSortDir = 'asc';
var _boardDetailTaskId = null;
var _saveIndicatorTimer = null;

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

  /* Filter tasks by search */
  var visibleTasks = _boardTasks;
  if (_boardSearchQuery) {
    var q = _boardSearchQuery.toLowerCase();
    visibleTasks = _boardTasks.filter(function(t) {
      if (t.title.toLowerCase().indexOf(q) !== -1) return true;
      var vals = _boardTaskValues[t.id] || {};
      for (var k in vals) { if ((vals[k] || '').toLowerCase().indexOf(q) !== -1) return true; }
      return false;
    });
  }

  /* Sort if active */
  if (_boardSortCol) {
    visibleTasks = visibleTasks.slice().sort(function(a, b) {
      var va = '', vb = '';
      if (_boardSortCol === 'title') { va = a.title; vb = b.title; }
      else {
        va = (_boardTaskValues[a.id] && _boardTaskValues[a.id][_boardSortCol]) || '';
        vb = (_boardTaskValues[b.id] && _boardTaskValues[b.id][_boardSortCol]) || '';
      }
      var cmp = va.localeCompare(vb, undefined, { numeric: true });
      return _boardSortDir === 'desc' ? -cmp : cmp;
    });
  }

  var selectedCount = Object.keys(_boardSelectedTasks).length;

  /* Board selector */
  html += '<div class="board-selector">';
  html += '<select class="select-field" style="width:auto;min-width:200px;" onchange="_currentProjectId=this.value;_boardSearchQuery=\'\';_boardSelectedTasks={};_boardSortCol=null;renderProjects()">';
  projects.forEach(function(p) {
    html += '<option value="' + p.id + '"' + (p.id === _currentProjectId ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
  });
  html += '</select>';
  html += '<button class="btn btn-sm btn-ghost" onclick="openProjectModal(_currentProjectId)">Settings</button>';
  html += '<button class="btn btn-sm btn-primary" onclick="openProjectModal()">+ New Board</button>';
  html += '<span class="board-save-indicator" id="board-save-status"><span class="board-save-dot"></span> Auto-saved</span>';
  html += '</div>';

  /* Search & Filter Toolbar */
  html += '<div class="board-toolbar">';
  html += '<div class="board-search"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  html += '<input type="text" class="board-search-input" placeholder="Search items..." value="' + escapeHtml(_boardSearchQuery) + '" oninput="boardSearch(this.value)"></div>';
  html += '<span class="board-item-count">' + visibleTasks.length + ' item' + (visibleTasks.length !== 1 ? 's' : '') + (_boardSearchQuery ? ' matching' : '') + '</span>';
  html += '</div>';

  /* Bulk Actions Bar */
  html += '<div class="board-bulk-bar' + (selectedCount > 0 ? ' active' : '') + '" id="board-bulk-bar">';
  html += '<span class="board-bulk-count">' + selectedCount + ' selected</span>';
  html += '<button class="board-bulk-btn" onclick="bulkSetStatus()">Set Status</button>';
  html += '<button class="board-bulk-btn" onclick="bulkMoveGroup()">Move to Group</button>';
  html += '<button class="board-bulk-btn" onclick="bulkDuplicate()">Duplicate</button>';
  html += '<button class="board-bulk-btn danger" onclick="bulkDelete()">Delete</button>';
  html += '<button class="board-bulk-close" onclick="clearSelection()">&times;</button>';
  html += '</div>';

  /* Board wrapper */
  html += '<div class="board-wrapper">';

  /* Column headers with sort */
  html += '<div class="board-header-row" style="grid-template-columns:' + colWidths + ';">';
  html += '<div class="board-col-header" style="border-right:none;"><input type="checkbox" onchange="toggleSelectAll(this.checked)" style="width:14px;height:14px;cursor:pointer;"></div>';
  html += '<div class="board-col-header' + (_boardSortCol === 'title' ? ' sorted' : '') + '" onclick="toggleSort(\'title\')" style="cursor:pointer;">Item<span class="board-sort-icon">' + (_boardSortCol === 'title' ? (_boardSortDir === 'asc' ? '&#9650;' : '&#9660;') : '&#9650;') + '</span></div>';
  _boardColumns.forEach(function(col) {
    var isSorted = _boardSortCol === col.id;
    html += '<div class="board-col-header' + (isSorted ? ' sorted' : '') + '" data-col-id="' + col.id + '" onclick="toggleSort(\'' + col.id + '\')" style="cursor:pointer;">';
    html += '<span ondblclick="event.stopPropagation();editColumnName(this,\'' + col.id + '\')">' + escapeHtml(col.name) + '</span>';
    html += '<span class="board-sort-icon">' + (isSorted ? (_boardSortDir === 'asc' ? '&#9650;' : '&#9660;') : '&#9650;') + '</span>';
    html += '<div class="board-col-resize" onmousedown="event.stopPropagation();startColumnResize(event,\'' + col.id + '\')"></div>';
    html += '</div>';
  });
  html += '<div class="board-add-col-btn" onclick="openAddColumnPicker(event)">+</div>';
  html += '</div>';

  /* Groups */
  _boardGroups.forEach(function(group) {
    var groupTasks = visibleTasks.filter(function(t) { return t.group_id === group.id; });
    if (!_boardSortCol) groupTasks.sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
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
      var isSelected = _boardSelectedTasks[task.id];
      html += '<div class="board-row' + (isSelected ? ' selected' : '') + '" data-task-id="' + task.id + '" style="grid-template-columns:' + colWidths + ';" draggable="true" ondragstart="onTaskDragStart(event,\'' + task.id + '\')" ondragend="onTaskDragEnd(event)" oncontextmenu="openRowContextMenu(event,\'' + task.id + '\')">';
      html += '<div class="board-cell-checkbox"><input type="checkbox"' + (isSelected ? ' checked' : '') + ' onclick="event.stopPropagation();toggleTaskSelect(\'' + task.id + '\',this.checked)"></div>';
      html += '<div class="board-cell board-cell-name" onclick="startNameEdit(this,\'' + task.id + '\')" ondblclick="event.stopPropagation();openDetailPanel(\'' + task.id + '\')">' + escapeHtml(task.title) + '</div>';

      _boardColumns.forEach(function(col) {
        var val = (_boardTaskValues[task.id] && _boardTaskValues[task.id][col.id]) || '';
        html += '<div class="board-cell" data-col-id="' + col.id + '" data-col-type="' + col.type + '">';
        html += renderCellContent(task, col, val);
        html += '</div>';
      });

      /* Hover actions */
      html += '<div class="board-cell" style="border-right:none;position:relative;">';
      html += '<div class="board-row-actions">';
      html += '<button class="board-row-action-btn" onclick="event.stopPropagation();duplicateTask(\'' + task.id + '\')" title="Duplicate">&#x2398;</button>';
      html += '<button class="board-row-action-btn danger" onclick="event.stopPropagation();deleteTask(\'' + task.id + '\')" title="Delete">&times;</button>';
      html += '</div></div>';
      html += '</div>';
    });

    /* Summary row */
    if (groupTasks.length > 0) {
      html += '<div class="board-summary-row" style="grid-template-columns:' + colWidths + ';">';
      html += '<div class="board-summary-cell"></div>';
      html += '<div class="board-summary-cell">' + groupTasks.length + ' items</div>';
      _boardColumns.forEach(function(col) {
        html += '<div class="board-summary-cell">' + getSummaryForColumn(col, groupTasks) + '</div>';
      });
      html += '<div class="board-summary-cell"></div>';
      html += '</div>';
    }

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

/* ═══ INTERACTIVE ENHANCEMENTS ═══ */

/* ─── Search ─── */
var _searchDebounceTimer = null;
function boardSearch(query) {
  clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(function() {
    _boardSearchQuery = query;
    var container = document.getElementById('projects-content');
    if (container) renderBoard(container, dataCache.projects || []);
  }, 200);
}

/* ─── Sorting ─── */
function toggleSort(colId) {
  if (_boardSortCol === colId) {
    if (_boardSortDir === 'asc') _boardSortDir = 'desc';
    else { _boardSortCol = null; _boardSortDir = 'asc'; }
  } else {
    _boardSortCol = colId;
    _boardSortDir = 'asc';
  }
  var container = document.getElementById('projects-content');
  if (container) renderBoard(container, dataCache.projects || []);
}

/* ─── Selection ─── */
function toggleTaskSelect(taskId, checked) {
  if (checked) _boardSelectedTasks[taskId] = true;
  else delete _boardSelectedTasks[taskId];
  updateBulkBar();
  /* Update row highlight */
  var row = document.querySelector('.board-row[data-task-id="' + taskId + '"]');
  if (row) row.classList.toggle('selected', checked);
}

function toggleSelectAll(checked) {
  _boardSelectedTasks = {};
  if (checked) {
    _boardTasks.forEach(function(t) { if (t.project_id === _currentProjectId) _boardSelectedTasks[t.id] = true; });
  }
  var checkboxes = document.querySelectorAll('.board-row input[type="checkbox"]');
  for (var i = 0; i < checkboxes.length; i++) checkboxes[i].checked = checked;
  var rows = document.querySelectorAll('.board-row');
  for (var j = 0; j < rows.length; j++) rows[j].classList.toggle('selected', checked);
  updateBulkBar();
}

function clearSelection() {
  _boardSelectedTasks = {};
  var checkboxes = document.querySelectorAll('.board-row input[type="checkbox"], .board-header-row input[type="checkbox"]');
  for (var i = 0; i < checkboxes.length; i++) checkboxes[i].checked = false;
  var rows = document.querySelectorAll('.board-row');
  for (var j = 0; j < rows.length; j++) rows[j].classList.remove('selected');
  updateBulkBar();
}

function updateBulkBar() {
  var bar = document.getElementById('board-bulk-bar');
  var count = Object.keys(_boardSelectedTasks).length;
  if (bar) {
    bar.classList.toggle('active', count > 0);
    var countEl = bar.querySelector('.board-bulk-count');
    if (countEl) countEl.textContent = count + ' selected';
  }
}

/* ─── Bulk Actions ─── */
function bulkDelete() {
  var ids = Object.keys(_boardSelectedTasks);
  if (ids.length === 0) return;
  customConfirm('Delete ' + ids.length + ' item' + (ids.length > 1 ? 's' : '') + '? This cannot be undone.', async function() {
    try {
      showSaveStatus('saving');
      for (var i = 0; i < ids.length; i++) {
        await resilientWrite(function() { return sb.from('hq_tasks').delete().eq('id', ids[i]); }, 'bulkDelete');
      }
      _boardSelectedTasks = {};
      clearCache('tasks');
      clearCache('taskValues');
      renderProjects();
      showToast(ids.length + ' items deleted.', 'success');
      showSaveStatus('saved');
    } catch (err) { showToast('Failed to delete items.', 'error'); }
  });
}

function bulkDuplicate() {
  var ids = Object.keys(_boardSelectedTasks);
  if (ids.length === 0) return;
  ids.forEach(function(id) { duplicateTask(id); });
  _boardSelectedTasks = {};
}

function bulkMoveGroup() {
  closeAllPickers();
  var ids = Object.keys(_boardSelectedTasks);
  if (ids.length === 0) return;
  var picker = document.createElement('div');
  picker.className = 'board-picker';
  picker.style.position = 'fixed';
  picker.style.top = '50%';
  picker.style.left = '50%';
  picker.style.transform = 'translate(-50%,-50%)';
  var html = '<div style="padding:0.5rem 0.75rem;font-size:var(--text-xs);font-weight:600;color:var(--color-tx-muted);">MOVE ' + ids.length + ' ITEMS TO:</div>';
  _boardGroups.forEach(function(g) {
    html += '<div class="board-picker-option" onclick="executeBulkMove(\'' + g.id + '\')">';
    html += '<div class="board-picker-dot" style="background:' + g.color + ';"></div>';
    html += '<span>' + escapeHtml(g.name) + '</span></div>';
  });
  picker.innerHTML = html;
  document.body.appendChild(picker);
  setTimeout(function() {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

async function executeBulkMove(groupId) {
  closeAllPickers();
  var ids = Object.keys(_boardSelectedTasks);
  try {
    showSaveStatus('saving');
    await resilientWrite(function() {
      return sb.from('hq_tasks').update({ group_id: groupId, updated_at: new Date().toISOString() }).in('id', ids);
    }, 'bulkMove');
    _boardSelectedTasks = {};
    clearCache('tasks');
    renderProjects();
    showToast(ids.length + ' items moved.', 'success');
    showSaveStatus('saved');
  } catch (err) { showToast('Failed to move items.', 'error'); }
}

function bulkSetStatus() {
  closeAllPickers();
  var ids = Object.keys(_boardSelectedTasks);
  if (ids.length === 0) return;
  /* Find first status column */
  var statusCol = _boardColumns.find(function(c) { return c.type === 'status'; });
  if (!statusCol) { showToast('No status column on this board.', 'error'); return; }
  var labels = (statusCol.settings && statusCol.settings.labels) || [];

  var picker = document.createElement('div');
  picker.className = 'board-picker';
  picker.style.position = 'fixed';
  picker.style.top = '50%';
  picker.style.left = '50%';
  picker.style.transform = 'translate(-50%,-50%)';
  var html = '<div style="padding:0.5rem 0.75rem;font-size:var(--text-xs);font-weight:600;color:var(--color-tx-muted);">SET STATUS FOR ' + ids.length + ' ITEMS:</div>';
  labels.forEach(function(l) {
    html += '<div class="board-picker-option" onclick="executeBulkStatus(\'' + statusCol.id + '\',\'' + escapeHtml(l.name) + '\')">';
    html += '<div class="board-picker-dot" style="background:' + l.color + ';"></div>';
    html += '<span>' + escapeHtml(l.name) + '</span></div>';
  });
  picker.innerHTML = html;
  document.body.appendChild(picker);
  setTimeout(function() {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

async function executeBulkStatus(colId, value) {
  closeAllPickers();
  var ids = Object.keys(_boardSelectedTasks);
  try {
    showSaveStatus('saving');
    for (var i = 0; i < ids.length; i++) {
      await saveCellValue(ids[i], colId, value);
    }
    _boardSelectedTasks = {};
    clearCache('taskValues');
    renderProjects();
    showToast(ids.length + ' items updated.', 'success');
    showSaveStatus('saved');
  } catch (err) { showToast('Failed to update items.', 'error'); }
}

/* ─── Row Context Menu ─── */
function openRowContextMenu(event, taskId) {
  event.preventDefault();
  event.stopPropagation();
  closeAllPickers();
  var task = _boardTasks.find(function(t) { return t.id === taskId; });
  if (!task) return;

  var menu = document.createElement('div');
  menu.className = 'board-context-menu';
  var html = '<div class="board-context-item" onclick="closeAllPickers();openDetailPanel(\'' + taskId + '\')">Open Item</div>';
  html += '<div class="board-context-item" onclick="closeAllPickers();duplicateTask(\'' + taskId + '\')">Duplicate</div>';
  html += '<div class="board-context-divider"></div>';
  html += '<div style="padding:0.25rem 0.75rem;font-size:var(--text-xs);color:var(--color-tx-faint);">Move to</div>';
  _boardGroups.forEach(function(g) {
    html += '<div class="board-context-item" onclick="closeAllPickers();moveTaskToGroup(\'' + taskId + '\',\'' + g.id + '\')">';
    html += '<div class="board-picker-dot" style="background:' + g.color + ';width:8px;height:8px;"></div>' + escapeHtml(g.name) + '</div>';
  });
  html += '<div class="board-context-divider"></div>';
  html += '<div class="board-context-item danger" onclick="closeAllPickers();deleteTask(\'' + taskId + '\')">Delete</div>';
  menu.innerHTML = html;
  document.body.appendChild(menu);
  menu.style.left = event.clientX + 'px';
  menu.style.top = event.clientY + 'px';
  /* Keep within viewport */
  requestAnimationFrame(function() {
    var r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) menu.style.left = (window.innerWidth - r.width - 8) + 'px';
    if (r.bottom > window.innerHeight - 8) menu.style.top = (window.innerHeight - r.height - 8) + 'px';
  });
  setTimeout(function() {
    document.addEventListener('click', function handler() { menu.remove(); document.removeEventListener('click', handler); });
  }, 10);
}

/* ─── Duplicate Task ─── */
async function duplicateTask(taskId) {
  var task = _boardTasks.find(function(t) { return t.id === taskId; });
  if (!task) return;
  try {
    showSaveStatus('saving');
    var result = await resilientWrite(function() {
      return sb.from('hq_tasks').insert({
        project_id: task.project_id,
        group_id: task.group_id,
        title: task.title + ' (copy)',
        status: task.status,
        sort_order: (task.sort_order || 0) + 1
      }).select('id').single();
    }, 'duplicateTask');
    /* Copy cell values */
    if (result && result.data && _boardTaskValues[taskId]) {
      var vals = _boardTaskValues[taskId];
      var inserts = [];
      for (var colId in vals) {
        if (vals[colId]) inserts.push({ task_id: result.data.id, column_id: colId, value: vals[colId] });
      }
      if (inserts.length > 0) {
        await resilientWrite(function() { return sb.from('hq_task_values').insert(inserts); }, 'dupValues');
      }
    }
    clearCache('tasks');
    clearCache('taskValues');
    renderProjects();
    showToast('Item duplicated.', 'success');
    showSaveStatus('saved');
  } catch (err) { showToast('Failed to duplicate.', 'error'); }
}

/* ─── Delete Task ─── */
async function deleteTask(taskId) {
  customConfirm('Delete this item?', async function() {
    try {
      showSaveStatus('saving');
      /* Animate removal */
      var row = document.querySelector('.board-row[data-task-id="' + taskId + '"]');
      if (row) row.classList.add('board-row-removing');
      setTimeout(async function() {
        await resilientWrite(function() { return sb.from('hq_tasks').delete().eq('id', taskId); }, 'deleteTask');
        clearCache('tasks');
        clearCache('taskValues');
        delete _boardSelectedTasks[taskId];
        renderProjects();
        showToast('Item deleted.', 'success');
        showSaveStatus('saved');
      }, 200);
    } catch (err) { showToast('Failed to delete.', 'error'); }
  });
}

/* ─── Item Detail Side Panel ─── */
function openDetailPanel(taskId) {
  _boardDetailTaskId = taskId;
  var task = _boardTasks.find(function(t) { return t.id === taskId; });
  if (!task) return;

  var titleEl = document.getElementById('detail-title');
  if (titleEl) {
    titleEl.textContent = task.title;
    titleEl.contentEditable = 'true';
    titleEl.onblur = function() { saveTaskName(taskId, titleEl.textContent.trim(), titleEl); };
    titleEl.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } };
  }

  var body = document.getElementById('detail-body');
  if (body) {
    var html = '';
    /* Column fields */
    _boardColumns.forEach(function(col) {
      var val = (_boardTaskValues[taskId] && _boardTaskValues[taskId][col.id]) || '';
      html += '<div class="board-detail-field">';
      html += '<div class="board-detail-label">' + escapeHtml(col.name) + '</div>';
      html += '<div class="board-detail-value" data-col-id="' + col.id + '" data-task-id="' + taskId + '">';
      html += renderCellContent(task, col, val);
      html += '</div></div>';
    });

    /* Description/Notes section */
    html += '<div class="board-detail-section">';
    html += '<div class="board-detail-section-title">Description</div>';
    var desc = task.description || '';
    html += '<textarea class="board-detail-update-input" placeholder="Add notes or description..." onblur="saveTaskDescription(\'' + taskId + '\',this.value)">' + escapeHtml(desc) + '</textarea>';
    html += '</div>';

    /* Metadata */
    html += '<div class="board-detail-section">';
    html += '<div class="board-detail-section-title">Details</div>';
    html += '<div class="board-detail-field"><div class="board-detail-label">Created</div><div class="board-detail-value" style="color:var(--color-tx-muted);">' + formatDate(task.created_at) + '</div></div>';
    if (task.updated_at) {
      html += '<div class="board-detail-field"><div class="board-detail-label">Last Updated</div><div class="board-detail-value" style="color:var(--color-tx-muted);">' + formatDateTime(task.updated_at) + '</div></div>';
    }
    html += '</div>';

    body.innerHTML = html;
  }

  /* Delete button */
  var delBtn = document.getElementById('detail-delete-btn');
  if (delBtn) delBtn.onclick = function() { closeDetailPanel(); deleteTask(taskId); };

  /* Open panel */
  var panel = document.getElementById('board-detail-panel');
  var overlay = document.getElementById('board-detail-overlay');
  if (panel) panel.classList.add('open');
  if (overlay) overlay.classList.add('open');
}

function closeDetailPanel() {
  _boardDetailTaskId = null;
  var panel = document.getElementById('board-detail-panel');
  var overlay = document.getElementById('board-detail-overlay');
  if (panel) panel.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

async function saveTaskDescription(taskId, desc) {
  try {
    await resilientWrite(function() {
      return sb.from('hq_tasks').update({ description: desc, updated_at: new Date().toISOString() }).eq('id', taskId);
    }, 'saveDesc');
    showSaveStatus('saved');
  } catch (err) { showToast('Failed to save description.', 'error'); }
}

/* ─── Column Summary ─── */
function getSummaryForColumn(col, tasks) {
  if (col.type === 'number') {
    var sum = 0;
    tasks.forEach(function(t) {
      var v = (_boardTaskValues[t.id] && _boardTaskValues[t.id][col.id]) || '';
      var n = parseFloat(v);
      if (!isNaN(n)) sum += n;
    });
    return sum > 0 ? sum.toLocaleString() : '';
  }
  if (col.type === 'status' || col.type === 'priority') {
    var counts = {};
    tasks.forEach(function(t) {
      var v = (_boardTaskValues[t.id] && _boardTaskValues[t.id][col.id]) || '';
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    var entries = Object.keys(counts);
    if (entries.length === 0) return '';
    if (entries.length === 1) return counts[entries[0]] + ' ' + entries[0];
    /* Show top 2 */
    entries.sort(function(a, b) { return counts[b] - counts[a]; });
    return entries.slice(0, 2).map(function(k) { return counts[k] + ' ' + k; }).join(', ');
  }
  if (col.type === 'checkbox') {
    var checked = 0;
    tasks.forEach(function(t) {
      if ((_boardTaskValues[t.id] && _boardTaskValues[t.id][col.id]) === 'true') checked++;
    });
    return checked > 0 ? checked + '/' + tasks.length : '';
  }
  if (col.type === 'date') {
    /* Show earliest upcoming date */
    var dates = [];
    var now = new Date();
    tasks.forEach(function(t) {
      var v = (_boardTaskValues[t.id] && _boardTaskValues[t.id][col.id]) || '';
      if (v) {
        var d = new Date(v);
        if (d >= now) dates.push(d);
      }
    });
    if (dates.length === 0) return '';
    dates.sort(function(a, b) { return a - b; });
    return 'Next: ' + formatDate(dates[0].toISOString());
  }
  return '';
}

/* ─── Auto-Save Indicator ─── */
function showSaveStatus(status) {
  var el = document.getElementById('board-save-status');
  if (!el) return;
  clearTimeout(_saveIndicatorTimer);
  if (status === 'saving') {
    el.className = 'board-save-indicator saving';
    el.innerHTML = '<span class="board-save-dot"></span> Saving...';
  } else if (status === 'saved') {
    el.className = 'board-save-indicator saved';
    el.innerHTML = '<span class="board-save-dot"></span> Saved';
    _saveIndicatorTimer = setTimeout(function() {
      el.className = 'board-save-indicator';
      el.innerHTML = '<span class="board-save-dot"></span> Auto-saved';
    }, 3000);
  }
}

/* ─── Keyboard Navigation ─── */
document.addEventListener('keydown', function(e) {
  /* Escape closes detail panel */
  if (e.key === 'Escape' && _boardDetailTaskId) {
    closeDetailPanel();
    return;
  }
  /* Delete selected items */
  if ((e.key === 'Delete' || e.key === 'Backspace') && Object.keys(_boardSelectedTasks).length > 0 && !e.target.matches('input,textarea,[contenteditable]')) {
    e.preventDefault();
    bulkDelete();
  }
});
