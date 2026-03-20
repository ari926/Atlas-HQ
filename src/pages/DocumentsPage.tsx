import { FolderOpen } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Documents</h1>
          <p className="view-subtitle">Google Drive document browser</p>
        </div>
      </div>

      <div className="empty-state" style={{ padding: '4rem' }}>
        <FolderOpen size={64} strokeWidth={1} />
        <div className="empty-state-title">Google Drive integration coming soon</div>
        <div className="empty-state-text">
          This page will connect to Google Drive for centralized document management, SOPs, and compliance files.
        </div>
      </div>
    </div>
  );
}
