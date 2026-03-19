/* ═══ Atlas HQ — Projects (Kanban + List) ═══ */

var _projectViewMode = 'kanban'; /* 'kanban' or 'list' */
var _currentProjectId = null;

function toggleProjectView() {
  _projectViewMode = (_projectViewMode === 'kanban') ? 'list' : 'kanban';
  renderProjects();
}

async function renderProjects() {
  try {
    var projects = await fetchProjects();
    var tasks = await fetchTasks();
    var staff = await fetchStaffList();
    var container = document.getElementById('projects-content');
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg><div class="empty-state-title">No projects yet</div><div class="empty-state-text">Create your first project to start tracking work.</div><button class="btn btn-primary btn-sm" onclick="openProjectModal()">+ New Project</button></div>';
      return;
    }

    if (_projectViewMode === 'kanban') {
      renderProjectsKanban(projects, tasks, staff, container);
    } else {
      renderProjectsList(projects, tasks, container);
    }
  } catch (err) {
    console.error('[renderProjects]', err);
    showToast('Failed to load projects.', 'error');
  }
}

function renderProjectsKanban(projects, tasks, staff, container) {
  /* Project selector */
  var html = '<div style="margin-bottom:1rem;display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">';
  html += '<select class="select-field" style="width:auto;min-width:200px;" id="kanban-project-select" onchange="_currentProjectId=this.value;renderProjects()">';
  projects.forEach(function(p) {
    var sel = (_currentProjectId === p.id) ? ' selected' : '';
    if (!_currentProjectId && projects.indexOf(p) === 0) { sel = ' selected'; _currentProjectId = p.id; }
    html += '<option value="' + p.id + '"' + sel + '>' + escapeHtml(p.name) + '</option>';
  });
  html += '</select>';
  html += '<button class="btn btn-sm btn-ghost" onclick="openProjectModal(_currentProjectId)">Edit Project</button>';
  html += '<button class="btn btn-sm btn-primary" onclick="openTaskModal(null, _currentProjectId)">+ Add Task</button>';
  html += '</div>';

  var projectTasks = tasks.filter(function(t) { return t.project_id === _currentProjectId; });
  var columns = ['Backlog', 'In Progress', 'Review', 'Done'];

  html += '<div class="kanban-board">';
  columns.forEach(function(col) {
    var colTasks = projectTasks.filter(function(t) { return t.status === col; });
    html += '<div class="kanban-column" data-status="' + col + '" ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')" ondrop="handleTaskDrop(event,\'' + col + '\')">';
    html += '<div class="kanban-column-header"><span>' + col + '</span><span class="kanban-column-count">' + colTasks.length + '</span></div>';
    html += '<div class="kanban-column-body">';
    colTasks.forEach(function(t) {
      var priorityClass = 'priority-' + (t.priority || 'medium').toLowerCase();
      var assignee = staff.filter(function(s) { return s.auth_user_id === t.assignee_id; })[0];
      var initials = assignee ? (assignee.first_name || '').charAt(0) + (assignee.last_name || '').charAt(0) : '';
      html += '<div class="kanban-card" draggable="true" data-task-id="' + t.id + '" ondragstart="event.dataTransfer.setData(\'text/plain\',\'' + t.id + '\');this.classList.add(\'dragging\')" ondragend="this.classList.remove(\'dragging\')" onclick="openTaskModal(\'' + t.id + '\',\'' + t.project_id + '\')">';
      html += '<div class="kanban-card-title">' + escapeHtml(t.title) + '</div>';
      html += '<div class="kanban-card-meta">';
      html += '<span style="display:flex;align-items:center;gap:0.25rem;"><span class="priority-dot ' + priorityClass + '"></span> ' + escapeHtml(t.priority || 'Medium') + '</span>';
      if (t.due_date) {
        var days = daysUntil(t.due_date);
        var dueColor = days < 0 ? 'var(--color-error)' : days <= 3 ? 'var(--color-warning)' : 'var(--color-tx-muted)';
        html += '<span style="color:' + dueColor + ';">' + formatDate(t.due_date) + '</span>';
      }
      html += '</div>';
      if (initials) {
        html += '<div class="kanban-card-assignee" style="margin-top:0.375rem;"><div class="kanban-card-avatar">' + escapeHtml(initials) + '</div><span style="font-size:var(--text-xs);color:var(--color-tx-muted);">' + escapeHtml((assignee.first_name || '') + ' ' + (assignee.last_name || '')) + '</span></div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderProjectsList(projects, tasks, container) {
  var html = '<div class="table-wrap"><table class="data-table"><thead><tr>';
  html += '<th>Project</th><th>Status</th><th>Priority</th><th>Tasks</th><th>Created</th><th>Actions</th>';
  html += '</tr></thead><tbody>';
  projects.forEach(function(p) {
    var taskCount = tasks.filter(function(t) { return t.project_id === p.id; }).length;
    var doneTasks = tasks.filter(function(t) { return t.project_id === p.id && t.status === 'Done'; }).length;
    var statusClass = p.status === 'Done' ? 'badge-success' : p.status === 'In Progress' ? 'badge-in-progress' : p.status === 'Review' ? 'badge-orange' : 'badge-muted';
    html += '<tr>';
    html += '<td><strong>' + escapeHtml(p.name) + '</strong>';
    if (p.description) html += '<br><span style="font-size:var(--text-xs);color:var(--color-tx-muted);">' + escapeHtml(p.description).substring(0, 80) + '</span>';
    html += '</td>';
    html += '<td><span class="badge ' + statusClass + '">' + escapeHtml(p.status) + '</span></td>';
    html += '<td><span class="priority-dot priority-' + (p.priority || 'medium').toLowerCase() + '"></span> ' + escapeHtml(p.priority || 'Medium') + '</td>';
    html += '<td>' + doneTasks + '/' + taskCount + '</td>';
    html += '<td>' + formatDate(p.created_at) + '</td>';
    html += '<td><button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openProjectModal(\'' + p.id + '\')">Edit</button> <button class="btn btn-sm btn-danger-ghost" onclick="event.stopPropagation();deleteProject(\'' + p.id + '\',\'' + escapeHtml(p.name) + '\')">Delete</button></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function handleTaskDrop(event, newStatus) {
  event.preventDefault();
  var col = event.currentTarget;
  col.classList.remove('drag-over');
  var taskId = event.dataTransfer.getData('text/plain');
  if (!taskId) return;
  try {
    await resilientWrite(function() {
      return sb.from('hq_tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
    }, 'moveTask');
    clearCache('tasks');
    renderProjects();
    showToast('Task moved to ' + newStatus, 'success');
  } catch (err) {
    console.error('[handleTaskDrop]', err);
    showToast('Failed to move task.', 'error');
  }
}

function openProjectModal(projectId) {
  var title = projectId ? 'Edit Project' : 'New Project';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');
  var project = null;
  if (projectId && dataCache.projects) {
    project = dataCache.projects.filter(function(p) { return p.id === projectId; })[0];
  }
  body.innerHTML = '<div class="form-row"><label class="field-label">Project Name</label><input type="text" id="proj-name" class="input-field" placeholder="Project name" value="' + escapeHtml((project && project.name) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Description</label><textarea id="proj-desc" class="input-field" placeholder="Project description">' + escapeHtml((project && project.description) || '') + '</textarea></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Status</label><select id="proj-status" class="select-field"><option value="Backlog"' + ((project && project.status === 'Backlog') ? ' selected' : '') + '>Backlog</option><option value="In Progress"' + ((project && project.status === 'In Progress') ? ' selected' : '') + '>In Progress</option><option value="Review"' + ((project && project.status === 'Review') ? ' selected' : '') + '>Review</option><option value="Done"' + ((project && project.status === 'Done') ? ' selected' : '') + '>Done</option><option value="Archived"' + ((project && project.status === 'Archived') ? ' selected' : '') + '>Archived</option></select></div>' +
    '<div class="form-row"><label class="field-label">Priority</label><select id="proj-priority" class="select-field"><option value="Low"' + ((project && project.priority === 'Low') ? ' selected' : '') + '>Low</option><option value="Medium"' + ((project && project.priority === 'Medium' || !project) ? ' selected' : '') + '>Medium</option><option value="High"' + ((project && project.priority === 'High') ? ' selected' : '') + '>High</option><option value="Urgent"' + ((project && project.priority === 'Urgent') ? ' selected' : '') + '>Urgent</option></select></div></div>';

  var saveBtn = document.getElementById('hq-modal-save');
  saveBtn.onclick = function() { saveProject(projectId); };
  openModal('hq-modal');
}

async function saveProject(projectId) {
  var name = document.getElementById('proj-name').value.trim();
  if (!name) { showToast('Project name is required.', 'error'); return; }
  var data = {
    name: name,
    description: document.getElementById('proj-desc').value.trim(),
    status: document.getElementById('proj-status').value,
    priority: document.getElementById('proj-priority').value,
    updated_at: new Date().toISOString()
  };
  try {
    if (projectId) {
      await resilientWrite(function() { return sb.from('hq_projects').update(data).eq('id', projectId); }, 'updateProject');
    } else {
      data.owner_id = currentUser ? currentUser.id : null;
      await resilientWrite(function() { return sb.from('hq_projects').insert(data); }, 'insertProject');
    }
    clearCache('projects');
    closeModal('hq-modal');
    renderProjects();
    showToast('Project saved.', 'success');
  } catch (err) {
    console.error('[saveProject]', err);
    showToast('Failed to save project.', 'error');
  }
}

function deleteProject(projectId, name) {
  customConfirm('Delete project "' + name + '" and all its tasks?', async function() {
    try {
      await resilientWrite(function() { return sb.from('hq_projects').delete().eq('id', projectId); }, 'deleteProject');
      clearCache('projects');
      clearCache('tasks');
      _currentProjectId = null;
      renderProjects();
      showToast('Project deleted.', 'success');
    } catch (err) {
      console.error('[deleteProject]', err);
      showToast('Failed to delete project.', 'error');
    }
  });
}

function openTaskModal(taskId, projectId) {
  var title = taskId ? 'Edit Task' : 'New Task';
  document.getElementById('hq-modal-title').textContent = title;
  var body = document.getElementById('hq-modal-body');
  var task = null;
  if (taskId && dataCache.tasks) {
    task = dataCache.tasks.filter(function(t) { return t.id === taskId; })[0];
  }
  var staff = dataCache.staffList || [];

  var assigneeOptions = '<option value="">Unassigned</option>';
  staff.forEach(function(s) {
    var sel = (task && task.assignee_id === s.auth_user_id) ? ' selected' : '';
    assigneeOptions += '<option value="' + (s.auth_user_id || '') + '"' + sel + '>' + escapeHtml((s.first_name || '') + ' ' + (s.last_name || '')) + '</option>';
  });

  body.innerHTML = '<div class="form-row"><label class="field-label">Task Title</label><input type="text" id="task-title" class="input-field" value="' + escapeHtml((task && task.title) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Description</label><textarea id="task-desc" class="input-field">' + escapeHtml((task && task.description) || '') + '</textarea></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Status</label><select id="task-status" class="select-field"><option value="Backlog"' + ((task && task.status === 'Backlog' || !task) ? ' selected' : '') + '>Backlog</option><option value="In Progress"' + ((task && task.status === 'In Progress') ? ' selected' : '') + '>In Progress</option><option value="Review"' + ((task && task.status === 'Review') ? ' selected' : '') + '>Review</option><option value="Done"' + ((task && task.status === 'Done') ? ' selected' : '') + '>Done</option></select></div>' +
    '<div class="form-row"><label class="field-label">Priority</label><select id="task-priority" class="select-field"><option value="Low"' + ((task && task.priority === 'Low') ? ' selected' : '') + '>Low</option><option value="Medium"' + ((task && task.priority === 'Medium' || !task) ? ' selected' : '') + '>Medium</option><option value="High"' + ((task && task.priority === 'High') ? ' selected' : '') + '>High</option><option value="Urgent"' + ((task && task.priority === 'Urgent') ? ' selected' : '') + '>Urgent</option></select></div></div>' +
    '<div class="form-grid"><div class="form-row"><label class="field-label">Due Date</label><input type="date" id="task-due" class="input-field" value="' + ((task && task.due_date) || '') + '"></div>' +
    '<div class="form-row"><label class="field-label">Assignee</label><select id="task-assignee" class="select-field">' + assigneeOptions + '</select></div></div>';

  var saveBtn = document.getElementById('hq-modal-save');
  saveBtn.onclick = function() { saveTask(taskId, projectId); };
  openModal('hq-modal');
}

async function saveTask(taskId, projectId) {
  var title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('Task title is required.', 'error'); return; }
  var data = {
    title: title,
    description: document.getElementById('task-desc').value.trim(),
    status: document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    due_date: document.getElementById('task-due').value || null,
    assignee_id: document.getElementById('task-assignee').value || null,
    updated_at: new Date().toISOString()
  };
  try {
    if (taskId) {
      await resilientWrite(function() { return sb.from('hq_tasks').update(data).eq('id', taskId); }, 'updateTask');
    } else {
      data.project_id = projectId;
      await resilientWrite(function() { return sb.from('hq_tasks').insert(data); }, 'insertTask');
    }
    clearCache('tasks');
    closeModal('hq-modal');
    renderProjects();
    showToast('Task saved.', 'success');
  } catch (err) {
    console.error('[saveTask]', err);
    showToast('Failed to save task.', 'error');
  }
}
