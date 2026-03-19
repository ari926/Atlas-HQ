/* ═══ Atlas HQ — Documents (Google Drive API) ═══
   Files stay in Google Drive — Atlas HQ shows them inline.
   No files are copied to Supabase. Google's security protects the originals.
   Metadata (tags, bookmarks) can be stored in hq_documents table. */

var _currentDriveFolderId = 'root';
var _driveBreadcrumb = [{ id: 'root', name: 'My Drive' }];

/* Called when both GAPI + GIS are initialized */
function _onDriveReady() {
  /* Nothing to do until user navigates to Documents tab */
}

async function renderDocuments() {
  var container = document.getElementById('documents-content');
  var headerActions = document.getElementById('drive-header-actions');
  if (!container) return;

  /* Show connect button or disconnect option */
  if (headerActions) {
    if (isGoogleDriveConnected()) {
      headerActions.innerHTML = '<button class="btn btn-secondary btn-sm" onclick="disconnectGoogleDrive()">Disconnect Drive</button>';
    } else {
      headerActions.innerHTML = '';
    }
  }

  /* Not connected — show connect prompt */
  if (!isGoogleDriveConnected()) {
    container.innerHTML = '<div class="empty-state" style="padding:4rem;">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:64px;height:64px;margin-bottom:1.5rem;opacity:0.4;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
      '<div class="empty-state-title" style="font-size:var(--text-base);">Connect Google Drive</div>' +
      '<div class="empty-state-text" style="max-width:400px;margin:0.5rem auto 1.5rem;">Your documents stay secure in Google\'s cloud. Atlas HQ provides a unified view without copying files.</div>' +
      '<button class="btn btn-primary" onclick="connectGoogleDrive()" style="gap:0.5rem;">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M15.5 2H8.6c-.4 0-.8.2-1 .6L2.1 11.4c-.2.4-.2.8 0 1.2l3 5.2c.2.4.6.6 1 .6h11.8c.4 0 .8-.2 1-.6l3-5.2c.2-.4.2-.8 0-1.2L16.5 2.6c-.2-.4-.6-.6-1-.6z"/></svg>' +
      'Connect Google Drive</button>' +
      '<p style="font-size:var(--text-xs);color:var(--color-tx-faint);margin-top:1rem;">Read-only access. Atlas HQ cannot modify or delete your files.</p>' +
      '</div>';
    return;
  }

  /* Connected — load files from Drive API */
  container.innerHTML = '<div class="search-loading"><span>Loading files from Google Drive...</span></div>';

  try {
    var response = await gapi.client.drive.files.list({
      pageSize: 50,
      q: "'" + _currentDriveFolderId + "' in parents and trashed = false",
      fields: 'files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink, thumbnailLink, parents)',
      orderBy: 'folder,name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    var files = response.result.files || [];

    /* Separate folders and files */
    var folders = files.filter(function(f) { return f.mimeType === 'application/vnd.google-apps.folder'; });
    var docs = files.filter(function(f) { return f.mimeType !== 'application/vnd.google-apps.folder'; });

    /* Build breadcrumb */
    var breadcrumbHtml = '<div class="doc-breadcrumb">';
    _driveBreadcrumb.forEach(function(crumb, i) {
      if (i < _driveBreadcrumb.length - 1) {
        breadcrumbHtml += '<a onclick="navigateToDriveFolder(\'' + crumb.id + '\',' + i + ')">' + escapeHtml(crumb.name) + '</a>';
        breadcrumbHtml += ' <span style="margin:0 0.25rem;color:var(--color-tx-faint);">/</span> ';
      } else {
        breadcrumbHtml += '<span style="color:var(--color-tx);">' + escapeHtml(crumb.name) + '</span>';
      }
    });
    breadcrumbHtml += '</div>';

    /* Build file grid */
    var gridHtml = '';
    if (folders.length === 0 && docs.length === 0) {
      gridHtml = '<div class="doc-empty">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
        '<div class="empty-state-title">This folder is empty</div></div>';
    } else {
      gridHtml = '<div class="doc-file-grid">';

      /* Folders first */
      folders.forEach(function(folder) {
        gridHtml += '<div class="doc-file-card" onclick="navigateToDriveFolder(\'' + folder.id + '\')">' +
          '<div class="doc-file-icon other" style="background:var(--color-primary-hl);color:var(--color-primary);">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
          '</div>' +
          '<div class="doc-file-name">' + escapeHtml(folder.name) + '</div>' +
          '<div class="doc-file-meta">Folder</div>' +
          '</div>';
      });

      /* Files */
      docs.forEach(function(doc) {
        var iconInfo = getDriveFileIcon(doc.mimeType, doc.name);
        gridHtml += '<div class="doc-file-card" onclick="openDriveFile(\'' + escapeHtml(doc.webViewLink || '') + '\')">' +
          '<div class="doc-file-icon ' + iconInfo.cls + '">' + iconInfo.label + '</div>' +
          '<div class="doc-file-name">' + escapeHtml(doc.name) + '</div>' +
          '<div class="doc-file-meta">' + formatFileSize(doc.size ? parseInt(doc.size) : 0) +
          ' &middot; ' + formatDate(doc.modifiedTime) + '</div>' +
          '</div>';
      });

      gridHtml += '</div>';
    }

    /* Stats bar */
    var statsHtml = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">' +
      '<span style="font-size:var(--text-xs);color:var(--color-tx-muted);">' +
      folders.length + ' folder' + (folders.length !== 1 ? 's' : '') + ', ' +
      docs.length + ' file' + (docs.length !== 1 ? 's' : '') +
      '</span>' +
      '<span style="font-size:var(--text-xs);color:var(--color-tx-faint);">Files secured by Google Drive</span>' +
      '</div>';

    container.innerHTML = breadcrumbHtml + statsHtml + gridHtml;
  } catch (err) {
    console.error('[renderDocuments]', err);
    if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
      _googleAccessToken = null;
      container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Session expired</div>' +
        '<div class="empty-state-text">Your Google Drive session has expired.</div>' +
        '<button class="btn btn-primary" onclick="connectGoogleDrive()">Reconnect</button></div>';
    } else {
      showToast('Failed to load Google Drive files.', 'error');
      container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Failed to load files</div>' +
        '<div class="empty-state-text">' + escapeHtml(err.message || 'Unknown error') + '</div>' +
        '<button class="btn btn-secondary" onclick="renderDocuments()">Retry</button></div>';
    }
  }
}

function navigateToDriveFolder(folderId, breadcrumbIndex) {
  if (breadcrumbIndex !== undefined) {
    /* Clicked a breadcrumb — trim to that level */
    _driveBreadcrumb = _driveBreadcrumb.slice(0, breadcrumbIndex + 1);
  } else {
    /* Navigating into a subfolder — need to get its name */
    var container = document.getElementById('documents-content');
    var cards = container ? container.querySelectorAll('.doc-file-card') : [];
    var folderName = folderId;
    for (var i = 0; i < cards.length; i++) {
      var nameEl = cards[i].querySelector('.doc-file-name');
      var metaEl = cards[i].querySelector('.doc-file-meta');
      if (nameEl && metaEl && metaEl.textContent === 'Folder' && cards[i].getAttribute('onclick').indexOf(folderId) !== -1) {
        folderName = nameEl.textContent;
        break;
      }
    }
    _driveBreadcrumb.push({ id: folderId, name: folderName });
  }
  _currentDriveFolderId = folderId;
  renderDocuments();
}

function openDriveFile(url) {
  if (url) {
    window.open(url, '_blank', 'noopener');
  }
}

function getDriveFileIcon(mimeType, name) {
  mimeType = mimeType || '';
  name = name || '';
  var ext = name.split('.').pop().toLowerCase();

  /* Google Workspace types */
  if (mimeType === 'application/vnd.google-apps.document') return { cls: 'doc', label: 'DOC' };
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return { cls: 'sheet', label: 'SHEET' };
  if (mimeType === 'application/vnd.google-apps.presentation') return { cls: 'other', label: 'SLIDE' };
  if (mimeType === 'application/vnd.google-apps.form') return { cls: 'other', label: 'FORM' };

  /* Standard file types */
  if (mimeType === 'application/pdf' || ext === 'pdf') return { cls: 'pdf', label: 'PDF' };
  if (mimeType.indexOf('word') !== -1 || ext === 'doc' || ext === 'docx') return { cls: 'doc', label: 'DOC' };
  if (mimeType.indexOf('sheet') !== -1 || mimeType.indexOf('excel') !== -1 || ext === 'xls' || ext === 'xlsx' || ext === 'csv') return { cls: 'sheet', label: 'XLS' };
  if (mimeType.indexOf('image') !== -1 || ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') return { cls: 'img', label: 'IMG' };
  if (mimeType.indexOf('video') !== -1) return { cls: 'other', label: 'VID' };
  if (mimeType.indexOf('audio') !== -1) return { cls: 'other', label: 'AUD' };
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return { cls: 'other', label: 'ZIP' };
  if (ext === 'txt' || ext === 'md') return { cls: 'doc', label: 'TXT' };

  return { cls: 'other', label: ext.toUpperCase().substring(0, 4) || 'FILE' };
}
