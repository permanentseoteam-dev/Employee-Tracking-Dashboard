import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Prevent closing while saving */
  busy?: boolean;
  maxWidth?: number | string;
  footer?: React.ReactNode;
}

/**
 * Always portals to document.body so sticky/frosted headers cannot clip the dialog.
 * High-contrast solid panel — never rely on translucent frosted cards for modals.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  busy = false,
  maxWidth = 480,
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onClick={() => !busy && onClose()}
        >
          <motion.div
            className="app-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-modal-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            style={{ maxWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-modal-header">
              <div>
                {subtitle ? <div className="app-modal-subtitle">{subtitle}</div> : null}
                <h2 id="app-modal-title" className="app-modal-title">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                aria-label="Close dialog"
                disabled={busy}
                onClick={onClose}
              >
                <X size={14} />
              </button>
            </div>
            <div className="app-modal-body">{children}</div>
            {footer ? <div className="app-modal-footer">{footer}</div> : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
