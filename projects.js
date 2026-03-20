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
    fetchStaffList(),
    typeof fetchAutomations === 'function' ? fetchAutomations(projectId, true) : Promise.resolve([])
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
  html += '<div class="board-selector-separator"></div>';
  html += '<button class="btn btn-sm btn-ghost" onclick="openProjectModal(_currentProjectId)" title="Board Settings"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>';
  html += '<button class="btn btn-sm btn-ghost" onclick="openAutomationsPanel()" title="Automations">&#9889;</button>';
  html += '<button class="btn btn-sm btn-ghost" onclick="saveCurrentAsTemplate(_currentProjectId)" title="Save as Template">&#9733;</button>';
  html += '<div class="board-selector-separator"></div>';
  html += '<button class="btn btn-sm btn-primary" onclick="openProjectModalWithTemplates()">+ New Board</button>';
  html += '<span class="board-save-indicator" id="board-save-status"><span class="board-save-dot"></span> Auto-saved</span>';
  html += '</div>';

  /* View Toggle */
  html += '<div class="board-view-toggle">';
  html += '<button class="board-view-btn' + (_boardViewMode === 'table' ? ' active' : '') + '" data-view="table" onclick="switchBoardView(\'table\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Table</button>';
  html += '<button class="board-view-btn' + (_boardViewMode === 'kanban' ? ' active' : '') + '" data-view="kanban" onclick="switchBoardView(\'kanban\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg> Kanban</button>';
  html += '<button class="board-view-btn' + (_boardViewMode === 'timeline' ? ' active' : '') + '" data-view="timeline" onclick="switchBoardView(\'timeline\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg> Timeline</button>';
  html += '<button class="board-view-btn' + (_boardViewMode === 'dashboard' ? ' active' : '') + '" data-view="dashboard" onclick="switchBoardView(\'dashboard\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg> Dashboard</button>';
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

  /* View containers for non-table views */
  html += '<div id="board-kanban-container" style="display:' + (_boardViewMode === 'kanban' ? '' : 'none') + ';"></div>';
  html += '<div id="board-timeline-container" style="display:' + (_boardViewMode === 'timeline' ? '' : 'none') + ';"></div>';
  html += '<div id="board-dashboard-container" style="display:' + (_boardViewMode === 'dashboard' ? '' : 'none') + ';"></div>';

  /* Board wrapper (table view) */
  html += '<div id="board-table-container" style="display:' + (_boardViewMode === 'table' ? '' : 'none') + ';">';
  html += '<div class="board-wrapper">';

  /* Column headers with sort */
  html += '<div class="board-header-row" style="grid-template-columns:' + colWidths + ';">';
  html += '<div class="board-col-header" style="border-right:none;"><input type="checkbox" onchange="toggleSelectAll(this.checked)" style="width:14px;height:14px;cursor:pointer;"></div>';
  html += '<div class="board-col-header' + (_boardSortCol === 'title' ? ' sorted' : '') + '" onclick="toggleSort(\'title\')" style="cursor:pointer;">Item<span class="board-sort-icon">' + (_boardSortCol === 'title' ? (_boardSortDir === 'asc' ? '&#9650;' : '&#9660;') : '&#9650;') + '</span></div>';
  _boardColumns.forEach(function(col) {
    var isSorted = _boardSortCol === col.id;
    html += '<div class="board-col-header' + (isSorted ? ' sorted' : '') + '" data-col-id="' + col.id + '" onclick="toggleSort(\'' + col.id + '\')" style="cursor:pointer;" title="' + escapeHtml(col.name) + '">';
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
    html += '<div class="board-group-header" style="border-left:6px solid ' + group.color + ';background:' + group.color + '20;" onclick="toggleGroupCollapse(\'' + group.id + '\')">';
    html += '<span class="board-group-toggle' + (isCollapsed ? ' collapsed' : '') + '"><svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 2l4 4-4 4"/></svg></span>';
    html += '<span class="board-group-name" onclick="event.stopPropagation()" ondblclick="this.contentEditable=true;this.focus()" onblur="saveGroupName(this,\'' + group.id + '\')" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur()}">' + escapeHtml(group.name) + '</span>';
    html += '<span class="board-group-count">' + groupTasks.length + ' item' + (groupTasks.length !== 1 ? 's' : '') + '</span>';
    html += '<button class="board-group-menu" onclick="event.stopPropagation();openGroupMenu(event,\'' + group.id + '\')">&#8943;</button>';
    html += '</div>';

    /* Group body */
    html += '<div class="board-group-body' + (isCollapsed ? ' collapsed' : '') + '" style="' + (isCollapsed ? 'max-height:0;' : '') + '">';

    /* Task rows */
    groupTasks.forEach(function(task) {
      var isSelected = _boardSelectedTasks[task.id];
      html += '<div class="board-row' + (isSelected ? ' selected' : '') + '" data-task-id="' + task.id + '" style="grid-template-columns:' + colWidths + ';--group-color:' + group.color + ';" draggable="true" ondragstart="onTaskDragStart(event,\'' + task.id + '\')" ondragend="onTaskDragEnd(event)" oncontextmenu="openRowContextMenu(event,\'' + task.id + '\')">';
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
    html += '<div style="display:flex;align-items:center;gap:0.25rem;padding-left:0.5rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--color-tx-faint);flex-shrink:0;"><path d="M12 5v14M5 12h14"/></svg><input type="text" class="board-add-item-input" placeholder="Add item" onkeydown="if(event.key===\'Enter\'&&this.value.trim()){addTaskToGroup(\'' + group.id + '\',this.value.trim());this.value=\'\';}" data-group-id="' + group.id + '"></div>';
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
  html += '</div>'; /* board-table-container */

  /* Drop zone listeners */
  container.innerHTML = html;

  /* Render non-table views if active */
  if (_boardViewMode === 'kanban') renderKanbanView();
  else if (_boardViewMode === 'timeline') renderTimelineView();
  else if (_boardViewMode === 'dashboard') renderDashboardView();

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
      var isLightStatus = _isLightColor(statusColor);
      return '<div class="board-status-pill' + (isLightStatus ? ' light-bg' : '') + '" style="background:' + statusColor + ';" onclick="event.stopPropagation();openStatusPicker(event,\'' + task.id + '\',\'' + col.id + '\')">' + escapeHtml(val) + '</div>';

    case 'person':
      if (!val) return '<div class="board-person-empty" onclick="event.stopPropagation();openPersonPicker(event,\'' + task.id + '\',\'' + col.id + '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>';
      var person = _boardStaff.find(function(s) { return s.auth_user_id === val || s.id === val; });
      var pName = person ? ((person.first_name || '') + ' ' + (person.last_name || '')).trim() : 'Unknown';
      var pInitials = person ? ((person.first_name || '').charAt(0) + (person.last_name || '').charAt(0)).toUpperCase() : '?';
      var pColor = PERSON_COLORS[Math.abs(hashStr(val)) % PERSON_COLORS.length];
      return '<div class="board-person-avatar" style="background:' + pColor + ';" onclick="event.stopPropagation();openPersonPicker(event,\'' + task.id + '\',\'' + col.id + '\')" title="' + escapeHtml(pName) + '">' + escapeHtml(pInitials) + '</div>';

    case 'date':
      if (!val) return '<span class="board-date-display" onclick="event.stopPropagation();startDateEdit(this,\'' + task.id + '\',\'' + col.id + '\')">—</span>';
      return '<span class="board-date-display" onclick="event.stopPropagation();startDateEdit(this,\'' + task.id + '\',\'' + col.id + '\')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:0.5;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + formatDate(val) + '</span>';

    case 'priority':
      labels = settings.labels || [];
      if (!val) return '<div class="board-status-empty" onclick="event.stopPropagation();openPriorityPicker(event,\'' + task.id + '\',\'' + col.id + '\')"></div>';
      var priLabel = labels.find(function(l) { return l.name === val; });
      var priColor = priLabel ? priLabel.color : '#c4c4c4';
      var isLightPri = _isLightColor(priColor);
      return '<div class="board-priority-label' + (isLightPri ? ' light-bg' : '') + '" style="background:' + priColor + ';" onclick="event.stopPropagation();openPriorityPicker(event,\'' + task.id + '\',\'' + col.id + '\')">' + escapeHtml(val) + '</div>';

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

/* Determine if a hex color is light (needs dark text) */
function _isLightColor(hex) {
  if (!hex || hex.charAt(0) !== '#') return false;
  var c = hex.replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  var r = parseInt(c.substring(0, 2), 16);
  var g = parseInt(c.substring(2, 4), 16);
  var b = parseInt(c.substring(4, 6), 16);
  /* Perceived luminance formula */
  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
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
  return '<span class="board-date-display" onclick="event.stopPropagation();startDateEdit(this,\'' + taskId + '\',\'' + colId + '\')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:0.5;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + formatDate(val) + '</span>';
}

/* ─── Save Cell Value ─── */
async function saveCellValue(taskId, colId, newValue) {
  /* Capture old value before optimistic update */
  var oldValue = (_boardTaskValues[taskId] && _boardTaskValues[taskId][colId]) || '';

  /* Optimistic update */
  if (!_boardTaskValues[taskId]) _boardTaskValues[taskId] = {};
  _boardTaskValues[taskId][colId] = newValue;

  /* Determine column name for activity log */
  var col = _boardColumns.find(function(c) { return c.id === colId; });
  var colName = col ? col.name : 'field';

  /* Log activity if value actually changed */
  if (String(oldValue) !== String(newValue)) {
    var action = (col && col.type === 'person') ? 'assign' : (col && (col.type === 'status' || col.type === 'priority') ? 'status_change' : 'update');
    /* For person column, resolve name for activity log */
    var newDisplay = newValue;
    var oldDisplay = oldValue;
    if (col && col.type === 'person') {
      var newPerson = _boardStaff.find(function(s) { return s.auth_user_id === newValue || s.id === newValue; });
      var oldPerson = _boardStaff.find(function(s) { return s.auth_user_id === oldValue || s.id === oldValue; });
      newDisplay = newPerson ? ((newPerson.first_name || '') + ' ' + (newPerson.last_name || '')).trim() : newValue;
      oldDisplay = oldPerson ? ((oldPerson.first_name || '') + ' ' + (oldPerson.last_name || '')).trim() : oldValue;
      /* Send notification to newly assigned person */
      if (newValue && newValue !== oldValue) {
        var assigneeId = newPerson ? (newPerson.auth_user_id || newPerson.id) : newValue;
        var task = _boardTasks.find(function(t) { return t.id === taskId; });
        var assignerName = (currentProfile && currentProfile.full_name) || 'Someone';
        sendInAppNotification(assigneeId, 'You were assigned to "' + (task ? task.title : 'a task') + '"', assignerName + ' assigned you', '#projects', taskId);
      }
    }
    logTaskActivity(taskId, action, colName, oldDisplay, newDisplay);
    /* Check automations after mutation */
    if (typeof checkAutomations === 'function') {
      checkAutomations('value_changed', { taskId: taskId, colId: colId, colType: col ? col.type : '', colName: colName, oldValue: oldValue, newValue: newValue });
    }
  }

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
        width: type === 'text' ? 200 : (type === 'status' || type === 'priority' ? 160 : 150),
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
    var newTaskResult = await resilientWrite(function() {
      return sb.from('hq_tasks').insert({
        project_id: _currentProjectId,
        group_id: groupId,
        title: title,
        status: 'Backlog',
        sort_order: maxOrder + 1
      }).select('id').single();
    }, 'addTask');
    if (newTaskResult && newTaskResult.data) {
      logTaskActivity(newTaskResult.data.id, 'create', null, null, title);
      if (typeof checkAutomations === 'function') {
        checkAutomations('item_created', { taskId: newTaskResult.data.id, groupId: groupId, title: title });
      }
    }
    clearCache('tasks');
    renderProjects();
  } catch (err) { showToast('Failed to add item.', 'error'); }
}

async function moveTaskToGroup(taskId, newGroupId) {
  var task = _boardTasks.find(function(t) { return t.id === taskId; });
  var oldGroup = task ? _boardGroups.find(function(g) { return g.id === task.group_id; }) : null;
  var newGroup = _boardGroups.find(function(g) { return g.id === newGroupId; });
  try {
    await resilientWrite(function() {
      return sb.from('hq_tasks').update({ group_id: newGroupId, updated_at: new Date().toISOString() }).eq('id', taskId);
    }, 'moveTask');
    logTaskActivity(taskId, 'move', 'Group', oldGroup ? oldGroup.name : '', newGroup ? newGroup.name : '');
    if (typeof checkAutomations === 'function') {
      checkAutomations('group_changed', { taskId: taskId, oldGroupId: task ? task.group_id : null, newGroupId: newGroupId });
    }
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
    /* For new boards, redirect to template-aware modal */
    closeModal('hq-modal');
    openProjectModalWithTemplates();
    return;
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
  var task = _boardTasks.find(function(t) { return t.id === taskId; });
  customConfirm('Delete this item?', async function() {
    try {
      showSaveStatus('saving');
      logTaskActivity(taskId, 'delete', null, task ? task.title : '', null);
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

    /* Comments section */
    html += '<div class="board-detail-section">';
    html += '<div class="board-detail-section-title">Comments</div>';
    html += '<div class="board-detail-comments" id="detail-comments-list"><div class="skeleton" style="height:40px;"></div></div>';
    html += '<div class="board-comment-input-wrap">';
    html += '<textarea class="board-comment-input" id="detail-comment-input" placeholder="Write a comment..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();postComment(\'' + taskId + '\');}" rows="2"></textarea>';
    html += '<button class="btn btn-primary btn-sm" onclick="postComment(\'' + taskId + '\')" style="align-self:flex-end;">Post</button>';
    html += '</div>';
    html += '</div>';

    /* Attachments section */
    html += '<div class="board-detail-section">';
    html += '<div class="board-detail-section-title">Attachments</div>';
    html += '<div class="board-detail-attachments">';
    html += '<div id="detail-attachments-list"><div class="skeleton" style="height:40px;"></div></div>';
    html += '<div class="board-attachment-dropzone" ondragover="handleAttachmentDragOver(event)" ondragleave="handleAttachmentDragLeave(event)" ondrop="handleAttachmentDrop(event,\'' + taskId + '\')">';
    html += '<span>Drop files here or </span>';
    html += '<button class="btn btn-ghost btn-sm" onclick="triggerAttachmentUpload(\'' + taskId + '\')">browse</button>';
    html += '<input type="file" id="detail-attachment-input" multiple style="display:none;">';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    /* Activity timeline */
    html += '<div class="board-detail-section">';
    html += '<div class="board-detail-section-title">Activity</div>';
    html += '<div class="board-activity-timeline" id="detail-activity-list"><div class="skeleton" style="height:40px;"></div></div>';
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

    /* Load comments, attachments, and activity asynchronously */
    renderComments(taskId);
    renderAttachments(taskId);
    renderActivityLog(taskId);
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
    var colLabels = (col.settings && col.settings.labels) || [];
    tasks.forEach(function(t) {
      var v = (_boardTaskValues[t.id] && _boardTaskValues[t.id][col.id]) || '';
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    var entries = Object.keys(counts);
    if (entries.length === 0) return '';
    entries.sort(function(a, b) { return counts[b] - counts[a]; });
    return entries.slice(0, 3).map(function(k) {
      var lbl = colLabels.find(function(l) { return l.name === k; });
      var dotColor = lbl ? lbl.color : '#c4c4c4';
      return '<span style="display:inline-flex;align-items:center;gap:2px;"><span style="width:6px;height:6px;border-radius:50%;background:' + dotColor + ';display:inline-block;flex-shrink:0;"></span>' + counts[k] + ' ' + escapeHtml(k) + '</span>';
    }).join(' &middot; ');
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

/* ─── Comments ─── */
async function renderComments(taskId) {
  var container = document.getElementById('detail-comments-list');
  if (!container) return;
  try {
    var comments = await fetchTaskComments(taskId, true);
    if (_boardDetailTaskId !== taskId) return; /* panel switched */
    if (comments.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--color-tx-faint);font-size:var(--text-xs);">No comments yet</div>';
      return;
    }
    var html = '';
    comments.forEach(function(c) {
      var initials = (c.user_name || 'U').split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();
      var pColor = PERSON_COLORS[Math.abs(hashStr(c.user_id || '')) % PERSON_COLORS.length];
      var isOwn = currentUser && c.user_id === currentUser.id;
      html += '<div class="board-comment" data-comment-id="' + c.id + '">';
      html += '<div class="board-comment-header">';
      html += '<div class="board-person-avatar" style="background:' + pColor + ';width:24px;height:24px;font-size:0.5rem;">' + escapeHtml(initials) + '</div>';
      html += '<span class="board-comment-author">' + escapeHtml(c.user_name || 'Unknown') + '</span>';
      html += '<span class="board-comment-time">' + timeAgo(c.created_at) + '</span>';
      if (isOwn) {
        html += '<button class="board-comment-delete" onclick="deleteComment(\'' + c.id + '\',\'' + taskId + '\')" title="Delete">&times;</button>';
      }
      html += '</div>';
      html += '<div class="board-comment-body">' + escapeHtml(c.content).replace(/\n/g, '<br>') + '</div>';
      html += '</div>';
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    container.innerHTML = '<div style="color:var(--color-error);font-size:var(--text-xs);padding:0.5rem;">Failed to load comments</div>';
  }
}

async function postComment(taskId) {
  var input = document.getElementById('detail-comment-input');
  if (!input) return;
  var content = input.value.trim();
  if (!content) return;

  var userName = (currentProfile && currentProfile.full_name) || (currentUser && currentUser.email) || 'Unknown';
  var userId = currentUser ? currentUser.id : null;

  input.value = '';
  try {
    await resilientWrite(function() {
      return sb.from('hq_task_comments').insert({
        task_id: taskId,
        user_id: userId,
        user_name: userName,
        content: content
      });
    }, 'postComment');
    clearCache('taskComments');
    renderComments(taskId);
    logTaskActivity(taskId, 'comment', null, null, content.substring(0, 100));

    /* Notify assigned person if different from commenter */
    var personCol = _boardColumns.find(function(c) { return c.type === 'person'; });
    if (personCol && _boardTaskValues[taskId]) {
      var assignedId = _boardTaskValues[taskId][personCol.id];
      if (assignedId && assignedId !== userId) {
        var task = _boardTasks.find(function(t) { return t.id === taskId; });
        sendInAppNotification(assignedId, 'New comment on "' + (task ? task.title : 'task') + '"', userName + ': ' + content.substring(0, 80), '#projects', taskId);
      }
    }
    showToast('Comment posted.', 'success');
  } catch (err) {
    showToast('Failed to post comment.', 'error');
  }
}

async function deleteComment(commentId, taskId) {
  customConfirm('Delete this comment?', async function() {
    try {
      await resilientWrite(function() {
        return sb.from('hq_task_comments').delete().eq('id', commentId);
      }, 'deleteComment');
      clearCache('taskComments');
      renderComments(taskId);
      logTaskActivity(taskId, 'delete_comment', null, null, null);
      showToast('Comment deleted.', 'success');
    } catch (err) { showToast('Failed to delete comment.', 'error'); }
  });
}

/* ─── Activity Timeline ─── */
async function renderActivityLog(taskId) {
  var container = document.getElementById('detail-activity-list');
  if (!container) return;
  try {
    var activity = await fetchTaskActivity(taskId, true);
    if (_boardDetailTaskId !== taskId) return;
    if (activity.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--color-tx-faint);font-size:var(--text-xs);">No activity yet</div>';
      return;
    }
    var html = '';
    activity.forEach(function(a) {
      var desc = formatActivityDescription(a);
      var dotColor = getActivityDotColor(a.action);
      html += '<div class="board-activity-item">';
      html += '<div class="activity-dot" style="background:' + dotColor + ';"></div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div class="board-activity-text">' + desc + '</div>';
      html += '<div class="board-activity-time">' + timeAgo(a.created_at) + '</div>';
      html += '</div></div>';
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="color:var(--color-error);font-size:var(--text-xs);padding:0.5rem;">Failed to load activity</div>';
  }
}

function formatActivityDescription(a) {
  var name = '<strong>' + escapeHtml(a.user_name || 'Someone') + '</strong>';
  switch (a.action) {
    case 'create': return name + ' created this item';
    case 'update':
      if (a.field_name && a.new_value) return name + ' changed <strong>' + escapeHtml(a.field_name) + '</strong> to "' + escapeHtml(a.new_value) + '"';
      if (a.field_name) return name + ' updated <strong>' + escapeHtml(a.field_name) + '</strong>';
      return name + ' updated this item';
    case 'move': return name + ' moved item to group "' + escapeHtml(a.new_value || '') + '"';
    case 'delete': return name + ' deleted this item';
    case 'comment': return name + ' commented: "' + escapeHtml((a.new_value || '').substring(0, 60)) + (a.new_value && a.new_value.length > 60 ? '...' : '') + '"';
    case 'delete_comment': return name + ' deleted a comment';
    case 'assign':
      if (a.new_value) return name + ' assigned <strong>' + escapeHtml(a.new_value) + '</strong>';
      return name + ' unassigned person';
    case 'status_change': return name + ' changed status to "' + escapeHtml(a.new_value || '') + '"';
    default: return name + ' ' + escapeHtml(a.action || 'performed an action');
  }
}

function getActivityDotColor(action) {
  switch (action) {
    case 'create': return '#00c875';
    case 'comment': return '#579bfc';
    case 'delete':
    case 'delete_comment': return '#e2445c';
    case 'assign': return '#a25ddc';
    case 'status_change': return '#fdab3d';
    default: return '#c4c4c4';
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  var now = Date.now();
  var then = new Date(dateStr).getTime();
  var diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return formatDate(dateStr);
}

/* ═══ PHASE 4 UI: FILE ATTACHMENTS ═══ */

async function renderAttachments(taskId) {
  var container = document.getElementById('detail-attachments-list');
  if (!container) return;
  try {
    var attachments = await fetchTaskAttachments(taskId, true);
    if (_boardDetailTaskId !== taskId) return;
    if (attachments.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--color-tx-faint);font-size:var(--text-xs);">No attachments yet</div>';
      return;
    }
    var html = '';
    attachments.forEach(function(a) {
      var ext = (a.file_name || '').split('.').pop().toLowerCase();
      var iconClass = 'board-attachment-icon';
      var iconText = ext.toUpperCase().substring(0, 4);
      html += '<div class="board-attachment-item" data-attachment-id="' + a.id + '">';
      html += '<div class="' + iconClass + '">' + escapeHtml(iconText) + '</div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:var(--text-xs);font-weight:500;color:var(--color-tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + escapeHtml(a.file_name) + '">' + escapeHtml(a.file_name) + '</div>';
      html += '<div style="font-size:0.625rem;color:var(--color-tx-faint);">' + formatFileSize(a.file_size) + ' &middot; ' + timeAgo(a.created_at) + '</div>';
      html += '</div>';
      html += '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(a.public_url || '#') + '" target="_blank" rel="noopener" title="Download" style="padding:0.25rem;">&#x2B07;</a>';
      html += '<button class="btn btn-ghost btn-sm" onclick="deleteAttachment(\'' + a.id + '\',\'' + escapeHtml(a.storage_path || '') + '\',\'' + taskId + '\')" title="Delete" style="padding:0.25rem;color:var(--color-error);">&times;</button>';
      html += '</div>';
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="color:var(--color-error);font-size:var(--text-xs);padding:0.5rem;">Failed to load attachments</div>';
  }
}

async function uploadAttachment(taskId, file) {
  if (!file || !taskId) return;
  var task = _boardTasks.find(function(t) { return t.id === taskId; });
  var projectId = task ? task.project_id : _currentProjectId;
  var storagePath = projectId + '/' + taskId + '/' + Date.now() + '_' + file.name;

  try {
    showToast('Uploading ' + file.name + '...', 'info');
    var uploadResult = await sb.storage.from('hq-attachments').upload(storagePath, file, { upsert: false });
    if (uploadResult.error) { showToast('Upload failed: ' + uploadResult.error.message, 'error'); return; }

    var publicUrlResult = sb.storage.from('hq-attachments').getPublicUrl(storagePath);
    var publicUrl = (publicUrlResult && publicUrlResult.data) ? publicUrlResult.data.publicUrl : '';

    var userName = (currentProfile && currentProfile.full_name) || (currentUser && currentUser.email) || 'Unknown';
    await resilientWrite(function() {
      return sb.from('hq_task_attachments').insert({
        task_id: taskId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_path: storagePath,
        public_url: publicUrl,
        uploaded_by: currentUser ? currentUser.id : null,
        uploaded_by_name: userName
      });
    }, 'insertAttachment');

    clearCache('taskAttachments');
    renderAttachments(taskId);
    logTaskActivity(taskId, 'attach', null, null, file.name);
    showToast('File uploaded.', 'success');
  } catch (err) {
    console.error('[uploadAttachment]', err);
    showToast('Failed to upload file.', 'error');
  }
}

function deleteAttachment(attachmentId, storagePath, taskId) {
  customConfirm('Delete this attachment?', async function() {
    try {
      if (storagePath) {
        await sb.storage.from('hq-attachments').remove([storagePath]);
      }
      await resilientWrite(function() {
        return sb.from('hq_task_attachments').delete().eq('id', attachmentId);
      }, 'deleteAttachment');
      clearCache('taskAttachments');
      renderAttachments(taskId);
      logTaskActivity(taskId, 'delete_attachment', null, null, null);
      showToast('Attachment deleted.', 'success');
    } catch (err) { showToast('Failed to delete attachment.', 'error'); }
  });
}

function triggerAttachmentUpload(taskId) {
  var input = document.getElementById('detail-attachment-input');
  if (!input) return;
  input.onchange = function() {
    if (input.files && input.files.length > 0) {
      for (var i = 0; i < input.files.length; i++) {
        uploadAttachment(taskId, input.files[i]);
      }
      input.value = '';
    }
  };
  input.click();
}

function handleAttachmentDrop(event, taskId) {
  event.preventDefault();
  event.stopPropagation();
  var dropzone = event.currentTarget;
  dropzone.classList.remove('dragover');
  var files = event.dataTransfer.files;
  if (files && files.length > 0) {
    for (var i = 0; i < files.length; i++) {
      uploadAttachment(taskId, files[i]);
    }
  }
}

function handleAttachmentDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('dragover');
}

function handleAttachmentDragLeave(event) {
  event.currentTarget.classList.remove('dragover');
}


/* ═══ PHASE 7 UI: BOARD TEMPLATES ═══ */

var _selectedTemplateId = null;

async function openProjectModalWithTemplates() {
  /* Called for new board only */
  var title = 'New Board';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');

  var templates = [];
  try {
    templates = await fetchBoardTemplates();
  } catch (err) { console.error('[fetchBoardTemplates]', err); }

  _selectedTemplateId = null;

  var html = '<div class="board-template-section">';
  html += '<label class="field-label">Start from a template</label>';
  html += '<div class="board-template-grid">';
  /* Blank board option */
  html += '<div class="board-template-card selected" data-template-id="" onclick="selectTemplate(this,\'\')">';
  html += '<div class="board-template-card-icon" style="background:var(--color-surface-offset);">&#9776;</div>';
  html += '<div class="board-template-card-name">Blank Board</div>';
  html += '<div class="board-template-card-desc">Start with default columns</div>';
  html += '</div>';
  templates.forEach(function(t) {
    html += '<div class="board-template-card" data-template-id="' + t.id + '" onclick="selectTemplate(this,\'' + t.id + '\')">';
    html += '<div class="board-template-card-icon" style="background:var(--color-primary-hl);color:var(--color-primary);">' + (t.is_system ? '&#9733;' : '&#9998;') + '</div>';
    html += '<div class="board-template-card-name">' + escapeHtml(t.name) + '</div>';
    html += '<div class="board-template-card-desc">' + escapeHtml(t.description || 'Custom template') + '</div>';
    html += '</div>';
  });
  html += '</div></div>';

  html += '<div class="form-row"><label class="field-label">Board Name</label><input type="text" id="proj-name" class="input-field" placeholder="Board name"></div>';
  html += '<div class="form-row"><label class="field-label">Description</label><textarea id="proj-desc" class="input-field" placeholder="What is this board for?"></textarea></div>';

  body.innerHTML = html;

  var footer = document.getElementById('hq-modal-footer');
  footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Create</button>';
  document.getElementById('hq-modal-save').onclick = function() { saveProjectFromTemplate(); };
  openModal('hq-modal');
}

function selectTemplate(el, templateId) {
  _selectedTemplateId = templateId || null;
  var cards = el.parentElement.querySelectorAll('.board-template-card');
  for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
  el.classList.add('selected');
}

async function saveProjectFromTemplate() {
  var name = document.getElementById('proj-name').value.trim();
  if (!name) { showToast('Board name is required.', 'error'); return; }
  var desc = document.getElementById('proj-desc').value.trim();

  try {
    var data = { name: name, description: desc, owner_id: currentUser ? currentUser.id : null, status: 'In Progress' };
    var result = await resilientWrite(function() { return sb.from('hq_projects').insert(data).select('id').single(); }, 'insertProject');
    if (!result || !result.data) { showToast('Failed to create board.', 'error'); return; }

    var newProjectId = result.data.id;
    _currentProjectId = newProjectId;

    if (_selectedTemplateId) {
      await createFromTemplate(_selectedTemplateId, newProjectId);
    } else {
      await initBoardDefaults(newProjectId);
    }

    clearCache('projects');
    closeModal('hq-modal');
    renderProjects();
    showToast('Board created!', 'success');
  } catch (err) {
    console.error('[saveProjectFromTemplate]', err);
    showToast('Failed to create board.', 'error');
  }
}

async function createFromTemplate(templateId, projectId) {
  try {
    var templates = await fetchBoardTemplates();
    var tpl = templates.find(function(t) { return t.id === templateId; });
    if (!tpl || !tpl.template_data) {
      await initBoardDefaults(projectId);
      return;
    }
    var tData = tpl.template_data;

    /* Insert groups */
    if (tData.groups && tData.groups.length > 0) {
      var groups = tData.groups.map(function(g, idx) {
        return { project_id: projectId, name: g.name, color: g.color || GROUP_COLORS[idx % GROUP_COLORS.length], sort_order: idx };
      });
      await resilientWrite(function() { return sb.from('hq_board_groups').insert(groups); }, 'tplGroups');
    } else {
      /* Fallback defaults */
      await resilientWrite(function() {
        return sb.from('hq_board_groups').insert([
          { project_id: projectId, name: 'To Do', color: '#579bfc', sort_order: 0 },
          { project_id: projectId, name: 'In Progress', color: '#fdab3d', sort_order: 1 },
          { project_id: projectId, name: 'Done', color: '#00c875', sort_order: 2 }
        ]);
      }, 'tplDefaultGroups');
    }

    /* Insert columns */
    if (tData.columns && tData.columns.length > 0) {
      var columns = tData.columns.map(function(c, idx) {
        return {
          project_id: projectId,
          name: c.name,
          type: c.type || 'text',
          sort_order: idx,
          width: c.width || 140,
          settings: c.settings || {}
        };
      });
      await resilientWrite(function() { return sb.from('hq_board_columns').insert(columns); }, 'tplColumns');
    }

    clearCache('boardGroups');
    clearCache('boardColumns');
  } catch (err) {
    console.error('[createFromTemplate]', err);
    showToast('Template applied with defaults.', 'info');
    await initBoardDefaults(projectId);
  }
}

async function saveCurrentAsTemplate(projectId) {
  var proj = (dataCache.projects || []).find(function(p) { return p.id === projectId; });
  var projName = proj ? proj.name : 'Untitled';

  var tplName = prompt('Template name:', projName + ' Template');
  if (!tplName) return;

  try {
    var groups = await fetchBoardGroups(projectId, true);
    var columns = await fetchBoardColumns(projectId, true);

    var templateData = {
      groups: groups.map(function(g) { return { name: g.name, color: g.color }; }),
      columns: columns.map(function(c) { return { name: c.name, type: c.type, width: c.width, settings: c.settings }; })
    };

    await resilientWrite(function() {
      return sb.from('hq_board_templates').insert({
        name: tplName,
        description: 'Created from "' + projName + '"',
        template_data: templateData,
        is_system: false,
        created_by: currentUser ? currentUser.id : null
      });
    }, 'saveTemplate');
    clearCache('boardTemplates');
    showToast('Template saved!', 'success');
  } catch (err) {
    console.error('[saveCurrentAsTemplate]', err);
    showToast('Failed to save template.', 'error');
  }
}


/* ═══ VIEW TOGGLE SYSTEM ═══ */

var _boardViewMode = 'table';

function switchBoardView(mode) {
  _boardViewMode = mode;
  /* Update toggle button states */
  var btns = document.querySelectorAll('.board-view-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-view') === mode);
  }
  /* Show/hide containers */
  var tableEl = document.getElementById('board-table-container');
  var kanbanEl = document.getElementById('board-kanban-container');
  var timelineEl = document.getElementById('board-timeline-container');
  var dashboardEl = document.getElementById('board-dashboard-container');
  if (tableEl) tableEl.style.display = (mode === 'table') ? '' : 'none';
  if (kanbanEl) kanbanEl.style.display = (mode === 'kanban') ? '' : 'none';
  if (timelineEl) timelineEl.style.display = (mode === 'timeline') ? '' : 'none';
  if (dashboardEl) dashboardEl.style.display = (mode === 'dashboard') ? '' : 'none';

  /* Render the selected view */
  if (mode === 'kanban') renderKanbanView();
  else if (mode === 'timeline') renderTimelineView();
  else if (mode === 'dashboard') renderDashboardView();
}


/* ═══ PHASE 5: TIMELINE/GANTT VIEW ═══ */

var _timelineZoom = 'week'; /* day | week | month */

function renderTimelineView() {
  var container = document.getElementById('board-timeline-container');
  if (!container) return;

  /* Find date columns */
  var dateCol = _boardColumns.find(function(c) { return c.type === 'date'; });
  if (!dateCol) {
    container.innerHTML = '<div class="empty-state" style="padding:3rem;"><div class="empty-state-title">No date column</div><div class="empty-state-text">Add a Date column to your board to use Timeline view.</div></div>';
    return;
  }

  /* Compute date range */
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var allDates = [];
  var tasksWithDates = [];
  var tasksWithoutDates = [];

  _boardTasks.forEach(function(t) {
    var dateVal = (_boardTaskValues[t.id] && _boardTaskValues[t.id][dateCol.id]) || '';
    if (dateVal) {
      var d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        allDates.push(d);
        tasksWithDates.push({ task: t, date: d });
      } else {
        tasksWithoutDates.push(t);
      }
    } else {
      tasksWithoutDates.push(t);
    }
  });

  /* Range: 2 weeks before today to 4 weeks after, or encompass all dates */
  var rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 14);
  var rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 28);

  allDates.forEach(function(d) {
    if (d < rangeStart) rangeStart = new Date(d.getTime() - 7 * 86400000);
    if (d > rangeEnd) rangeEnd = new Date(d.getTime() + 7 * 86400000);
  });

  /* Generate day slots */
  var days = [];
  var cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  /* Zoom factor */
  var dayWidth = _timelineZoom === 'day' ? 40 : (_timelineZoom === 'month' ? 8 : 20);
  var totalWidth = days.length * dayWidth;

  var html = '';

  /* Zoom controls */
  html += '<div class="timeline-zoom-controls">';
  html += '<button class="btn btn-sm' + (_timelineZoom === 'day' ? ' btn-primary' : ' btn-ghost') + '" onclick="_timelineZoom=\'day\';renderTimelineView()">Day</button>';
  html += '<button class="btn btn-sm' + (_timelineZoom === 'week' ? ' btn-primary' : ' btn-ghost') + '" onclick="_timelineZoom=\'week\';renderTimelineView()">Week</button>';
  html += '<button class="btn btn-sm' + (_timelineZoom === 'month' ? ' btn-primary' : ' btn-ghost') + '" onclick="_timelineZoom=\'month\';renderTimelineView()">Month</button>';
  html += '</div>';

  html += '<div class="timeline-container">';

  /* Sidebar: tasks without dates */
  if (tasksWithoutDates.length > 0) {
    html += '<div class="timeline-sidebar">';
    html += '<div style="font-size:var(--text-xs);font-weight:600;color:var(--color-tx-muted);padding:0.5rem;border-bottom:1px solid var(--color-divider);">No Date (' + tasksWithoutDates.length + ')</div>';
    tasksWithoutDates.forEach(function(t) {
      html += '<div class="timeline-sidebar-item" onclick="openDetailPanel(\'' + t.id + '\')">' + escapeHtml(t.title) + '</div>';
    });
    html += '</div>';
  }

  /* Main timeline */
  html += '<div class="timeline-scroll-area">';

  /* Date header */
  html += '<div class="timeline-header" style="width:' + totalWidth + 'px;">';
  html += '<div class="timeline-dates">';

  /* Month labels */
  var lastMonth = -1;
  days.forEach(function(d, idx) {
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      html += '<div class="timeline-month-label" style="left:' + (idx * dayWidth) + 'px;">' + monthNames[d.getMonth()] + ' ' + d.getFullYear() + '</div>';
    }
  });
  html += '</div>';

  /* Day labels */
  html += '<div class="timeline-day-labels">';
  days.forEach(function(d, idx) {
    var isToday = d.toDateString() === today.toDateString();
    var isWeekend = d.getDay() === 0 || d.getDay() === 6;
    var showLabel = _timelineZoom === 'day' || (_timelineZoom === 'week' && d.getDay() === 1) || (_timelineZoom === 'month' && d.getDate() === 1);
    html += '<div class="timeline-day-cell' + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '') + '" style="width:' + dayWidth + 'px;left:' + (idx * dayWidth) + 'px;">';
    if (showLabel) html += '<span>' + d.getDate() + '</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '</div>'; /* timeline-header */

  /* Timeline body */
  html += '<div class="timeline-body" style="width:' + totalWidth + 'px;">';

  /* Today line */
  var todayIdx = -1;
  for (var di = 0; di < days.length; di++) {
    if (days[di].toDateString() === today.toDateString()) { todayIdx = di; break; }
  }
  if (todayIdx >= 0) {
    html += '<div class="timeline-today-line" style="left:' + (todayIdx * dayWidth + dayWidth / 2) + 'px;"></div>';
  }

  /* Group rows */
  _boardGroups.forEach(function(group) {
    var groupTasksWithDates = tasksWithDates.filter(function(td) { return td.task.group_id === group.id; });
    if (groupTasksWithDates.length === 0) return;

    html += '<div class="timeline-group-header" style="border-left:3px solid ' + group.color + ';">' + escapeHtml(group.name) + ' (' + groupTasksWithDates.length + ')</div>';

    groupTasksWithDates.forEach(function(td) {
      var dayOffset = Math.round((td.date.getTime() - rangeStart.getTime()) / 86400000);
      var barLeft = dayOffset * dayWidth;
      var barWidth = Math.max(dayWidth, dayWidth * 3); /* Minimum 3 days wide */

      /* Status color */
      var statusCol = _boardColumns.find(function(c) { return c.type === 'status'; });
      var statusVal = statusCol ? ((_boardTaskValues[td.task.id] && _boardTaskValues[td.task.id][statusCol.id]) || '') : '';
      var barColor = group.color;
      if (statusCol && statusCol.settings && statusCol.settings.labels) {
        var label = statusCol.settings.labels.find(function(l) { return l.name === statusVal; });
        if (label) barColor = label.color;
      }

      html += '<div class="timeline-row">';
      html += '<div class="timeline-bar" style="left:' + barLeft + 'px;width:' + barWidth + 'px;background:' + barColor + ';" onclick="openDetailPanel(\'' + td.task.id + '\')" title="' + escapeHtml(td.task.title) + ' (' + formatDate(td.date.toISOString()) + ')">';
      html += '<span class="timeline-bar-label">' + escapeHtml(td.task.title) + '</span>';
      html += '</div>';
      html += '</div>';
    });
  });

  html += '</div>'; /* timeline-body */
  html += '</div>'; /* timeline-scroll-area */
  html += '</div>'; /* timeline-container */

  container.innerHTML = html;
}


/* ═══ PHASE 6: DASHBOARD/CHART VIEW ═══ */

async function renderDashboardView() {
  var container = document.getElementById('board-dashboard-container');
  if (!container) return;

  var tasks = _boardTasks;
  var totalTasks = tasks.length;

  /* Status distribution */
  var statusCol = _boardColumns.find(function(c) { return c.type === 'status'; });
  var statusCounts = {};
  var statusColors = {};
  if (statusCol && statusCol.settings && statusCol.settings.labels) {
    statusCol.settings.labels.forEach(function(l) {
      statusCounts[l.name] = 0;
      statusColors[l.name] = l.color;
    });
  }
  var noStatus = 0;
  tasks.forEach(function(t) {
    var val = statusCol ? ((_boardTaskValues[t.id] && _boardTaskValues[t.id][statusCol.id]) || '') : '';
    if (val && statusCounts[val] !== undefined) statusCounts[val]++;
    else noStatus++;
  });

  /* Person distribution */
  var personCol = _boardColumns.find(function(c) { return c.type === 'person'; });
  var personCounts = {};
  tasks.forEach(function(t) {
    var val = personCol ? ((_boardTaskValues[t.id] && _boardTaskValues[t.id][personCol.id]) || '') : '';
    if (val) {
      var person = _boardStaff.find(function(s) { return s.auth_user_id === val || s.id === val; });
      var pName = person ? ((person.first_name || '') + ' ' + (person.last_name || '')).trim() : 'Unknown';
      personCounts[pName] = (personCounts[pName] || 0) + 1;
    }
  });

  /* Due date / overdue */
  var dateCol = _boardColumns.find(function(c) { return c.type === 'date'; });
  var overdueCount = 0;
  var now = new Date(); now.setHours(0, 0, 0, 0);
  if (dateCol) {
    tasks.forEach(function(t) {
      var val = (_boardTaskValues[t.id] && _boardTaskValues[t.id][dateCol.id]) || '';
      if (val) {
        var d = new Date(val);
        var isDone = false;
        if (statusCol) {
          var sv = (_boardTaskValues[t.id] && _boardTaskValues[t.id][statusCol.id]) || '';
          isDone = (sv === 'Done' || sv === 'Completed');
        }
        if (d < now && !isDone) overdueCount++;
      }
    });
  }

  /* Completed count */
  var completedCount = 0;
  if (statusCol) {
    tasks.forEach(function(t) {
      var sv = (_boardTaskValues[t.id] && _boardTaskValues[t.id][statusCol.id]) || '';
      if (sv === 'Done' || sv === 'Completed') completedCount++;
    });
  }

  /* Group progress */
  var groupProgress = [];
  _boardGroups.forEach(function(g) {
    var gTasks = tasks.filter(function(t) { return t.group_id === g.id; });
    var gDone = 0;
    if (statusCol) {
      gTasks.forEach(function(t) {
        var sv = (_boardTaskValues[t.id] && _boardTaskValues[t.id][statusCol.id]) || '';
        if (sv === 'Done' || sv === 'Completed') gDone++;
      });
    }
    groupProgress.push({ name: g.name, color: g.color, total: gTasks.length, done: gDone, pct: gTasks.length > 0 ? Math.round((gDone / gTasks.length) * 100) : 0 });
  });

  var html = '<div class="board-dashboard">';

  /* KPI cards */
  html += '<div class="board-dashboard-grid">';
  html += '<div class="board-stat-card"><div class="board-stat-value">' + totalTasks + '</div><div class="board-stat-label">Total Items</div></div>';
  html += '<div class="board-stat-card"><div class="board-stat-value" style="color:#00c875;">' + completedCount + '</div><div class="board-stat-label">Completed</div></div>';
  html += '<div class="board-stat-card"><div class="board-stat-value" style="color:#e2445c;">' + overdueCount + '</div><div class="board-stat-label">Overdue</div></div>';
  html += '<div class="board-stat-card"><div class="board-stat-value">' + (totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0) + '%</div><div class="board-stat-label">Completion Rate</div></div>';
  html += '</div>';

  /* Two-column chart area */
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">';

  /* Status distribution chart */
  html += '<div class="board-chart-card">';
  html += '<div class="board-chart-title">Status Distribution</div>';
  if (statusCol && totalTasks > 0) {
    html += '<div class="board-chart-segments">';
    var statusKeys = Object.keys(statusCounts);
    statusKeys.forEach(function(s) {
      if (statusCounts[s] > 0) {
        var pct = Math.round((statusCounts[s] / totalTasks) * 100);
        html += '<div class="board-chart-segment" style="width:' + pct + '%;background:' + (statusColors[s] || '#c4c4c4') + ';" title="' + escapeHtml(s) + ': ' + statusCounts[s] + ' (' + pct + '%)"></div>';
      }
    });
    if (noStatus > 0) {
      var nsPct = Math.round((noStatus / totalTasks) * 100);
      html += '<div class="board-chart-segment" style="width:' + nsPct + '%;background:#e8e8e8;" title="No Status: ' + noStatus + ' (' + nsPct + '%)"></div>';
    }
    html += '</div>';
    /* Legend */
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:0.75rem;">';
    statusKeys.forEach(function(s) {
      if (statusCounts[s] > 0) {
        html += '<div style="display:flex;align-items:center;gap:0.25rem;font-size:var(--text-xs);">';
        html += '<div style="width:8px;height:8px;border-radius:2px;background:' + (statusColors[s] || '#c4c4c4') + ';"></div>';
        html += '<span>' + escapeHtml(s) + ' (' + statusCounts[s] + ')</span></div>';
      }
    });
    html += '</div>';
  } else {
    html += '<div style="color:var(--color-tx-faint);font-size:var(--text-xs);padding:1rem;">No status data</div>';
  }
  html += '</div>';

  /* Tasks by person chart */
  html += '<div class="board-chart-card">';
  html += '<div class="board-chart-title">Tasks by Person</div>';
  var personKeys = Object.keys(personCounts);
  if (personKeys.length > 0) {
    var maxPerson = Math.max.apply(null, personKeys.map(function(k) { return personCounts[k]; }));
    html += '<div class="board-chart-bar-container">';
    personKeys.sort(function(a, b) { return personCounts[b] - personCounts[a]; });
    personKeys.forEach(function(name) {
      var pct = maxPerson > 0 ? Math.round((personCounts[name] / maxPerson) * 100) : 0;
      html += '<div class="board-chart-bar-row">';
      html += '<div class="board-chart-bar-label">' + escapeHtml(name) + '</div>';
      html += '<div class="board-chart-bar-track"><div class="board-chart-bar" style="width:' + pct + '%;background:var(--color-primary);"></div></div>';
      html += '<div class="board-chart-bar-value">' + personCounts[name] + '</div>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="color:var(--color-tx-faint);font-size:var(--text-xs);padding:1rem;">No assigned tasks</div>';
  }
  html += '</div>';

  html += '</div>'; /* two-column grid */

  /* Group progress */
  html += '<div class="board-chart-card" style="margin-top:1rem;">';
  html += '<div class="board-chart-title">Group Progress</div>';
  groupProgress.forEach(function(gp) {
    html += '<div style="margin-bottom:0.75rem;">';
    html += '<div style="display:flex;justify-content:space-between;font-size:var(--text-xs);margin-bottom:0.25rem;">';
    html += '<span style="font-weight:500;">' + escapeHtml(gp.name) + '</span>';
    html += '<span style="color:var(--color-tx-muted);">' + gp.done + '/' + gp.total + ' (' + gp.pct + '%)</span>';
    html += '</div>';
    html += '<div class="board-progress-bar"><div class="board-progress-fill" style="width:' + gp.pct + '%;background:' + gp.color + ';"></div></div>';
    html += '</div>';
  });
  html += '</div>';

  /* Recent activity */
  html += '<div class="board-chart-card" style="margin-top:1rem;">';
  html += '<div class="board-chart-title">Recent Activity</div>';
  html += '<div id="dashboard-board-activity"><div class="skeleton" style="height:100px;"></div></div>';
  html += '</div>';

  html += '</div>'; /* board-dashboard */

  container.innerHTML = html;

  /* Load recent activity */
  loadDashboardActivity();
}

async function loadDashboardActivity() {
  var container = document.getElementById('dashboard-board-activity');
  if (!container) return;
  try {
    /* Fetch recent activity for all tasks on this board */
    var taskIds = _boardTasks.map(function(t) { return t.id; });
    if (taskIds.length === 0) {
      container.innerHTML = '<div style="color:var(--color-tx-faint);font-size:var(--text-xs);padding:0.5rem;">No activity yet</div>';
      return;
    }
    var result = await resilientQuery(function() {
      return sb.from('hq_task_activity').select('*').in('task_id', taskIds).order('created_at', { ascending: false }).limit(10);
    }, 'dashboardActivity');
    var activities = (result && result.data) || [];
    if (activities.length === 0) {
      container.innerHTML = '<div style="color:var(--color-tx-faint);font-size:var(--text-xs);padding:0.5rem;">No activity yet</div>';
      return;
    }
    var html = '';
    activities.forEach(function(a) {
      var task = _boardTasks.find(function(t) { return t.id === a.task_id; });
      var taskTitle = task ? task.title : 'Unknown';
      var desc = formatActivityDescription(a);
      html += '<div class="board-activity-item">';
      html += '<div class="activity-dot" style="background:' + getActivityDotColor(a.action) + ';"></div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div class="board-activity-text">' + desc + ' <span style="color:var(--color-tx-muted);">on "' + escapeHtml(taskTitle) + '"</span></div>';
      html += '<div class="board-activity-time">' + timeAgo(a.created_at) + '</div>';
      html += '</div></div>';
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="color:var(--color-error);font-size:var(--text-xs);">Failed to load activity</div>';
  }
}


/* ═══ PHASE 8: KANBAN VIEW ═══ */

var _kanbanDragTaskId = null;

function renderKanbanView() {
  var container = document.getElementById('board-kanban-container');
  if (!container) return;

  /* Find first status column */
  var statusCol = _boardColumns.find(function(c) { return c.type === 'status'; });
  if (!statusCol) {
    container.innerHTML = '<div class="empty-state" style="padding:3rem;"><div class="empty-state-title">No status column</div><div class="empty-state-text">Add a Status column to your board to use Kanban view.</div></div>';
    return;
  }

  var labels = (statusCol.settings && statusCol.settings.labels) || [];
  /* Add "No Status" lane */
  var lanes = [{ name: 'No Status', color: '#e8e8e8' }].concat(labels);

  /* Group tasks by status */
  var tasksByStatus = {};
  lanes.forEach(function(l) { tasksByStatus[l.name] = []; });

  _boardTasks.forEach(function(t) {
    var val = (_boardTaskValues[t.id] && _boardTaskValues[t.id][statusCol.id]) || '';
    var laneName = val || 'No Status';
    if (!tasksByStatus[laneName]) tasksByStatus[laneName] = [];
    tasksByStatus[laneName].push(t);
  });

  /* Find person and date columns for card meta */
  var personCol = _boardColumns.find(function(c) { return c.type === 'person'; });
  var dateCol = _boardColumns.find(function(c) { return c.type === 'date'; });
  var priorityCol = _boardColumns.find(function(c) { return c.type === 'priority'; });

  var html = '<div class="kanban-container">';

  lanes.forEach(function(lane) {
    var laneTasks = tasksByStatus[lane.name] || [];
    html += '<div class="kanban-column" data-status="' + escapeHtml(lane.name) + '" ondragover="event.preventDefault();this.classList.add(\'drop-target\')" ondragleave="this.classList.remove(\'drop-target\')" ondrop="kanbanDrop(event,\'' + escapeHtml(lane.name) + '\')">';

    /* Column header */
    html += '<div class="kanban-column-header" style="border-top:3px solid ' + lane.color + ';">';
    html += '<span>' + escapeHtml(lane.name) + '</span>';
    html += '<span class="kanban-column-count">' + laneTasks.length + '</span>';
    html += '</div>';

    /* Cards */
    laneTasks.forEach(function(t) {
      /* Person info */
      var personVal = personCol ? ((_boardTaskValues[t.id] && _boardTaskValues[t.id][personCol.id]) || '') : '';
      var person = personVal ? _boardStaff.find(function(s) { return s.auth_user_id === personVal || s.id === personVal; }) : null;
      var pInitials = person ? ((person.first_name || '').charAt(0) + (person.last_name || '').charAt(0)) : '';
      var pColor = personVal ? PERSON_COLORS[Math.abs(hashStr(personVal)) % PERSON_COLORS.length] : '';

      /* Date info */
      var dateVal = dateCol ? ((_boardTaskValues[t.id] && _boardTaskValues[t.id][dateCol.id]) || '') : '';
      var isOverdue = false;
      if (dateVal) {
        var dd = new Date(dateVal);
        var nowD = new Date(); nowD.setHours(0, 0, 0, 0);
        isOverdue = dd < nowD && lane.name !== 'Done' && lane.name !== 'Completed';
      }

      /* Priority info */
      var priVal = priorityCol ? ((_boardTaskValues[t.id] && _boardTaskValues[t.id][priorityCol.id]) || '') : '';
      var priColor = '';
      if (priVal && priorityCol.settings && priorityCol.settings.labels) {
        var priLabel = priorityCol.settings.labels.find(function(l) { return l.name === priVal; });
        if (priLabel) priColor = priLabel.color;
      }

      /* Group color */
      var grp = _boardGroups.find(function(g) { return g.id === t.group_id; });
      var grpColor = grp ? grp.color : '#c4c4c4';

      html += '<div class="kanban-card" data-task-id="' + t.id + '" draggable="true" ondragstart="kanbanDragStart(event,\'' + t.id + '\')" ondragend="kanbanDragEnd(event)" onclick="openDetailPanel(\'' + t.id + '\')">';

      if (priVal) {
        html += '<div class="kanban-card-priority" style="background:' + (priColor || '#c4c4c4') + ';">' + escapeHtml(priVal) + '</div>';
      }

      html += '<div class="kanban-card-title">' + escapeHtml(t.title) + '</div>';
      html += '<div class="kanban-card-meta">';
      html += '<div style="display:flex;align-items:center;gap:0.25rem;">';
      html += '<div style="width:4px;height:4px;border-radius:50%;background:' + grpColor + ';"></div>';
      html += '<span style="font-size:0.625rem;color:var(--color-tx-faint);">' + escapeHtml(grp ? grp.name : '') + '</span>';
      html += '</div>';

      html += '<div style="display:flex;align-items:center;gap:0.375rem;">';
      if (dateVal) {
        html += '<span class="kanban-card-date' + (isOverdue ? ' overdue' : '') + '">' + formatDate(dateVal) + '</span>';
      }
      if (pInitials) {
        html += '<div class="kanban-card-avatar" style="background:' + pColor + ';">' + escapeHtml(pInitials) + '</div>';
      }
      html += '</div>';

      html += '</div>'; /* kanban-card-meta */
      html += '</div>'; /* kanban-card */
    });

    html += '</div>'; /* kanban-column */
  });

  html += '</div>'; /* kanban-container */

  container.innerHTML = html;
}

function kanbanDragStart(event, taskId) {
  _kanbanDragTaskId = taskId;
  event.dataTransfer.setData('text/plain', taskId);
  event.currentTarget.classList.add('dragging');
}

function kanbanDragEnd(event) {
  _kanbanDragTaskId = null;
  event.currentTarget.classList.remove('dragging');
  /* Remove drop-target from all columns */
  var cols = document.querySelectorAll('.kanban-column');
  for (var i = 0; i < cols.length; i++) cols[i].classList.remove('drop-target');
}

function kanbanDrop(event, statusName) {
  event.preventDefault();
  var col = event.currentTarget;
  col.classList.remove('drop-target');

  var taskId = event.dataTransfer.getData('text/plain');
  if (!taskId) return;

  var statusCol = _boardColumns.find(function(c) { return c.type === 'status'; });
  if (!statusCol) return;

  var newVal = statusName === 'No Status' ? '' : statusName;
  saveCellValue(taskId, statusCol.id, newVal);

  /* Re-render kanban */
  setTimeout(function() { renderKanbanView(); }, 100);
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
