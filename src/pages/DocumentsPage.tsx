import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, List, LayoutGrid, Search, FileText, Clock, AlertTriangle, HardDrive, FolderPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  getDriveStatus,
  getAuthUrl,
  listFiles as driveListFiles,
  searchFiles as driveSearchFiles,
  setupFolders,
  type DriveFile,
  type DriveStatus,
} from '../lib/driveApi';
import Modal from '../components/common/Modal';
import DriveConnectCard from '../components/Documents/DriveConnectCard';
import FolderTree, { type FolderNode } from '../components/Documents/FolderTree';
import BreadcrumbNav, { type BreadcrumbSegment } from '../components/Documents/BreadcrumbNav';
import FileList, { type HqDocument } from '../components/Documents/FileList';
import FileUpload from '../components/Documents/FileUpload';
import FileDetailModal from '../components/Documents/FileDetailModal';

type ViewMode = 'list' | 'grid';

interface FolderRecord {
  id: string;
  name: string;
  parent_id: string | null;
  google_drive_folder_id: string | null;
}

export default function DocumentsPage() {
  // Connection state
  const [status, setStatus] = useState<DriveStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);

  // Folder state
  const [folderRecords, setFolderRecords] = useState<FolderRecord[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbSegment[]>([]);

  // File state
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [documents, setDocuments] = useState<HqDocument[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string>();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DriveFile[] | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Build folder tree from flat records
  const folderTree = useMemo((): FolderNode[] => {
    const map = new Map<string | null, FolderRecord[]>();
    for (const f of folderRecords) {
      const pid = f.parent_id;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(f);
    }
    function build(parentId: string | null): FolderNode[] {
      const children = map.get(parentId) || [];
      return children
        .filter(f => f.google_drive_folder_id)
        .map(f => ({
          id: f.id,
          name: f.name,
          googleDriveFolderId: f.google_drive_folder_id!,
          children: build(f.id),
        }));
    }
    return build(null);
  }, [folderRecords]);

  // Load drive status + folders
  const loadStatus = useCallback(async () => {
    try {
      const s = await getDriveStatus();
      setStatus(s);

      if (s.connected) {
        const { data } = await supabase
          .from('hq_document_folders')
          .select('*')
          .order('name');
        setFolderRecords(data || []);

        const { data: docs } = await supabase
          .from('hq_documents')
          .select('*');
        setDocuments(docs || []);

        if (s.rootFolderId && !currentFolderId) {
          setCurrentFolderId(s.rootFolderId);
          setBreadcrumb([{ id: s.rootFolderId, name: 'Talaria HQ' }]);
        }
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  // Load files for current folder
  const loadFiles = useCallback(async (folderId: string) => {
    if (!folderId) return;
    setFilesLoading(true);
    try {
      const result = await driveListFiles(folderId);
      setFiles(result.files);
      setNextPageToken(result.nextPageToken);
    } catch {
      toast.error('Failed to load files');
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!nextPageToken || !currentFolderId) return;
    setFilesLoading(true);
    try {
      const result = await driveListFiles(currentFolderId, nextPageToken);
      setFiles(prev => [...prev, ...result.files]);
      setNextPageToken(result.nextPageToken);
    } catch {
      toast.error('Failed to load more files');
    } finally {
      setFilesLoading(false);
    }
  }, [nextPageToken, currentFolderId]);

  // Check for OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      toast.success('Google Drive connected!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      toast.error(`Connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (currentFolderId && status.connected) {
      loadFiles(currentFolderId);
      setSearchResults(null);
      setSearchQuery('');
    }
  }, [currentFolderId, status.connected, loadFiles]);

  // Navigate to folder
  const navigateToFolder = useCallback((driveFolderId: string, name?: string) => {
    setCurrentFolderId(driveFolderId);
    if (driveFolderId === status.rootFolderId) {
      setBreadcrumb([{ id: driveFolderId, name: 'Talaria HQ' }]);
    } else if (name) {
      const idx = breadcrumb.findIndex(b => b.id === driveFolderId);
      if (idx >= 0) {
        setBreadcrumb(breadcrumb.slice(0, idx + 1));
      } else {
        setBreadcrumb([...breadcrumb, { id: driveFolderId, name }]);
      }
    }
  }, [breadcrumb, status.rootFolderId]);

  const handleFileClick = useCallback((file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      navigateToFolder(file.id, file.name);
    } else {
      setSelectedFile(file);
    }
  }, [navigateToFolder]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const result = await driveSearchFiles(searchQuery);
      setSearchResults(result.files);
    } catch {
      toast.error('Search failed');
    }
  }, [searchQuery]);

  const handleConnect = useCallback(async () => {
    setConnectLoading(true);
    try {
      const url = await getAuthUrl();
      window.location.href = url;
    } catch {
      toast.error('Failed to start connection. Is the Drive proxy running?');
      setConnectLoading(false);
    }
  }, []);

  const handleSetupFolders = useCallback(async () => {
    setConnectLoading(true);
    try {
      const result = await setupFolders();
      toast.success('Folder structure created!');
      setStatus(prev => ({ ...prev, rootFolderId: result.rootFolderId }));
      await loadStatus();
    } catch {
      toast.error('Failed to create folders');
    } finally {
      setConnectLoading(false);
    }
  }, [loadStatus]);

  const handleSaveDocument = useCallback(async (updates: Partial<HqDocument>) => {
    if (!selectedFile) return;
    const existing = documents.find(d => d.google_drive_id === selectedFile.id);
    if (existing) {
      await supabase.from('hq_documents').update(updates).eq('id', existing.id);
    } else {
      await supabase.from('hq_documents').insert({
        name: selectedFile.name,
        mime_type: selectedFile.mimeType,
        size_bytes: selectedFile.size ? parseInt(selectedFile.size) : null,
        google_drive_id: selectedFile.id,
        google_drive_url: selectedFile.webViewLink,
        ...updates,
      });
    }
    const { data } = await supabase.from('hq_documents').select('*');
    setDocuments(data || []);
  }, [selectedFile, documents]);

  const currentFolderDbId = useMemo(() => {
    const rec = folderRecords.find(f => f.google_drive_folder_id === currentFolderId);
    return rec?.id || null;
  }, [folderRecords, currentFolderId]);

  // KPIs
  const kpis = useMemo(() => {
    const total = documents.length;
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const recent = documents.filter(d => {
      const created = (d as unknown as Record<string, unknown>).created_at;
      return created && new Date(created as string) > sevenDaysAgo;
    }).length;
    const expiring = documents.filter(d => {
      if (!d.expiration_date) return false;
      const exp = new Date(d.expiration_date);
      return exp > now && exp <= thirtyDaysFromNow;
    }).length;
    return { total, recent, expiring };
  }, [documents]);

  // Loading
  if (loading) {
    return (
      <div>
        <div className="view-header">
          <div>
            <h1 className="view-title">Documents</h1>
            <p className="view-subtitle">Google Drive document browser</p>
          </div>
        </div>
        <div className="empty-state" style={{ padding: '4rem' }}>
          <div style={{ color: 'var(--color-tx-muted)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Not connected
  if (!status.connected || !status.rootFolderId) {
    return (
      <div>
        <div className="view-header">
          <div>
            <h1 className="view-title">Documents</h1>
            <p className="view-subtitle">Google Drive document browser</p>
          </div>
        </div>
        <DriveConnectCard
          onConnect={handleConnect}
          onSetupFolders={handleSetupFolders}
          isConnected={status.connected}
          hasRootFolder={!!status.rootFolderId}
          loading={connectLoading}
        />
      </div>
    );
  }

  const displayFiles = searchResults !== null ? searchResults : files;
  const selectedHqDoc = selectedFile ? documents.find(d => d.google_drive_id === selectedFile.id) || null : null;

  return (
    <div>
      {/* Header */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Documents</h1>
          <p className="view-subtitle">Google Drive document browser</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={14} />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
            <Upload size={14} />
            Upload
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon"><FileText size={16} /></div>
          <div>
            <div className="kpi-label">Total Files</div>
            <div className="kpi-value">{kpis.total}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Clock size={16} /></div>
          <div>
            <div className="kpi-label">Recent Uploads</div>
            <div className="kpi-value">{kpis.recent}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--color-warning)' }}><AlertTriangle size={16} /></div>
          <div>
            <div className="kpi-label">Expiring Soon</div>
            <div className="kpi-value">{kpis.expiring}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--color-primary)' }}><HardDrive size={16} /></div>
          <div>
            <div className="kpi-label">Drive Status</div>
            <div className="kpi-value" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>Connected</div>
          </div>
        </div>
      </div>

      {/* Search + Breadcrumb */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: '0 0 240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-tx-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ paddingLeft: '2rem', width: '100%' }}
          />
        </div>
        {searchResults !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)' }}>
            <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
              Clear
            </button>
          </div>
        ) : (
          <BreadcrumbNav breadcrumb={breadcrumb} onNavigate={(id) => navigateToFolder(id)} />
        )}
      </div>

      {/* Document Browser */}
      <div className="doc-browser">
        <div className="doc-browser-sidebar">
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-tx-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Folders
          </div>
          {folderTree.length > 0 ? (
            <FolderTree
              folders={folderTree}
              currentFolderId={currentFolderId}
              onSelect={(driveFolderId, name) => navigateToFolder(driveFolderId, name)}
            />
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)', padding: '1rem 0' }}>
              No folders yet.
              <button className="btn btn-ghost btn-sm" onClick={handleSetupFolders} style={{ marginLeft: '0.25rem' }}>
                <FolderPlus size={12} /> Create
              </button>
            </div>
          )}
        </div>

        <div className="doc-browser-main">
          {filesLoading && files.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div style={{ color: 'var(--color-tx-muted)' }}>Loading files...</div>
            </div>
          ) : (
            <>
              <FileList
                files={displayFiles}
                documents={documents}
                viewMode={viewMode}
                onFileClick={handleFileClick}
                onOpenInDrive={(url) => window.open(url, '_blank')}
              />
              {nextPageToken && !searchResults && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={loadMore} disabled={filesLoading}>
                    {filesLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload File">
        <FileUpload
          folderId={currentFolderId}
          folderDbId={currentFolderDbId}
          onUploadComplete={() => { loadFiles(currentFolderId); loadStatus(); }}
          onClose={() => setUploadOpen(false)}
        />
      </Modal>

      {/* File Detail Modal */}
      <FileDetailModal
        file={selectedFile}
        document={selectedHqDoc}
        onClose={() => setSelectedFile(null)}
        onSave={handleSaveDocument}
      />
    </div>
  );
}
