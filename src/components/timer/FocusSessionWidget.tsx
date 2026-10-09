import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Minimize2,
  Minus,
  Plus,
  MoreHorizontal,
  Check,
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
  const [showOptions, setShowOptions] = useState(false);
  const [isDialDragging, setIsDialDragging] = useState(false);
  const dialContainerRef = useRef<HTMLDivElement>(null);

  const targetSeconds = Math.max(60, targetMinutes * 60);
  // Calculate progress ratio (0 to 1) - strictly 0 when timerSeconds is 0
  const progressRatio = timerSeconds === 0 ? 0 : Math.min(1, Math.max(0, timerSeconds / targetSeconds));

  // Remaining seconds in focus session
  const remainingSeconds = Math.max(0, targetSeconds - timerSeconds);
  const remainingMins = Math.floor(remainingSeconds / 60);
  const remainingSecsDisplay = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');

  // Elapsed time display
  const elapsedMins = Math.floor(timerSeconds / 60);
  const elapsedSecsDisplay = Math.floor(timerSeconds % 60).toString().padStart(2, '0');

  // Generate 48 tick marks for the Windows Clock circular gauge
  const TOTAL_TICKS = 48;
  const activeTicksCount = timerSeconds === 0 ? 0 : Math.round(progressRatio * TOTAL_TICKS);

  const ticks = Array.from({ length: TOTAL_TICKS }, (_, i) => {
    // 0 index is at 12 o'clock (-90 deg)
    const angleDeg = (i * (360 / TOTAL_TICKS)) - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cx = 110;
    const cy = 110;
    const rInner = 80;
    const rOuter = 95;

    const x1 = cx + rInner * Math.cos(angleRad);
    const y1 = cy + rInner * Math.sin(angleRad);
    const x2 = cx + rOuter * Math.cos(angleRad);
    const y2 = cy + rOuter * Math.sin(angleRad);

    const isActive = i < activeTicksCount;

    return { i, x1, y1, x2, y2, isActive };
  });

  const presetDurations = [15, 20, 25, 30, 45, 60];

  const handleDialPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDialDragging(true);

    const updateFromPointer = (clientX: number, clientY: number) => {
      if (!dialContainerRef.current) return;
      const rect = dialContainerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;

      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      let clockDeg = deg + 90;
      if (clockDeg < 0) clockDeg += 360;

      let newMins = Math.round((clockDeg / 360) * 60);
      if (newMins <= 0) newMins = 60;
      newMins = Math.max(5, Math.min(120, Math.round(newMins / 5) * 5));

      onTargetMinutesChange(newMins);
    };

    updateFromPointer(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      updateFromPointer(ev.clientX, ev.clientY);
    };

    const onPointerUp = () => {
      setIsDialDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
  };

  // Knob position for widget dial (radius ~87.5)
  const widgetRatio = Math.min(1, Math.max(0, targetMinutes / 60));
  const knobAngleDeg = widgetRatio * 360;
  const knobAngleRad = ((knobAngleDeg - 90) * Math.PI) / 180;
  const widgetKnobX = 110 + 87.5 * Math.cos(knobAngleRad);
  const widgetKnobY = 110 + 87.5 * Math.sin(knobAngleRad);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          drag
          dragMomentum={false}
          style={{
            position: 'fixed',
            top: 100,
            right: 36,
            width: 296,
            background: 'var(--surface-card, #ffffff)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            borderRadius: 14,
            border: '1px solid var(--surface-border, rgba(0, 0, 0, 0.12))',
            boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.15) inset',
            zIndex: 9999,
            overflow: 'visible',
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
              padding: '9px 12px',
              borderBottom: '1px solid var(--surface-border-subtle, rgba(0, 0, 0, 0.06))',
              cursor: 'grab',
              background: 'var(--surface-frosted-subdued, rgba(255, 255, 255, 0.04))',
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
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
                  fontFamily: 'Segoe UI, system-ui, sans-serif',
                }}
              >
                Focus session
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                onClick={onClose}
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
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted, #64748b)';
                }}
                title="Close Focus session"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* Clock Dial & Timer Content */}
          <div
            style={{
              padding: '1.25rem 1rem 0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              position: 'relative',
            }}
          >
            {/* Circular Ticks Meter */}
            <div
              ref={dialContainerRef}
              onPointerDown={handleDialPointerDown}
              style={{
                position: 'relative',
                width: 220,
                height: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDialDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
              title="Drag around the dial to adjust target focus duration"
            >
              <svg width="220" height="220" viewBox="0 0 220 220" style={{ overflow: 'visible' }}>
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
                      transition: isDialDragging ? 'none' : 'stroke 0.25s ease, stroke-width 0.25s ease',
                      opacity: t.isActive ? 1 : 0.35,
                    }}
                  />
                ))}

                {/* Tactile drag knob for widget */}
                <g style={{ transition: isDialDragging ? 'none' : 'all 0.25s ease' }}>
                  <circle
                    cx={widgetKnobX}
                    cy={widgetKnobY}
                    r="8"
                    fill="rgba(101, 163, 13, 0.25)"
                  />
                  <circle
                    cx={widgetKnobX}
                    cy={widgetKnobY}
                    r="5.5"
                    fill="#ffffff"
                    stroke="#65a30d"
                    strokeWidth="2.5"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))' }}
                  />
                </g>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

                  {/* Horizontal dash / status bar like Windows Clock */}
                  <div
                    style={{
                      width: 14,
                      height: 4,
                      borderRadius: 2,
                      background: isTimerRunning ? '#65a30d' : '#84cc16',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
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
                  <span>
                    {isTimerRunning
                      ? `Focusing (${elapsedMins}m ${elapsedSecsDisplay}s)`
                      : timerSeconds > 0
                      ? 'Paused'
                      : 'Ready to focus'}
                  </span>
                </div>

                {/* Target Session Stepper (when timer is zero or paused) */}
                {!isTimerRunning && (
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
                paddingBottom: '0.4rem',
                position: 'relative',
              }}
            >
              {/* Play / Pause Primary Button (Olive / Lime green circle) */}
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
                  boxShadow: '0 4px 14px rgba(101, 163, 13, 0.45)',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={isTimerRunning ? 'Pause session' : 'Start session'}
              >
                {isTimerRunning ? (
                  <Pause size={18} fill="#ffffff" />
                ) : (
                  <Play size={18} fill="#ffffff" style={{ marginLeft: 2 }} />
                )}
              </button>

              {/* More options button (...) */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowOptions(!showOptions)}
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
                  title="Session Options & Presets"
                >
                  <MoreHorizontal size={16} />
                </button>

                {/* Dropdown presets menu */}
                <AnimatePresence>
                  {showOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      style={{
                        position: 'absolute',
                        bottom: 44,
                        right: 0,
                        width: 160,
                        background: 'var(--surface-card, #ffffff)',
                        borderRadius: 10,
                        border: '1px solid var(--surface-border, rgba(0, 0, 0, 0.12))',
                        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)',
                        padding: 6,
                        zIndex: 10000,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 8px' }}>
                        Preset Durations
                      </div>
                      {presetDurations.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            onTargetMinutesChange(mins);
                            setShowOptions(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: targetMinutes === mins ? 'rgba(101, 163, 13, 0.12)' : 'transparent',
                            color: targetMinutes === mins ? '#65a30d' : 'var(--text-primary)',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            textAlign: 'left',
                          }}
                        >
                          <span>{mins} minutes</span>
                          {targetMinutes === mins && <Check size={13} />}
                        </button>
                      ))}
                      <div style={{ height: 1, background: 'var(--surface-border-subtle, rgba(0, 0, 0, 0.08))', margin: '4px 0' }} />
                      <button
                        type="button"
                        onClick={() => {
                          onResetTimer();
                          setShowOptions(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 8px',
                          background: 'transparent',
                          color: '#ef4444',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        <RotateCcw size={12} />
                        <span>Reset to 00.00</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Reset session button */}
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
                title="Reset session to 00.00"
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
