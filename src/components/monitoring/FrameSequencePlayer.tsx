import React, { useEffect, useState } from 'react';
import type { ScreenRecordingFrameManifest } from '../../types/roles';

interface Props {
  manifest: ScreenRecordingFrameManifest;
  posterUrl?: string;
  style?: React.CSSProperties;
}

/** Plays agent-captured JPEG frame sequences at the recorded fps. */
export const FrameSequencePlayer: React.FC<Props> = ({ manifest, posterUrl, style }) => {
  const urls = (manifest.frame_urls || []).filter(Boolean);
  const fps = Math.max(1, Number(manifest.fps) || 2);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setIdx(0);
    setPlaying(true);
  }, [manifest.frames?.join('|')]);

  useEffect(() => {
    if (!playing || urls.length === 0) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % urls.length);
    }, Math.round(1000 / fps));
    return () => clearInterval(t);
  }, [playing, urls.length, fps]);

  if (urls.length === 0) {
    return (
      <div style={{ ...style, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        No frames in recording
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', background: '#0a0f18', ...style }}>
      <img
        src={urls[idx] || posterUrl || urls[0]}
        alt={`Recording frame ${idx + 1}`}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 10,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          className="btn-pill btn-pill-secondary"
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <span
          style={{
            fontSize: 11,
            color: '#e2e8f0',
            background: 'rgba(0,0,0,0.65)',
            padding: '4px 8px',
            borderRadius: 999,
          }}
        >
          {idx + 1}/{urls.length} · {fps} fps
        </span>
      </div>
    </div>
  );
};
