import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import {
  checkForAppUpdate,
  dismissUpdateVersion,
  getDismissedUpdateVersion,
  installPendingUpdate,
  type AppUpdateInfo,
} from '../../services/autoUpdate';
import { isTauriEnvironment } from '../../services/tauriBridge';

const INITIAL_DELAY_MS = 4000;
const PERIODIC_MS = 15 * 60 * 1000; // re-check while app stays open

/**
 * Desktop-only: when a GitHub Release is newer than this build,
 * show a clear update popup (instead of silent install).
 */
export const AppUpdatePrompt: React.FC = () => {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (!isTauriEnvironment() || checkingRef.current || busy) return;
    checkingRef.current = true;
    try {
      const next = await checkForAppUpdate();
      if (!next) return;
      if (getDismissedUpdateVersion() === next.version) return;
      setInfo(next);
      setError(null);
      setOpen(true);
    } finally {
      checkingRef.current = false;
    }
  }, [busy]);

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    const initial = window.setTimeout(() => {
      void runCheck();
    }, INITIAL_DELAY_MS);
    const periodic = window.setInterval(() => {
      void runCheck();
    }, PERIODIC_MS);

    const onFocus = () => {
      void runCheck();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(periodic);
      window.removeEventListener('focus', onFocus);
    };
  }, [runCheck]);

  const handleLater = () => {
    if (busy) return;
    if (info?.version) dismissUpdateVersion(info.version);
    setOpen(false);
  };

  const handleUpdate = async () => {
    setBusy(true);
    setError(null);
    setPercent(0);
    try {
      await installPendingUpdate((p) => {
        if (p.percent >= 0) setPercent(p.percent);
        else if (p.status === 'finished') setPercent(100);
      });
    } catch (e: any) {
      setError(e?.message || 'Update failed. Try again or reinstall from GitHub Releases.');
      setBusy(false);
      setPercent(-1);
    }
  };

  if (!isTauriEnvironment()) return null;

  return (
    <Modal
      open={open && Boolean(info)}
      onClose={handleLater}
      busy={busy}
      title="Update available"
      subtitle="New desktop release"
      maxWidth={440}
      footer={
        <>
          <button
            type="button"
            className="btn-pill btn-pill-secondary"
            disabled={busy}
            onClick={handleLater}
          >
            Later
          </button>
          <button
            type="button"
            className="btn-pill btn-pill-primary"
            disabled={busy}
            onClick={() => void handleUpdate()}
          >
            {busy ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
            <span>{busy ? 'Updating…' : 'Update & restart'}</span>
          </button>
        </>
      }
    >
      {info && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(76, 107, 255, 0.08)',
              border: '1px solid rgba(76, 107, 255, 0.2)',
            }}
          >
            <Sparkles size={20} color="#4c6bff" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'inherit' }}>
                Version {info.version} is ready
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                You are on {info.currentVersion}. Install now so this PC stays on the latest release.
              </div>
            </div>
          </div>

          {info.body ? (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                Release notes
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: 'inherit',
                  maxHeight: 160,
                  overflow: 'auto',
                }}
              >
                {info.body}
              </pre>
            </div>
          ) : null}

          {busy && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                <span>Downloading update</span>
                <span>{percent >= 0 ? `${percent}%` : '…'}</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(148, 163, 184, 0.25)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: percent >= 0 ? `${percent}%` : '35%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #4c6bff, #65a30d)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#ef4444',
                background: 'rgba(239,68,68,0.1)',
                padding: '8px 12px',
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default AppUpdatePrompt;
