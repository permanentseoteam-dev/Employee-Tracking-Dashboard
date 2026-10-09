import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  label?: string;
  title?: string;
  className?: string;
  /** Icon-only circle button (monitoring / tasks headers). */
  iconOnly?: boolean;
  size?: number;
}

/** Shared refresh control with busy/spin feedback and disabled-while-loading. */
export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  label = 'Refresh',
  title,
  className,
  iconOnly = false,
  size = 14,
}) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setBusy(false);
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        className={className || 'btn-icon-circle'}
        onClick={handleClick}
        disabled={busy}
        title={title || label}
        aria-label={title || label}
        aria-busy={busy}
      >
        <RefreshCw size={size} className={busy ? 'spin' : undefined} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className || 'btn-pill btn-pill-secondary'}
      onClick={handleClick}
      disabled={busy}
      title={title || label}
      aria-label={title || label}
      aria-busy={busy}
    >
      <RefreshCw size={size} className={busy ? 'spin' : undefined} />
      {label ? <span>{label}</span> : null}
    </button>
  );
};
