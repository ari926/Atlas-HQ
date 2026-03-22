import { FileText, Image, FileSpreadsheet, Film, File, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DriveFile } from '../../lib/driveApi';

export interface HqDocument {
  id: string;
  name: string;
  google_drive_id: string | null;
  google_drive_url: string | null;
  expiration_date: string | null;
  linked_module: string | null;
  linked_record_id: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  folder_id: string | null;
}

interface Props {
  files: DriveFile[];
  documents: HqDocument[];
  viewMode: 'list' | 'grid';
  onFileClick: (file: DriveFile) => void;
  onOpenInDrive: (url: string) => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('video')) return Film;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  return File;
}

function formatSize(bytes?: string | number): string {
  if (!bytes) return '';
  const b = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function getExpirationBadge(doc: HqDocument | undefined) {
  if (!doc?.expiration_date) return null;
  const exp = new Date(doc.expiration_date);
  const now = new Date();
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return <span className="badge badge-expired">Expired</span>;
  }
  if (daysUntil <= 30) {
    return <span className="badge badge-expiring">Expires in {daysUntil}d</span>;
  }
  return null;
}

export default function FileList({ files, documents, viewMode, onFileClick, onOpenInDrive }: Props) {
  const isFolder = (f: DriveFile) => f.mimeType === 'application/vnd.google-apps.folder';

  // Build a map of Drive ID → HQ document for fast lookup
  const docMap = new Map(documents.filter(d => d.google_drive_id).map(d => [d.google_drive_id!, d]));

  // Sort: folders first, then files by name
  const sorted = [...files].sort((a, b) => {
    if (isFolder(a) && !isFolder(b)) return -1;
    if (!isFolder(a) && isFolder(b)) return 1;
    return a.name.localeCompare(b.name);
  });

  if (sorted.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '3rem' }}>
        <File size={48} strokeWidth={1} />
        <div className="empty-state-title">No files in this folder</div>
        <div className="empty-state-text">Upload files or navigate to a different folder.</div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="file-grid">
        {sorted.map(file => {
          const Icon = isFolder(file) ? FolderIcon : getFileIcon(file.mimeType);
          const hqDoc = docMap.get(file.id);
          return (
            <div key={file.id} className="file-grid-card" onClick={() => onFileClick(file)}>
              <Icon size={32} strokeWidth={1.5} />
              <div className="file-grid-name">{file.name}</div>
              <div className="file-grid-meta">
                {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
              </div>
              {getExpirationBadge(hqDoc)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="file-list">
      {sorted.map(file => {
        const Icon = isFolder(file) ? FolderIcon : getFileIcon(file.mimeType);
        const hqDoc = docMap.get(file.id);
        return (
          <div key={file.id} className="file-item" onClick={() => onFileClick(file)}>
            <div className="file-item-icon">
              <Icon size={20} />
            </div>
            <div className="file-item-info">
              <div className="file-item-name">{file.name}</div>
              <div className="file-item-meta">
                {isFolder(file) ? 'Folder' : formatSize(file.size)}
                {file.modifiedTime && ` · ${formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}`}
                {file.lastModifyingUser && ` · ${file.lastModifyingUser.displayName}`}
              </div>
            </div>
            {getExpirationBadge(hqDoc)}
            {file.webViewLink && !isFolder(file) && (
              <button
                className="btn btn-ghost btn-sm"
                title="Open in Google Drive"
                onClick={(e) => { e.stopPropagation(); onOpenInDrive(file.webViewLink!); }}
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FolderIcon(props: { size?: number; strokeWidth?: number }) {
  return <FolderIconInner {...props} />;
}

function FolderIconInner({ size = 20, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--color-warning)' }}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}
