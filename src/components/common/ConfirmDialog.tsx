interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay active" onClick={onCancel}>
      <div className="modal-panel" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '1.5rem' }}>
          {title && <h3 style={{ marginBottom: '0.75rem', fontSize: 'var(--text-base)', fontWeight: 600 }}>{title}</h3>}
          <p style={{ marginBottom: '1.25rem', lineHeight: 1.5 }}>{message}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
