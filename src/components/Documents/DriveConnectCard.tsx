import { HardDrive, FolderPlus } from 'lucide-react';

interface Props {
  onConnect: () => void;
  onSetupFolders: () => void;
  isConnected: boolean;
  hasRootFolder: boolean;
  loading: boolean;
}

export default function DriveConnectCard({ onConnect, onSetupFolders, isConnected, hasRootFolder, loading }: Props) {
  if (isConnected && hasRootFolder) return null;

  return (
    <div className="empty-state" style={{ padding: '4rem' }}>
      <HardDrive size={64} strokeWidth={1} />
      {!isConnected ? (
        <>
          <div className="empty-state-title">Connect Google Drive</div>
          <div className="empty-state-text">
            Link your Google Drive to manage documents, SOPs, compliance files, and more.
            Files stay in Google Drive — Atlas HQ organizes and tracks them.
          </div>
          <button className="btn btn-primary" onClick={onConnect} disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'Connecting...' : 'Connect Google Drive'}
          </button>
        </>
      ) : (
        <>
          <div className="empty-state-title">Set Up Folder Structure</div>
          <div className="empty-state-text">
            Google Drive is connected. Create the Talaria HQ folder hierarchy to organize your documents
            by department (Corporate, Licenses, Insurance, Compliance, HR, Vehicles, Financial).
          </div>
          <button className="btn btn-primary" onClick={onSetupFolders} disabled={loading} style={{ marginTop: '1rem' }}>
            <FolderPlus size={16} />
            {loading ? 'Creating Folders...' : 'Create Folder Structure'}
          </button>
        </>
      )}
    </div>
  );
}
