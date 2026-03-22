import { useState, useRef, useCallback } from 'react';
import { UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile } from '../../lib/driveApi';
import { supabase } from '../../lib/supabase';

interface Props {
  folderId: string;
  folderDbId: string | null;
  onUploadComplete: () => void;
  onClose: () => void;
}

export default function FileUpload({ folderId, folderDbId, onUploadComplete, onClose }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setFileName(file.name);
    setProgress(10);

    try {
      setProgress(30);
      const driveFile = await uploadFile(folderId, file);
      setProgress(70);

      // Create HQ document record
      await supabase.from('hq_documents').insert({
        name: driveFile.name,
        mime_type: driveFile.mimeType,
        size_bytes: driveFile.size ? parseInt(driveFile.size) : null,
        google_drive_id: driveFile.id,
        google_drive_url: driveFile.webViewLink,
        folder_id: folderDbId,
      });

      setProgress(100);
      toast.success(`Uploaded ${driveFile.name}`);
      onUploadComplete();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      setFileName('');
    }
  }, [folderId, folderDbId, onUploadComplete, onClose]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>Upload File</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud size={32} />
        <div style={{ marginTop: '0.5rem', fontWeight: 500 }}>
          {uploading ? `Uploading ${fileName}...` : 'Drop a file here or click to browse'}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', marginTop: '0.25rem' }}>
          Files are uploaded directly to Google Drive
        </div>
        <input
          ref={inputRef}
          type="file"
          onChange={handleSelect}
          style={{ display: 'none' }}
        />
      </div>

      {uploading && (
        <div className="upload-progress">
          <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
