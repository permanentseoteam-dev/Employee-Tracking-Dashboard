import React, { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { api, isTauriEnvironment } from '../../services/tauriBridge';

type Props = {
  frameUrl: string | null;
  statusText: string;
  employeeName: string;
  deviceId?: string | null;
  deviceName?: string | null;
  activeWindow?: string | null;
  children?: React.ReactNode;
};

function normalizeDeviceToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokensOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Renders live agent frames without remount flicker.
 * On the same workstation (or localhost), hides the JPEG preview so capture
 * does not recurse into an infinite mirror of this modal.
 */
export const LiveScreenFrame: React.FC<Props> = ({
  frameUrl,
  statusText,
  employeeName,
  deviceId,
  deviceName,
  activeWindow,
  children,
}) => {
  const [stableUrl, setStableUrl] = useState<string | null>(null);
  const [sameMachine, setSameMachine] = useState(false);
  const [forceShowPreview, setForceShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const host = window.location.hostname;
      const onLoopback = host === 'localhost' || host === '127.0.0.1';
      const empTokens = [deviceId, deviceName]
        .filter(Boolean)
        .map((v) => normalizeDeviceToken(String(v)));

      let localTokens: string[] = [];
      if (isTauriEnvironment()) {
        try {
          const sys = await api.getSystemInfo();
          localTokens = [sys.device_id, sys.hostname]
            .filter(Boolean)
            .map((v) => normalizeDeviceToken(String(v)));
        } catch {
          /* ignore */
        }
      }

      const deviceMatch =
        empTokens.length > 0 &&
        localTokens.some((lt) => empTokens.some((et) => tokensOverlap(lt, et)));

      // Browser localhost almost always monitors this same PC during development.
      const likelySelfView = deviceMatch || (onLoopback && empTokens.length > 0);

      if (!cancelled) setSameMachine(likelySelfView);
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId, deviceName]);

  useEffect(() => {
    setStableUrl(null);
    setForceShowPreview(false);
  }, [deviceId, deviceName, employeeName]);

  // Prefetch next frame off-DOM; swap only after load to avoid black flashes.
  useEffect(() => {
    if (!frameUrl || (sameMachine && !forceShowPreview)) return;
    const img = new Image();
    img.onload = () => setStableUrl(frameUrl);
    img.onerror = () => {
      /* keep previous stable frame */
    };
    img.src = frameUrl;
  }, [frameUrl, sameMachine, forceShowPreview]);

  const hidePreview = sameMachine && !forceShowPreview;

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card-sm)',
        overflow: 'hidden',
        background: '#090d16',
        border: '1px solid var(--surface-border)',
        position: 'relative',
        minHeight: 380,
        maxHeight: '55vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {hidePreview ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 2rem', color: '#94a3b8', maxWidth: 440 }}>
          <Monitor size={44} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{employeeName}</div>
          <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.45, color: '#cbd5e1' }}>
            Live capture is working on this workstation. Preview is hidden here so the stream does
            not mirror this window into itself.
          </div>
          <div style={{ fontSize: 12, marginTop: 12, color: '#64748b' }}>
            Open Live Screen from another PC to see the desktop. Record still works here.
          </div>
          {statusText ? (
            <div style={{ fontSize: 11, marginTop: 14, color: '#38bdf8' }}>{statusText}</div>
          ) : null}
          <button
            type="button"
            className="btn-pill"
            style={{ marginTop: 16 }}
            onClick={() => setForceShowPreview(true)}
          >
            Show preview anyway
          </button>
        </div>
      ) : stableUrl ? (
        <img
          src={stableUrl}
          alt={activeWindow || 'Live Screen Stream'}
          style={{ width: '100%', height: '100%', maxHeight: '55vh', objectFit: 'contain' }}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <Monitor size={48} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{employeeName}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{statusText}</div>
        </div>
      )}
      {children}
    </div>
  );
};
