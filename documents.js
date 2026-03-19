/* ═══ Atlas HQ — Documents ═══ */

var _currentFolderId = null;

async function renderDocuments() {
  try {
    var docs = await fetchDocuments();
    var folders = await fetchFolders();
    var container = document.getElementById('documents-content');
    if (!container) return;

    /* Build folder tree */
    var treeHtml = '<div class="doc-tree">';
    treeHtml += '<div class="doc-tree-item' + (!_currentFolderId ? ' active' : '') + '" onclick="_currentFolderId=null;renderDocuments()">';
    treeHtml += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
    treeHtml += '<span>All Files</span></div>';
    folders.forEach(function(f) {
      if (!f.parent_id) {
        treeHtml += '<div class="doc-tree-item' + (_currentFolderId === f.id ? ' active' : '') + '" onclick="_currentFolderId=\'' + f.id + '\';renderDocuments()">';
        treeHtml += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
        treeHtml += '<span>' + escapeHtml(f.name) + '</span></div>';
        /* Sub-folders */
        folders.forEach(function(sf) {
          if (sf.parent_id === f.id) {
            treeHtml += '<div class="doc-tree-item' + (_currentFolderId === sf.id ? ' active' : '') + '" style="padding-left:1.5rem;" onclick="_currentFolderId=\'' + sf.id + '\';renderDocuments()">';
            treeHtml += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
            treeHtml += '<span>' + escapeHtml(sf.name) + '</span></div>';
          }
        });
      }
    });
    treeHtml += '</div>';

    /* Filter docs by current folder */
    var filteredDocs = _currentFolderId
      ? docs.filter(function(d) { return d.folder_id === _currentFolderId; })
      : docs;

    /* Breadcrumb */
    var breadcrumb = '<div class="doc-breadcrumb">';
    breadcrumb += '<a onclick="_currentFolderId=null;renderDocuments()">All Files</a>';
    if (_currentFolderId) {
      var currentFolder = folders.filter(function(f) { return f.id === _currentFolderId; })[0];
      if (currentFolder) {
        if (currentFolder.parent_id) {
          var parent = folders.filter(function(f) { return f.id === currentFolder.parent_id; })[0];
          if (parent) breadcrumb += ' <span style="margin:0 0.25rem;">/</span> <a onclick="_currentFolderId=\'' + parent.id + '\';renderDocuments()">' + escapeHtml(parent.name) + '</a>';
        }
        breadcrumb += ' <span style="margin:0 0.25rem;">/</span> ' + escapeHtml(currentFolder.name);
      }
    }
    breadcrumb += '</div>';

    /* File grid */
    var filesHtml = '';
    if (filteredDocs.length === 0) {
      filesHtml = '<div class="doc-empty"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><div class="empty-state-title">No files here</div><div class="empty-state-text">Upload files or create folders to get started.</div></div>';
    } else {
      filesHtml = '<div class="doc-file-grid">';
      filteredDocs.forEach(function(doc) {
        var ext = (doc.name || '').split('.').pop().toLowerCase();
        var iconClass = 'other';
        var iconText = ext.toUpperCase().substring(0, 4);
        if (ext === 'pdf') iconClass = 'pdf';
        else if (ext === 'doc' || ext === 'docx') iconClass = 'doc';
        else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') iconClass = 'sheet';
        else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') iconClass = 'img';

        filesHtml += '<div class="doc-file-card" onclick="openDocumentDetail(\'' + doc.id + '\')">';
        filesHtml += '<div class="doc-file-icon ' + iconClass + '">' + iconText + '</div>';
        filesHtml += '<div class="doc-file-name">' + escapeHtml(doc.name) + '</div>';
        filesHtml += '<div class="doc-file-meta">' + formatFileSize(doc.size_bytes) + ' &middot; ' + formatDate(doc.created_at) + '</div>';
        filesHtml += '</div>';
      });
      filesHtml += '</div>';
    }

    container.innerHTML = '<div class="doc-browser">' + treeHtml + '<div class="doc-main">' + breadcrumb + filesHtml + '</div></div>';
  } catch (err) {
    console.error('[renderDocuments]', err);
    showToast('Failed to load documents.', 'error');
  }
}

function openFolderModal() {
  document.getElementById('hq-modal-title').textContent = 'New Folder';
  var body = document.getElementById('hq-modal-body');
  body.innerHTML = '<div class="form-row"><label class="field-label">Folder Name</label><input type="text" id="folder-name" class="input-field" placeholder="Folder name"></div>';
  var footer = document.getElementById('hq-modal-footer');
  footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Create</button>';
  document.getElementById('hq-modal-save').onclick = function() { saveFolder(); };
  openModal('hq-modal');
}

async function saveFolder() {
  var name = document.getElementById('folder-name').value.trim();
  if (!name) { showToast('Folder name is required.', 'error'); return; }
  try {
    await resilientWrite(function() {
      return supabase.from('hq_document_folders').insert({
        name: name,
        parent_id: _currentFolderId || null
      });
    }, 'createFolder');
    clearCache('folders');
    closeModal('hq-modal');
    renderDocuments();
    showToast('Folder created.', 'success');
  } catch (err) { console.error('[saveFolder]', err); showToast('Failed to create folder.', 'error'); }
}

function openUploadModal() {
  document.getElementById('hq-modal-title').textContent = 'Upload File';
  var body = document.getElementById('hq-modal-body');
  body.innerHTML = '<div class="form-row"><label class="field-label">Select File</label><input type="file" id="doc-file-input" class="input-field" style="padding:0.375rem;"></div>' +
    '<p style="font-size:var(--text-xs);color:var(--color-tx-muted);margin-top:0.5rem;">File will be uploaded to Supabase Storage and indexed in the documents table.</p>';
  var footer = document.getElementById('hq-modal-footer');
  footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Cancel</button><button class="btn btn-primary" id="hq-modal-save">Upload</button>';
  document.getElementById('hq-modal-save').onclick = function() { uploadDocument(); };
  openModal('hq-modal');
}

async function uploadDocument() {
  var fileInput = document.getElementById('doc-file-input');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a file.', 'error');
    return;
  }
  var file = fileInput.files[0];
  var fileName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var storagePath = 'uploads/' + fileName;

  try {
    showToast('Uploading...', 'info');
    var uploadResult = await supabase.storage.from('hq-documents').upload(storagePath, file);
    if (uploadResult.error) throw uploadResult.error;

    await resilientWrite(function() {
      return supabase.from('hq_documents').insert({
        name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: storagePath,
        folder_id: _currentFolderId || null,
        uploaded_by: currentUser ? currentUser.id : null
      });
    }, 'insertDocument');

    clearCache('documents');
    closeModal('hq-modal');
    renderDocuments();
    showToast('File uploaded.', 'success');
  } catch (err) {
    console.error('[uploadDocument]', err);
    showToast('Upload failed: ' + (err.message || 'Unknown error'), 'error');
  }
}

function openDocumentDetail(docId) {
  /* Simple view — could expand to preview/download */
  var doc = (dataCache.documents || []).filter(function(d) { return d.id === docId; })[0];
  if (!doc) return;

  document.getElementById('hq-modal-title').textContent = doc.name;
  var body = document.getElementById('hq-modal-body');
  body.innerHTML = '<div style="display:flex;flex-direction:column;gap:0.75rem;">' +
    '<div class="license-card-detail"><span>Type</span><span>' + escapeHtml(doc.mime_type || 'Unknown') + '</span></div>' +
    '<div class="license-card-detail"><span>Size</span><span>' + formatFileSize(doc.size_bytes) + '</span></div>' +
    '<div class="license-card-detail"><span>Uploaded</span><span>' + formatDateTime(doc.created_at) + '</span></div>' +
    '<div class="license-card-detail"><span>Storage Path</span><span>' + escapeHtml(doc.storage_path || '—') + '</span></div>' +
    '</div>';

  var footer = document.getElementById('hq-modal-footer');
  footer.innerHTML = '<button class="btn btn-danger-ghost" onclick="deleteDocument(\'' + docId + '\')">Delete</button><div style="flex:1;"></div><button class="btn btn-secondary" onclick="closeModal(\'hq-modal\')">Close</button>';
  openModal('hq-modal');
}

function deleteDocument(docId) {
  customConfirm('Delete this document?', async function() {
    try {
      var doc = (dataCache.documents || []).filter(function(d) { return d.id === docId; })[0];
      if (doc && doc.storage_path) {
        await supabase.storage.from('hq-documents').remove([doc.storage_path]).catch(function() {});
      }
      await resilientWrite(function() { return supabase.from('hq_documents').delete().eq('id', docId); }, 'deleteDocument');
      clearCache('documents');
      closeModal('hq-modal');
      renderDocuments();
      showToast('Document deleted.', 'success');
    } catch (err) { console.error('[deleteDocument]', err); showToast('Failed to delete.', 'error'); }
  });
}
