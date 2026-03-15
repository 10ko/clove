import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Can return a Promise; button shows loading until it resolves. */
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' for destructive actions (e.g. Stop agent) */
  variant?: 'default' | 'danger';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: Props) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      return;
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    try {
      await Promise.resolve(onConfirm());
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={overlayStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 id="confirm-modal-title" style={titleStyle}>
            {title}
          </h2>
        </div>
        <p id="confirm-modal-desc" style={messageStyle}>
          {message}
        </p>
        <div style={actionsStyle}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            style={variant === 'danger' ? confirmBtnDangerStyle : confirmBtnStyle}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 150,
  padding: '1.5rem',
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '28rem',
  background: '#1e293b',
  borderRadius: '0.5rem',
  border: '1px solid #334155',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
};

const headerStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  borderBottom: '1px solid #334155',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#e2e8f0',
};

const messageStyle: React.CSSProperties = {
  margin: 0,
  padding: '1.25rem',
  fontSize: '0.9375rem',
  lineHeight: 1.5,
  color: '#94a3b8',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  padding: '0 1.25rem 1.25rem',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  borderRadius: '0.375rem',
  border: '1px solid #334155',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
};

const confirmBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  borderRadius: '0.375rem',
  border: 'none',
  background: '#334155',
  color: '#e2e8f0',
  cursor: 'pointer',
};

const confirmBtnDangerStyle: React.CSSProperties = {
  ...confirmBtnStyle,
  background: 'rgba(239, 68, 68, 0.9)',
  color: '#fff',
};
