import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Minimize2,
  Minus,
  Plus,
} from 'lucide-react';

interface FocusSessionWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  timerSeconds: number;
  isTimerRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  targetMinutes: number;
  onTargetMinutesChange: (mins: number) => void;
}

export const FocusSessionWidget: React.FC<FocusSessionWidgetProps> = ({
  isOpen,
  onClose,
  timerSeconds,
  isTimerRunning,
  onToggleTimer,
  onResetTimer,
  targetMinutes,
  onTargetMinutesChange,
}) => {
  const targetSeconds = Math.max(60, targetMinutes * 60);
  // Calculate progress ratio (0 to 1)
  const progressRatio = timerSeconds === 0 ? 0 : Math.min(1, Math.max(0, timerSeconds / targetSeconds));
  
  // Remaining seconds in focus session
  const remainingSeconds = Math.max(0, targetSeconds - timerSeconds);
  const remainingMins = Math.floor(remainingSeconds / 60);
  const remainingSecsDisplay = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');

  // Generate 48 tick marks for the Windows Clock circular gauge
  const TOTAL_TICKS = 48;
  const activeTicksCount = timerSeconds === 0 ? 0 : Math.round(progressRatio * TOTAL_TICKS);

  const ticks = Array.from({ length: TOTAL_TICKS }, (_, i) => {
    // 0 index is at 12 o'clock (-90 deg)
    const angleDeg = (i * (360 / TOTAL_TICKS)) - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cx = 110;
    const cy = 110;
    const rInner = 82;
    const rOuter = 95;

    const x1 = cx + rInner * Math.cos(angleRad);
    const y1 = cy + rInner * Math.sin(angleRad);
    const x2 = cx + rOuter * Math.cos(angleRad);
    const y2 = cy + rOuter * Math.sin(angleRad);

    const isActive = i < activeTicksCount;

    return { i, x1, y1, x2, y2, isActive };
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          drag
          dragMomentum={false}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 310,
            background: 'var(--surface-card, #ffffff)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            borderRadius: 16,
            border: '1px solid var(--surface-border, rgba(0, 0, 0, 0.1))',
            boxShadow: '0 16px 40px -8px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            zIndex: 9999,
            overflow: 'hidden',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Windows Clock Focus Session Title Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--surface-border-subtle, rgba(0, 0, 0, 0.06))',
              cursor: 'grab',
              background: 'var(--surface-frosted-subdued, rgba(255, 255, 255, 0.03))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary, #64748b)',
                }}
              >
                <Minimize2 size={13} strokeWidth={2.2} />
              </div>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text-primary, #0f172a)',
                  letterSpacing: '-0.01em',
                }}
              >
                Focus session
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-icon-circle"
                style={{
                  width: 26,
                  height: 26,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted, #64748b)',
                }}
                title="Close Focus session"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Clock Dial & Timer Content */}
          <div
            style={{
              padding: '1.25rem 1rem 0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            {/* Circular Ticks Meter */}
            <div
              style={{
                position: 'relative',
                width: 220,
                height: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="220" height="220" viewBox="0 0 220 220">
                {ticks.map((t) => (
                  <line
                    key={t.i}
                    x1={t.x1}
                    y1={t.y1}
                    x2={t.x2}
                    y2={t.y2}
                    stroke={t.isActive ? '#65a30d' : 'var(--surface-border, #cbd5e1)'}
                    strokeWidth={t.isActive ? 3.5 : 2.5}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke 0.25s ease, stroke-width 0.25s ease',
                      opacity: t.isActive ? 1 : 0.35,
                    }}
                  />
                ))}
              </svg>

              {/* Center Info in Dial */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: 'var(--text-primary, #0f172a)',
                      letterSpacing: '-0.03em',
                      fontFamily: 'Segoe UI, system-ui, sans-serif',
                    }}
                  >
                    {isTimerRunning || timerSeconds > 0
                      ? `${remainingMins}:${remainingSecsDisplay}`
                      : `${targetMinutes}`}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    {isTimerRunning || timerSeconds > 0 ? '' : 'min'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                    fontSize: 11,
                    fontWeight: 600,
                    color: isTimerRunning ? '#65a30d' : 'var(--text-muted, #64748b)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isTimerRunning ? '#84cc16' : '#94a3b8',
                      display: 'inline-block',
                    }}
                  />
                  <span>{isTimerRunning ? 'In Progress' : timerSeconds > 0 ? 'Paused' : 'Ready'}</span>
                </div>

                {/* Target Session Stepper (when timer is paused/zero) */}
                {!isTimerRunning && timerSeconds === 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 8,
                      background: 'var(--surface-frosted-subdued, rgba(0, 0, 0, 0.04))',
                      padding: '2px 8px',
                      borderRadius: 20,
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 3,
                        color: 'var(--text-secondary, #475569)',
                      }}
                      onClick={() => onTargetMinutesChange(Math.max(5, targetMinutes - 5))}
                      title="Decrease duration"
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {targetMinutes}m target
                    </span>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 3,
                        color: 'var(--text-secondary, #475569)',
                      }}
                      onClick={() => onTargetMinutesChange(Math.min(120, targetMinutes + 5))}
                      title="Increase duration"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Controls Bar (Windows 11 Clock styling) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                width: '100%',
                paddingBottom: '0.5rem',
              }}
            >
              {/* Play / Pause Primary Button (Lime green circle) */}
              <button
                type="button"
                onClick={onToggleTimer}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#65a30d', // Windows olive/lime accent
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(101, 163, 13, 0.4)',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                }}
                title={isTimerRunning ? 'Pause session' : 'Start session'}
              >
                {isTimerRunning ? (
                  <Pause size={18} fill="#ffffff" />
                ) : (
                  <Play size={18} fill="#ffffff" style={{ marginLeft: 2 }} />
                )}
              </button>

              {/* Stop / Reset Button */}
              <button
                type="button"
                onClick={onResetTimer}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--surface-frosted-subdued, rgba(0, 0, 0, 0.05))',
                  color: 'var(--text-secondary, #475569)',
                  border: '1px solid var(--surface-border-subtle, rgba(0, 0, 0, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                title="Reset session to 0"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FocusSessionWidget;
