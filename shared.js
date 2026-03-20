/* ═══════════════════════════════════════════
   ATLAS HQ — shared.js
   Auth, Supabase config, SPA routing, utilities
   ═══════════════════════════════════════════ */

/* ─── Global Error Boundary ─── */
window.addEventListener('unhandledrejection', function(event) {
  var msg = (event.reason && event.reason.message) ? event.reason.message : String(event.reason || 'Unknown error');
  if (msg.indexOf('LockManager') !== -1 || msg.indexOf('SecurityError') !== -1) return;
  console.error('[Global] Unhandled promise rejection:', event.reason);
  if (typeof showToast === 'function') {
    showToast('Something went wrong — try refreshing the page.', 'error');
  }
  event.preventDefault();
});
window.addEventListener('error', function(event) {
  var msg = event.message || '';
  if (msg.indexOf('LockManager') !== -1 || msg.indexOf('SecurityError') !== -1) return;
  if (msg.indexOf('ResizeObserver') !== -1) return;
  console.error('[Global] Uncaught error:', msg, event.filename, event.lineno);
  if (typeof showToast === 'function') {
    showToast('Something went wrong — try refreshing the page.', 'error');
  }
});

/* ─── HTML Escaping (XSS protection) ─── */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─── Form Validation ─── */
function validateField(inputEl, rule) {
  if (!inputEl) return true;
  var val = (inputEl.value || '').trim();
  var valid = true;
  if (rule === 'required') { valid = val.length > 0; }
  else if (rule === 'email') { valid = val.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val); }
  else if (rule === 'phone') { valid = val.length === 0 || /^[\d\s\-\+\(\)\.]{7,20}$/.test(val); }
  else if (rule === 'number') { valid = val.length === 0 || !isNaN(Number(val)); }
  else if (rule && rule.indexOf('minLength:') === 0) { valid = val.length === 0 || val.length >= parseInt(rule.split(':')[1], 10); }
  inputEl.style.borderColor = valid ? '' : 'var(--color-error)';
  return valid;
}
function validateForm(fieldRules) {
  var allValid = true;
  for (var i = 0; i < fieldRules.length; i++) {
    if (!validateField(fieldRules[i].el, fieldRules[i].rule)) allValid = false;
  }
  return allValid;
}

/* ─── Navigator Locks Polyfill ─── */
if (!navigator.locks || typeof navigator.locks.request !== 'function') {
  navigator.locks = {
    request: function(name, opts, callback) {
      if (typeof opts === 'function') { callback = opts; }
      return Promise.resolve(callback({ name: name, mode: 'exclusive' }));
    },
    query: function() { return Promise.resolve({ held: [], pending: [] }); }
  };
}
(function() {
  var origRequest = navigator.locks.request;
  function fallback(args) {
    var callback = args[args.length - 1];
    if (typeof callback === 'function') return Promise.resolve(callback({ name: args[0], mode: 'exclusive' }));
    return Promise.resolve();
  }
  navigator.locks.request = function() {
    var args = Array.prototype.slice.call(arguments);
    try {
      var result = origRequest.apply(navigator.locks, args);
      if (result && typeof result.catch === 'function') return result.catch(function() { return fallback(args); });
      return result;
    } catch (e) { return fallback(args); }
  };
})();

/* ─── CustomStorage (localStorage + window.name fallback) ─── */
var CustomStorage = (function() {
  var memStore = {};
  function _ls() {
    try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; } catch(e) { return false; }
  }
  return {
    getItem: function(key) {
      if (_ls()) { try { return localStorage.getItem(key); } catch(e) {} }
      if (memStore[key] !== undefined) return memStore[key];
      try {
        var wn = window.name ? JSON.parse(window.name) : {};
        return wn[key] || null;
      } catch(e) { return null; }
    },
    setItem: function(key, val) {
      if (_ls()) { try { localStorage.setItem(key, val); } catch(e) {} }
      memStore[key] = val;
      try {
        var wn = {};
        try { wn = window.name ? JSON.parse(window.name) : {}; } catch(e) {}
        wn[key] = val;
        window.name = JSON.stringify(wn);
      } catch(e) {}
    },
    removeItem: function(key) {
      if (_ls()) { try { localStorage.removeItem(key); } catch(e) {} }
      delete memStore[key];
      try {
        var wn = {};
        try { wn = window.name ? JSON.parse(window.name) : {}; } catch(e) {}
        delete wn[key];
        window.name = JSON.stringify(wn);
      } catch(e) {}
    }
  };
})();

/* ─── Supabase Config (Dev/Prod switching) ─── */
var _isProduction = (window.location.hostname === 'hq.talaria.com');
var SUPABASE_URL = _isProduction
  ? 'https://buqopylxhqdiikzqctkb.supabase.co'
  : 'https://dutvbquoyjtoctjstbmv.supabase.co';
var SUPABASE_ANON_KEY = _isProduction
  ? 'sb_publishable_5PtKRzeDXWq8mmkf093gQw_8KlXWqh9'
  : 'sb_publishable_ZUwQktaTceaiO7H2FVaJSA_m4N7QnFW';
var supabaseClient = null;
/* NOTE: We use `sb` instead of `supabase` to avoid shadowing the CDN global `window.supabase` */
var sb = null;
var currentUser = null;
var currentProfile = null;
var currentStaffPerms = null;
var isAuthenticated = false;

/* Dev banner */
if (!_isProduction) {
  document.addEventListener('DOMContentLoaded', function() {
    var banner = document.createElement('div');
    banner.id = 'dev-env-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#000;text-align:center;padding:4px;font-size:12px;font-weight:600;letter-spacing:0.5px;';
    banner.textContent = 'DEV ENVIRONMENT — Database: dutvbquoyjtoctjstbmv';
    document.body.prepend(banner);
    document.body.style.paddingTop = '28px';
  });
}

function initSupabaseClient() {
  if (supabaseClient) { sb = supabaseClient; return true; }
  try {
    var lib = window.supabase;
    if (lib && lib.createClient) {
      supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: CustomStorage,
          storageKey: 'atlas-hq-auth-token',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
          lock: function(name, acquireTimeout, fn) { return fn(); }
        }
      });
      sb = supabaseClient;
      return true;
    }
  } catch (err) { console.error('[initSupabaseClient]', err); }
  return false;
}
initSupabaseClient();

/* ─── Resilient Query Layer ─── */
var _QUERY_TIMEOUT = 15000;
var DATA_CACHE_TTL = 60000;

function isLockManagerError(err) {
  if (!err) return false;
  var msg = err.message || String(err);
  return msg.indexOf('LockManager') !== -1 || msg.indexOf('SecurityError') !== -1;
}

function supabaseWithTimeout(queryFn, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() { reject(new Error('Query timed out after ' + timeoutMs + 'ms')); }, timeoutMs || _QUERY_TIMEOUT);
    queryFn().then(function(result) { clearTimeout(timer); resolve(result); })
      .catch(function(err) { clearTimeout(timer); reject(err); });
  });
}

async function resilientQuery(queryFn, label, retries) {
  retries = retries || 2;
  var lastErr;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      var result = await supabaseWithTimeout(queryFn, _QUERY_TIMEOUT);
      return result;
    } catch (err) {
      lastErr = err;
      if (isLockManagerError(err)) {
        console.warn('[' + (label || 'query') + '] LockManager error, retrying...');
        await new Promise(function(r) { setTimeout(r, 500); });
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function resilientWrite(writeFn, label) {
  return resilientQuery(writeFn, label, 1);
}

/* ─── Data Cache ─── */
var dataCache = {
  projects: null, projectsTime: 0,
  tasks: null, tasksTime: 0,
  compliance: null, complianceTime: 0,
  licenses: null, licensesTime: 0,
  employees: null, employeesTime: 0,
  documents: null, documentsTime: 0,
  folders: null, foldersTime: 0,
  drivers: null, driversTime: 0,
  staffList: null, staffListTime: 0,
  boardGroups: null, boardGroupsTime: 0,
  boardColumns: null, boardColumnsTime: 0,
  taskValues: null, taskValuesTime: 0,
  taskComments: null, taskCommentsTime: 0,
  taskActivity: null, taskActivityTime: 0,
  taskAttachments: null, taskAttachmentsTime: 0,
  boardTemplates: null, boardTemplatesTime: 0,
  notifications: null, notificationsTime: 0,
  notifPrefs: null, notifPrefsTime: 0
};

function isCacheValid(key) {
  return dataCache[key] && (Date.now() - dataCache[key + 'Time']) < DATA_CACHE_TTL;
}
function clearCache(key) {
  if (key) { dataCache[key] = null; dataCache[key + 'Time'] = 0; }
  else { for (var k in dataCache) { dataCache[k] = (k.indexOf('Time') !== -1) ? 0 : null; } }
}

/* ─── Data Fetchers ─── */
async function fetchProjects(force) {
  if (!force && isCacheValid('projects')) return dataCache.projects;
  var result = await resilientQuery(function() {
    return sb.from('hq_projects').select('*').order('created_at', { ascending: false });
  }, 'fetchProjects');
  if (result.data) { dataCache.projects = result.data; dataCache.projectsTime = Date.now(); }
  return result.data || [];
}

async function fetchTasks(force) {
  if (!force && isCacheValid('tasks')) return dataCache.tasks;
  var result = await resilientQuery(function() {
    return sb.from('hq_tasks').select('*').order('sort_order', { ascending: true });
  }, 'fetchTasks');
  if (result.data) { dataCache.tasks = result.data; dataCache.tasksTime = Date.now(); }
  return result.data || [];
}

async function fetchComplianceItems(force) {
  if (!force && isCacheValid('compliance')) return dataCache.compliance;
  var result = await resilientQuery(function() {
    return sb.from('hq_compliance_items').select('*').order('due_date', { ascending: true });
  }, 'fetchCompliance');
  if (result.data) { dataCache.compliance = result.data; dataCache.complianceTime = Date.now(); }
  return result.data || [];
}

async function fetchLicenses(force) {
  if (!force && isCacheValid('licenses')) return dataCache.licenses;
  var result = await resilientQuery(function() {
    return sb.from('hq_licenses').select('*').order('expiration_date', { ascending: true });
  }, 'fetchLicenses');
  if (result.data) { dataCache.licenses = result.data; dataCache.licensesTime = Date.now(); }
  return result.data || [];
}

async function fetchEmployees(force) {
  if (!force && isCacheValid('employees')) return dataCache.employees;
  var result = await resilientQuery(function() {
    return sb.from('hq_employees').select('*').order('last_name', { ascending: true });
  }, 'fetchEmployees');
  if (result.data) { dataCache.employees = result.data; dataCache.employeesTime = Date.now(); }
  return result.data || [];
}

async function fetchDrivers(force) {
  if (!force && isCacheValid('drivers')) return dataCache.drivers;
  var result = await resilientQuery(function() {
    return sb.from('drivers').select('id, display_id, first_name, last_name, email, phone, role, hub_id, is_active, inactive_reason, created_at').order('last_name', { ascending: true });
  }, 'fetchDrivers');
  if (result.data) { dataCache.drivers = result.data; dataCache.driversTime = Date.now(); }
  return result.data || [];
}

async function fetchDocuments(force) {
  if (!force && isCacheValid('documents')) return dataCache.documents;
  var result = await resilientQuery(function() {
    return sb.from('hq_documents').select('*').order('created_at', { ascending: false });
  }, 'fetchDocuments');
  if (result.data) { dataCache.documents = result.data; dataCache.documentsTime = Date.now(); }
  return result.data || [];
}

async function fetchFolders(force) {
  if (!force && isCacheValid('folders')) return dataCache.folders;
  var result = await resilientQuery(function() {
    return sb.from('hq_document_folders').select('*').order('name', { ascending: true });
  }, 'fetchFolders');
  if (result.data) { dataCache.folders = result.data; dataCache.foldersTime = Date.now(); }
  return result.data || [];
}

async function fetchStaffList(force) {
  if (!force && isCacheValid('staffList')) return dataCache.staffList;
  var result = await resilientQuery(function() {
    return sb.from('corporate_staff').select('id, email, first_name, last_name, permission_level, is_active, auth_user_id').eq('is_active', true);
  }, 'fetchStaffList');
  if (result.data) { dataCache.staffList = result.data; dataCache.staffListTime = Date.now(); }
  return result.data || [];
}

/* ─── Board-Specific Fetchers ─── */
async function fetchBoardGroups(projectId, force) {
  if (!force && isCacheValid('boardGroups') && dataCache._boardGroupsProjectId === projectId) return dataCache.boardGroups;
  var result = await resilientQuery(function() {
    return sb.from('hq_board_groups').select('*').eq('project_id', projectId).order('sort_order', { ascending: true });
  }, 'fetchBoardGroups');
  if (result.data) { dataCache.boardGroups = result.data; dataCache.boardGroupsTime = Date.now(); dataCache._boardGroupsProjectId = projectId; }
  return result.data || [];
}

async function fetchBoardColumns(projectId, force) {
  if (!force && isCacheValid('boardColumns') && dataCache._boardColumnsProjectId === projectId) return dataCache.boardColumns;
  var result = await resilientQuery(function() {
    return sb.from('hq_board_columns').select('*').eq('project_id', projectId).order('sort_order', { ascending: true });
  }, 'fetchBoardColumns');
  if (result.data) { dataCache.boardColumns = result.data; dataCache.boardColumnsTime = Date.now(); dataCache._boardColumnsProjectId = projectId; }
  return result.data || [];
}

async function fetchTaskValues(taskIds, force) {
  if (!taskIds || taskIds.length === 0) return [];
  if (!force && isCacheValid('taskValues')) return dataCache.taskValues;
  var result = await resilientQuery(function() {
    return sb.from('hq_task_values').select('*').in('task_id', taskIds);
  }, 'fetchTaskValues');
  if (result.data) { dataCache.taskValues = result.data; dataCache.taskValuesTime = Date.now(); }
  return result.data || [];
}

/* ─── Task Comments ─── */
async function fetchTaskComments(taskId, force) {
  if (!force && isCacheValid('taskComments') && dataCache._taskCommentsTaskId === taskId) return dataCache.taskComments;
  var result = await resilientQuery(function() {
    return sb.from('hq_task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
  }, 'fetchTaskComments');
  if (result.data) { dataCache.taskComments = result.data; dataCache.taskCommentsTime = Date.now(); dataCache._taskCommentsTaskId = taskId; }
  return result.data || [];
}

/* ─── Task Activity ─── */
async function fetchTaskActivity(taskId, force) {
  if (!force && isCacheValid('taskActivity') && dataCache._taskActivityTaskId === taskId) return dataCache.taskActivity;
  var result = await resilientQuery(function() {
    return sb.from('hq_task_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false }).limit(50);
  }, 'fetchTaskActivity');
  if (result.data) { dataCache.taskActivity = result.data; dataCache.taskActivityTime = Date.now(); dataCache._taskActivityTaskId = taskId; }
  return result.data || [];
}

/* ─── Task Attachments ─── */
async function fetchTaskAttachments(taskId, force) {
  if (!taskId) return [];
  if (!force && isCacheValid('taskAttachments') && dataCache._taskAttachmentsTaskId === taskId) return dataCache.taskAttachments;
  var result = await resilientQuery(function() {
    return sb.from('hq_task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
  }, 'fetchTaskAttachments');
  if (result.data) { dataCache.taskAttachments = result.data; dataCache.taskAttachmentsTime = Date.now(); dataCache._taskAttachmentsTaskId = taskId; }
  return result.data || [];
}

/* ─── Board Templates ─── */
async function fetchBoardTemplates(force) {
  if (!force && isCacheValid('boardTemplates')) return dataCache.boardTemplates;
  var result = await resilientQuery(function() {
    return sb.from('hq_board_templates').select('*').order('is_system', { ascending: false }).order('name', { ascending: true });
  }, 'fetchBoardTemplates');
  if (result.data) { dataCache.boardTemplates = result.data; dataCache.boardTemplatesTime = Date.now(); }
  return result.data || [];
}

/* ─── Log Activity (fire-and-forget) ─── */
function logTaskActivity(taskId, action, fieldName, oldValue, newValue) {
  if (!sb || !taskId) return;
  var userName = (currentProfile && currentProfile.full_name) || (currentUser && currentUser.email) || 'Unknown';
  var userId = currentUser ? currentUser.id : null;
  resilientWrite(function() {
    return sb.from('hq_task_activity').insert({
      task_id: taskId,
      user_id: userId,
      user_name: userName,
      action: action,
      field_name: fieldName || null,
      old_value: oldValue ? String(oldValue) : null,
      new_value: newValue ? String(newValue) : null
    });
  }, 'logTaskActivity').catch(function(err) {
    console.error('[logTaskActivity]', err);
  });
  /* Invalidate activity cache for this task */
  if (dataCache._taskActivityTaskId === taskId) clearCache('taskActivity');
}

/* ─── Notifications ─── */
async function fetchNotifications(force) {
  if (!currentUser) return [];
  if (!force && isCacheValid('notifications')) return dataCache.notifications;
  var result = await resilientQuery(function() {
    return sb.from('hq_notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50);
  }, 'fetchNotifications');
  if (result.data) { dataCache.notifications = result.data; dataCache.notificationsTime = Date.now(); }
  return result.data || [];
}

async function markNotificationRead(notifId) {
  try {
    await resilientWrite(function() {
      return sb.from('hq_notifications').update({ is_read: true }).eq('id', notifId);
    }, 'markNotifRead');
    clearCache('notifications');
  } catch (err) { console.error('[markNotifRead]', err); }
}

async function markAllNotificationsRead() {
  if (!currentUser) return;
  try {
    await resilientWrite(function() {
      return sb.from('hq_notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
    }, 'markAllNotifsRead');
    clearCache('notifications');
  } catch (err) { console.error('[markAllNotifsRead]', err); }
}

function sendInAppNotification(userId, title, body, linkTo, taskId) {
  if (!sb || !userId) return;
  /* Don't notify yourself */
  if (currentUser && userId === currentUser.id) return;
  resilientWrite(function() {
    return sb.from('hq_notifications').insert({
      user_id: userId,
      title: title,
      body: body || null,
      link_to: linkTo || null,
      task_id: taskId || null,
      is_read: false
    });
  }, 'sendInAppNotification').catch(function(err) {
    console.error('[sendInAppNotification]', err);
  });
}

async function fetchNotifPrefs(force) {
  if (!currentUser) return null;
  if (!force && isCacheValid('notifPrefs')) return dataCache.notifPrefs;
  var result = await resilientQuery(function() {
    return sb.from('hq_notification_preferences').select('*').eq('user_id', currentUser.id).single();
  }, 'fetchNotifPrefs');
  if (result.data && !result.error) { dataCache.notifPrefs = result.data; dataCache.notifPrefsTime = Date.now(); }
  return result.data || null;
}

async function saveNotifPrefs(prefs) {
  if (!currentUser) return;
  try {
    await resilientWrite(function() {
      return sb.from('hq_notification_preferences').upsert({
        user_id: currentUser.id,
        email_on_assign: prefs.email_on_assign !== false,
        email_on_comment: prefs.email_on_comment !== false,
        email_on_mention: prefs.email_on_mention !== false,
        email_on_due_date: prefs.email_on_due_date !== false,
        in_app_enabled: prefs.in_app_enabled !== false
      }, { onConflict: 'user_id' });
    }, 'saveNotifPrefs');
    clearCache('notifPrefs');
  } catch (err) { showToast('Failed to save notification preferences.', 'error'); }
}

async function initBoardDefaults(projectId) {
  /* Create 3 default groups */
  var groups = [
    { project_id: projectId, name: 'To Do', color: '#579bfc', sort_order: 0 },
    { project_id: projectId, name: 'In Progress', color: '#fdab3d', sort_order: 1 },
    { project_id: projectId, name: 'Done', color: '#00c875', sort_order: 2 }
  ];
  await resilientWrite(function() { return sb.from('hq_board_groups').insert(groups); }, 'initGroups');

  /* Create 5 default columns */
  var columns = [
    { project_id: projectId, name: 'Status', type: 'status', sort_order: 0, width: 140,
      settings: { labels: [
        { name: 'Not Started', color: '#c4c4c4' },
        { name: 'Working on it', color: '#fdab3d' },
        { name: 'Stuck', color: '#e2445c' },
        { name: 'Done', color: '#00c875' },
        { name: 'Planning', color: '#a25ddc' },
        { name: 'Review', color: '#0086c0' }
      ]}},
    { project_id: projectId, name: 'Person', type: 'person', sort_order: 1, width: 120, settings: {} },
    { project_id: projectId, name: 'Due Date', type: 'date', sort_order: 2, width: 130, settings: {} },
    { project_id: projectId, name: 'Priority', type: 'priority', sort_order: 3, width: 120,
      settings: { labels: [
        { name: 'Critical', color: '#e2445c' },
        { name: 'High', color: '#fdab3d' },
        { name: 'Medium', color: '#579bfc' },
        { name: 'Low', color: '#c4c4c4' }
      ]}},
    { project_id: projectId, name: 'Notes', type: 'text', sort_order: 4, width: 200, settings: {} }
  ];
  await resilientWrite(function() { return sb.from('hq_board_columns').insert(columns); }, 'initColumns');

  clearCache('boardGroups');
  clearCache('boardColumns');
}

/* ─── Auth ─── */
async function initAuth() {
  try {
    if (!sb) { showLogin(); return; }
    var sessionResult = await sb.auth.getSession();
    var session = sessionResult.data ? sessionResult.data.session : null;

    if (!session) {
      var storedSession = CustomStorage.getItem('atlas-hq-auth-token');
      if (storedSession) {
        try {
          var parsed = JSON.parse(storedSession);
          if (parsed && parsed.access_token && parsed.refresh_token) {
            var restoreResult = await sb.auth.setSession({
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token
            });
            if (restoreResult.data && restoreResult.data.session) session = restoreResult.data.session;
          }
        } catch(e) { CustomStorage.removeItem('atlas-hq-auth-token'); }
      }
    }

    if (session) {
      currentUser = session.user;
      isAuthenticated = true;
      try {
        CustomStorage.setItem('atlas-hq-session-backup', JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        }));
      } catch(e) {}
      await loadUserProfile();
      showApp();
    } else {
      showLogin();
    }

    sb.auth.onAuthStateChange(async function(event, session) {
      try {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session) {
          currentUser = session.user;
          isAuthenticated = true;
          try {
            CustomStorage.setItem('atlas-hq-session-backup', JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token
            }));
          } catch(e) {}
          try { await loadUserProfile(); } catch (e) {}
          showApp();
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          currentProfile = null;
          currentStaffPerms = null;
          isAuthenticated = false;
          CustomStorage.removeItem('atlas-hq-session-backup');
          showLogin();
        }
      } catch (err) { console.error('Auth state change error:', err); }
    });
  } catch (err) {
    console.error('[initAuth]', err);
    var backup = CustomStorage.getItem('atlas-hq-session-backup');
    if (backup) {
      try {
        var parsed = JSON.parse(backup);
        if (parsed && parsed.access_token && parsed.refresh_token) {
          var restoreResult = await sb.auth.setSession(parsed);
          if (restoreResult.data && restoreResult.data.session) {
            currentUser = restoreResult.data.session.user;
            isAuthenticated = true;
            await loadUserProfile();
            showApp();
            return;
          }
        }
      } catch(e) {}
    }
    showLogin();
  }
}

async function loadUserProfile() {
  if (!currentUser) return;
  try {
    var result = await resilientQuery(function() {
      return sb.from('profiles').select('id, email, full_name, role, phone, created_at').eq('id', currentUser.id).single();
    }, 'loadUserProfile');
    if (result.data) currentProfile = result.data;
  } catch (err) { console.error('[loadUserProfile]', err); }

  /* Load corporate staff permissions */
  try {
    var staffResult = await resilientQuery(function() {
      return sb.from('corporate_staff').select('*').eq('auth_user_id', currentUser.id).eq('is_active', true).single();
    }, 'loadStaffPerms');
    if (staffResult.data && !staffResult.error) {
      currentStaffPerms = staffResult.data;
    } else {
      var emailMatch = await resilientQuery(function() {
        return sb.from('corporate_staff').select('*').ilike('email', currentUser.email || '').eq('is_active', true).single();
      }, 'loadStaffPerms:email');
      if (emailMatch.data && !emailMatch.error) {
        currentStaffPerms = emailMatch.data;
        if (!emailMatch.data.auth_user_id) {
          try {
            await resilientWrite(function() { return sb.from('corporate_staff').update({ auth_user_id: currentUser.id }).eq('id', emailMatch.data.id); }, 'linkStaff');
          } catch(e) {}
        }
      } else { currentStaffPerms = null; }
    }
  } catch (e) { currentStaffPerms = null; }
}

function showLogin() {
  var loginPage = document.getElementById('login-page');
  var appShell = document.getElementById('app-shell');
  if (loginPage) loginPage.style.display = 'flex';
  if (appShell) { appShell.style.display = 'none'; appShell.classList.remove('active'); }
}

function showApp() {
  var loginPage = document.getElementById('login-page');
  var appShell = document.getElementById('app-shell');
  if (loginPage) loginPage.style.display = 'none';
  if (appShell) { appShell.style.display = 'grid'; appShell.classList.add('active'); }

  /* Update user display */
  var nameEl = document.getElementById('user-display-name');
  var avatarEl = document.getElementById('user-avatar-text');
  var name = (currentProfile && currentProfile.full_name) || (currentUser && currentUser.email) || 'User';
  if (nameEl) nameEl.textContent = name.split(' ')[0];
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

  /* Navigate to current hash or default */
  var hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var errorEl = document.getElementById('auth-error');
  if (!email || !password) {
    if (errorEl) { errorEl.textContent = 'Please enter email and password.'; errorEl.style.display = 'block'; }
    return false;
  }
  if (errorEl) errorEl.style.display = 'none';
  var btn = document.getElementById('auth-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }

  try {
    var result = await sb.auth.signInWithPassword({ email: email, password: password });
    if (result.error) {
      if (errorEl) { errorEl.textContent = result.error.message || 'Sign in failed.'; errorEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errorEl) { errorEl.textContent = 'An error occurred. Please try again.'; errorEl.style.display = 'block'; }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  return false;
}

async function signOut() {
  try { await sb.auth.signOut(); } catch(e) {}
  currentUser = null;
  currentProfile = null;
  currentStaffPerms = null;
  isAuthenticated = false;
  CustomStorage.removeItem('atlas-hq-auth-token');
  CustomStorage.removeItem('atlas-hq-session-backup');
  clearCache();
  showLogin();
}

/* ─── SPA Routing ─── */
var validPages = ['dashboard', 'projects', 'compliance', 'licensing', 'hr', 'documents'];
var _navId = 0;

var _pageRenderMap = {
  'dashboard': 'renderHQDashboard',
  'projects': 'renderProjects',
  'compliance': 'renderCompliance',
  'licensing': 'renderLicensing',
  'hr': 'renderHR',
  'documents': 'renderDocuments'
};

function navigateTo(page) {
  if (validPages.indexOf(page) === -1) page = 'dashboard';
  var oldHash = window.location.hash.replace('#', '');
  window.location.hash = page;
  if (oldHash === page) renderPage(page);
}

async function renderPage(page) {
  try {
    if (validPages.indexOf(page) === -1) page = 'dashboard';
    var myNavId = ++_navId;

    /* Hide all views */
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.remove('active');

    /* Show target view */
    var target = document.getElementById('view-' + page);
    if (target) target.classList.add('active');

    /* Update sidebar active state */
    var navLinks = document.querySelectorAll('#sidebar nav a');
    for (var j = 0; j < navLinks.length; j++) {
      var link = navLinks[j];
      if (link.getAttribute('data-page') === page) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }

    if (myNavId !== _navId) return;

    /* Call page render function */
    var renderFnName = _pageRenderMap[page];
    if (renderFnName && typeof window[renderFnName] === 'function') {
      try { await window[renderFnName](); }
      catch (renderErr) {
        if (myNavId !== _navId) return;
        console.error('Error rendering "' + page + '":', renderErr);
        showToast('Failed to load ' + page + ' page.', 'error');
      }
    }
  } catch (err) {
    console.error('[renderPage]', err);
    showToast('renderPage failed — please try again.', 'error');
  }
}

window.addEventListener('hashchange', function() {
  var hash = window.location.hash.replace('#', '') || 'dashboard';
  if (hash === 'login') return;
  if (!currentUser) { showLogin(); return; }
  renderPage(hash);
});

/* ─── Toast Notifications ─── */
var _toastDebounce = {};
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 4000;
  var key = type + ':' + message;
  if (_toastDebounce[key]) return;
  _toastDebounce[key] = true;
  setTimeout(function() { delete _toastDebounce[key]; }, 2000);

  var container = document.getElementById('toast-container');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function() {
    toast.classList.add('toast-removing');
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
  }, duration);
}

/* ─── Custom Confirm ─── */
function customConfirm(message, onConfirm, onCancel) {
  var overlay = document.getElementById('custom-confirm-overlay');
  var msgEl = document.getElementById('custom-confirm-msg');
  if (!overlay || !msgEl) { if (confirm(message)) { if (onConfirm) onConfirm(); } else { if (onCancel) onCancel(); } return; }
  msgEl.textContent = message;
  overlay.style.display = 'flex';
  var confirmBtn = document.getElementById('custom-confirm-yes');
  var cancelBtn = document.getElementById('custom-confirm-no');
  function cleanup() {
    overlay.style.display = 'none';
    if (confirmBtn) confirmBtn.onclick = null;
    if (cancelBtn) cancelBtn.onclick = null;
  }
  if (confirmBtn) confirmBtn.onclick = function() { cleanup(); if (onConfirm) onConfirm(); };
  if (cancelBtn) cancelBtn.onclick = function() { cleanup(); if (onCancel) onCancel(); };
}

/* ─── Modal Helpers ─── */
function openModal(modalId) {
  var el = document.getElementById(modalId);
  if (el) el.classList.add('active');
}
function closeModal(modalId) {
  var el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
}

/* ─── Date Formatting ─── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  var now = new Date(); now.setHours(0,0,0,0);
  var target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/* ─── Theme Toggle ─── */
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = (current === 'dark') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('atlas-hq-theme', next); } catch(e) {}
}
(function() {
  try {
    var saved = localStorage.getItem('atlas-hq-theme');
    if (saved) { document.documentElement.setAttribute('data-theme', saved); }
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {}
})();

/* ─── AI Search ─── */
function openAISearch() {
  var overlay = document.getElementById('ai-search-overlay');
  if (overlay) {
    overlay.classList.add('active');
    var input = document.getElementById('ai-search-input');
    if (input) { input.value = ''; input.focus(); }
    var results = document.getElementById('ai-search-results');
    if (results) results.innerHTML = '<div class="search-hint">Ask a question about your data or search across all modules...</div>';
  }
}
function closeAISearch() {
  var overlay = document.getElementById('ai-search-overlay');
  if (overlay) overlay.classList.remove('active');
}

/* CMD+K shortcut */
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    var overlay = document.getElementById('ai-search-overlay');
    if (overlay && overlay.classList.contains('active')) { closeAISearch(); }
    else { openAISearch(); }
  }
  if (e.key === 'Escape') {
    closeAISearch();
  }
});

/* ─── File Size Formatter ─── */
function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ─── Google Drive API ─── */
/*
 * SETUP REQUIRED:
 * 1. Go to console.cloud.google.com → create a project (or use existing)
 * 2. Enable "Google Drive API" and "Google Picker API"
 * 3. Create OAuth 2.0 credentials → Web application
 *    - Authorized JavaScript origins: http://localhost:5502, https://hq.talaria.com
 *    - Authorized redirect URIs: same origins
 * 4. Copy the Client ID below
 * 5. Also create an API Key (for Picker) and paste below
 */
var GOOGLE_CLIENT_ID = ''; /* TODO: paste your Google OAuth Client ID here */
var GOOGLE_API_KEY = '';   /* TODO: paste your Google API Key here */
var GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
var _googleAccessToken = null;
var _googleTokenClient = null;
var _gapiInited = false;
var _gisInited = false;

function initGapiClient() {
  if (typeof gapi === 'undefined') return;
  gapi.load('client:picker', function() {
    gapi.client.init({}).then(function() {
      gapi.client.load('drive', 'v3').then(function() {
        _gapiInited = true;
        _maybeEnableDriveButton();
      });
    });
  });
}

function initGisClient() {
  if (typeof google === 'undefined' || !google.accounts) return;
  if (!GOOGLE_CLIENT_ID) return;
  _googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: function(tokenResponse) {
      if (tokenResponse && tokenResponse.access_token) {
        _googleAccessToken = tokenResponse.access_token;
        gapi.client.setToken({ access_token: _googleAccessToken });
        if (typeof renderDocuments === 'function') renderDocuments();
      }
    }
  });
  _gisInited = true;
  _maybeEnableDriveButton();
}

function _maybeEnableDriveButton() {
  /* Called when both GAPI and GIS are ready */
  if (_gapiInited && _gisInited && typeof _onDriveReady === 'function') _onDriveReady();
}

function isGoogleDriveConnected() {
  return !!_googleAccessToken;
}

function connectGoogleDrive() {
  if (!GOOGLE_CLIENT_ID) {
    showToast('Google Drive not configured. Add your Client ID in shared.js.', 'error');
    return;
  }
  if (!_googleTokenClient) {
    showToast('Google Sign-In not ready. Please wait and try again.', 'error');
    return;
  }
  /* If no token, request one. If expired, request a new one. */
  if (!_googleAccessToken) {
    _googleTokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    _googleTokenClient.requestAccessToken({ prompt: '' });
  }
}

function disconnectGoogleDrive() {
  if (_googleAccessToken && typeof google !== 'undefined' && google.accounts) {
    google.accounts.oauth2.revoke(_googleAccessToken, function() {});
  }
  _googleAccessToken = null;
  if (typeof gapi !== 'undefined' && gapi.client) gapi.client.setToken(null);
  if (typeof renderDocuments === 'function') renderDocuments();
}

/* ─── Notification UI ─── */
var _notifPollTimer = null;

function toggleNotifDropdown() {
  var dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  var isOpen = dd.classList.contains('open');
  if (isOpen) {
    dd.classList.remove('open');
  } else {
    dd.classList.add('open');
    loadNotifications();
    /* Close on outside click */
    setTimeout(function() {
      document.addEventListener('click', function handler(e) {
        var dd2 = document.getElementById('notif-dropdown');
        var btn = document.getElementById('notif-bell-btn');
        if (dd2 && !dd2.contains(e.target) && btn && !btn.contains(e.target)) {
          dd2.classList.remove('open');
          document.removeEventListener('click', handler);
        }
      });
    }, 10);
  }
}

async function loadNotifications() {
  var body = document.getElementById('notif-dropdown-body');
  if (!body) return;
  try {
    var notifs = await fetchNotifications(true);
    if (notifs.length === 0) {
      body.innerHTML = '<div class="notif-empty">No notifications</div>';
    } else {
      var html = '';
      notifs.forEach(function(n) {
        html += '<div class="notif-item' + (n.is_read ? '' : ' unread') + '" onclick="onNotifClick(\'' + n.id + '\',\'' + escapeHtml(n.link_to || '') + '\')">';
        html += '<div class="notif-dot"></div>';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div class="notif-title">' + escapeHtml(n.title) + '</div>';
        if (n.body) html += '<div class="notif-body">' + escapeHtml(n.body) + '</div>';
        html += '<div class="notif-time">' + (typeof timeAgo === 'function' ? timeAgo(n.created_at) : formatDateTime(n.created_at)) + '</div>';
        html += '</div></div>';
      });
      body.innerHTML = html;
    }
    updateNotifBadge(notifs);
  } catch (err) {
    body.innerHTML = '<div class="notif-empty">Failed to load notifications</div>';
  }
}

function updateNotifBadge(notifs) {
  var badge = document.getElementById('notif-count-badge');
  if (!badge) return;
  var unread = 0;
  if (notifs) {
    for (var i = 0; i < notifs.length; i++) {
      if (!notifs[i].is_read) unread++;
    }
  }
  if (unread > 0) {
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function onNotifClick(notifId, linkTo) {
  await markNotificationRead(notifId);
  loadNotifications();
  if (linkTo) {
    var dd = document.getElementById('notif-dropdown');
    if (dd) dd.classList.remove('open');
    var hash = linkTo.replace('#', '');
    navigateTo(hash);
  }
}

function startNotifPolling() {
  if (_notifPollTimer) clearInterval(_notifPollTimer);
  /* Poll every 60 seconds for new notifications */
  _notifPollTimer = setInterval(function() {
    if (isAuthenticated) {
      fetchNotifications(true).then(function(notifs) {
        updateNotifBadge(notifs);
      }).catch(function() {});
    }
  }, 60000);
  /* Initial load */
  if (isAuthenticated) {
    fetchNotifications(true).then(function(notifs) {
      updateNotifBadge(notifs);
    }).catch(function() {});
  }
}

/* ─── Init on DOM Ready ─── */
document.addEventListener('DOMContentLoaded', function() {
  if (!sb) initSupabaseClient();
  initAuth();
  /* Init Google APIs after a short delay to let CDN scripts load */
  setTimeout(function() {
    initGapiClient();
    initGisClient();
  }, 500);
  /* Start notification polling after auth */
  setTimeout(function() {
    startNotifPolling();
  }, 3000);
});
