import { useState, useEffect } from 'react';
import { ExternalLink, Clock, User, FileText, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import type { DriveFile, DriveRevision } from '../../lib/driveApi';
import { getRevisions } from '../../lib/driveApi';
import type { HqDocument } from './FileList';
import { formatDistanceToNow, format } from 'date-fns';

interface Props {
  file: DriveFile | null;
  document: HqDocument | null;
  onClose: () => void;
  onSave: (updates: Partial<HqDocument>) => void;
}

export default function FileDetailModal({ file, document: hqDoc, onClose, onSave }: Props) {
  const [revisions, setRevisions] = useState<DriveRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [expirationDate, setExpirationDate] = useState(hqDoc?.expiration_date || '');

  useEffect(() => {
    setExpirationDate(hqDoc?.expiration_date || '');
  }, [hqDoc]);

  const loadRevisions = async () => {
    if (!file) return;
    setLoadingRevisions(true);
    try {
      const revs = await getRevisions(file.id);
      setRevisions(revs);
      setShowRevisions(true);
    } catch {
      toast.error('Could not load version history');
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleSave = () => {
    onSave({ expiration_date: expirationDate || null });
    toast.success('Document updated');
    onClose();
  };

  if (!file) return null;

  const size = file.size ? formatSize(parseInt(file.size)) : 'Unknown';
  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

  return (
    <Modal open={!!file} onClose={onClose} title={file.name} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* File Info */}
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-row">
            <label className="field-label"><FileText size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Type</label>
            <div style={{ fontSize: 'var(--text-sm)' }}>{file.mimeType}</div>
          </div>
          {!isFolder && (
            <div className="form-row">
              <label className="field-label">Size</label>
              <div style={{ fontSize: 'var(--text-sm)' }}>{size}</div>
            </div>
          )}
          <div className="form-row">
            <label className="field-label"><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Modified</label>
            <div style={{ fontSize: 'var(--text-sm)' }}>
              {format(new Date(file.modifiedTime), 'MMM d, yyyy h:mm a')}
              {' '}({formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })})
            </div>
          </div>
          {file.owners?.[0] && (
            <div className="form-row">
              <label className="field-label"><User size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Owner</label>
              <div style={{ fontSize: 'var(--text-sm)' }}>{file.owners[0].displayName}</div>
            </div>
          )}
        </div>

        {/* Expiration Date */}
        <div className="form-row">
          <label className="field-label"><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Expiration Date</label>
          <input
            type="date"
            className="input-field"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)', marginTop: '0.25rem' }}>
            Set an expiration date to track document renewals
          </div>
        </div>

        {/* Linked Module */}
        {hqDoc?.linked_module && (
          <div className="form-row">
            <label className="field-label">Linked To</label>
            <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
              {hqDoc.linked_module}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={14} />
              Open in Google Drive
            </a>
          )}
          {!isFolder && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={loadRevisions}
              disabled={loadingRevisions}
            >
              <Clock size={14} />
              {loadingRevisions ? 'Loading...' : 'Version History'}
            </button>
          )}
        </div>

        {/* Version History */}
        {showRevisions && (
          <div>
            <label className="field-label" style={{ marginBottom: '0.5rem' }}>
              Version History ({revisions.length} revision{revisions.length !== 1 ? 's' : ''})
            </label>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {revisions.length === 0 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-tx-muted)' }}>
                  No revision history available
                </div>
              ) : (
                revisions.map((rev, i) => (
                  <div
                    key={rev.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.375rem 0',
                      borderBottom: i < revisions.length - 1 ? '1px solid var(--color-divider)' : undefined,
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <span>{format(new Date(rev.modifiedTime), 'MMM d, yyyy h:mm a')}</span>
                    <span style={{ color: 'var(--color-tx-muted)' }}>
                      {rev.lastModifyingUser?.displayName || 'Unknown'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-divider)' }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
      </div>
    </Modal>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
