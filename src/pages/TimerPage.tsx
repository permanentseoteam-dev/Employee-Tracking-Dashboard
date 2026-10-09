import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  Coffee,
  Moon,
  CheckCircle2,
  RotateCcw,
  Plus,
  Minus,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabaseSync } from '../services/supabaseService';
import { dataService } from '../services/dataService';
import { FocusSessionWidget } from '../components/timer/FocusSessionWidget';

interface TimerPageProps {
  activeTaskTitle: string | null;
  onActiveTaskChange: (title: string | null) => void;
}

export const TimerPage: React.FC<TimerPageProps> = ({
  activeTaskTitle,
  onActiveTaskChange,
}) => {
  const { user } = useAuth();
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(Boolean(activeTaskTitle));
  const [isDragging, setIsDragging] = useState(false);
  const [activeBreak, setActiveBreak] = useState<'general' | 'namaz' | null>(null);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<string>(() => new Date().toISOString());
  const [breakSyncMessage, setBreakSyncMessage] = useState<string | null>(null);
  const [isFocusSessionOpen, setIsFocusSessionOpen] = useState(false);

  /** Elapsed focus seconds for the popup clock (mirrors dashboard FocusSessionWidget). */
  const focusElapsedSeconds = Math.max(0, durationMinutes * 60 - remainingSeconds);

  const dialRef = useRef<HTMLDivElement>(null);

  // Ticking effect
  useEffect(() => {
    let interval: any = null;
    if (isRunning && !activeBreak && !isDragging) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else if (activeBreak) {
      interval = setInterval(() => {
        setBreakSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeBreak, isDragging]);

  const formatRemaining = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Circular drag interaction
  const handleDialPointerDown = (e: React.PointerEvent) => {
    if (activeBreak) return;
    e.preventDefault();
    setIsDragging(true);

    const updateTimeFromPointer = (clientX: number, clientY: number) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;

      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      let clockDeg = deg + 90;
      if (clockDeg < 0) clockDeg += 360;

      // Map clockDeg [0, 360) to 1..60 minutes
      let newMins = Math.round((clockDeg / 360) * 60);
      if (newMins <= 0) newMins = 60;
      newMins = Math.max(1, Math.min(60, newMins));

      setDurationMinutes(newMins);
      setRemainingSeconds(newMins * 60);
    };

    updateTimeFromPointer(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      updateTimeFromPointer(ev.clientX, ev.clientY);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleAdjustMinutes = (delta: number) => {
    const next = Math.max(1, Math.min(60, durationMinutes + delta));
    setDurationMinutes(next);
    setRemainingSeconds(next * 60);
  };

  const handleSelectPreset = (mins: number) => {
    setDurationMinutes(mins);
    setRemainingSeconds(mins * 60);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(durationMinutes * 60);
  };

  const handleStart = () => {
    if (!activeTaskTitle) {
      onActiveTaskChange('Active Engineering Session');
    }
    setSessionStartTime(new Date().toISOString());
    setIsRunning(true);
    setActiveBreak(null);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleBreak = async (type: 'general' | 'namaz') => {
    setActiveBreak(type);
    setIsRunning(false);
    const breakType = type === 'general' ? 'coffee' : 'namaz';
    const breakSlot = breakType === 'coffee' ? '11:00' : '13:00';

    try {
      const snap = await dataService.saveBreakTelemetrySnapshot({
        breakType,
        employeeId: user.id,
        employeeName: user.name,
        timeSlot: breakSlot,
      });

      setBreakSyncMessage(
        `💾 Heatmap & Keyboard State Saved to Supabase (Bucket: screenshots & Table: activity_events). State locked at ${snap.current_time_slot}.`
      );
    } catch (e) {
      console.warn('Error saving break snapshot:', e);
    }

    dataService.logAction(
      user.name,
      'employee',
      'BREAK_START',
      type.toUpperCase(),
      `Started ${type} break (Preserved telemetry snapshot in Supabase)`
    );
  };

  const handleEndBreak = async () => {
    const curBreakSecs = breakSeconds;
    setActiveBreak(null);
    setIsRunning(true);

    try {
      const resumed = await dataService.resumeBreakTelemetry({
        employeeId: user.id,
        employeeName: user.name,
        breakSeconds: curBreakSecs,
      });

      setBreakSyncMessage(
        `⚡ Resumed Work! Telemetry continuing from last state (${resumed?.current_time_slot}: Pre-break + New Activity combined).`
      );
      setTimeout(() => setBreakSyncMessage(null), 8000);
    } catch (e) {
      console.warn('Error resuming break telemetry:', e);
    }

    dataService.logAction(
      user.name,
      'employee',
      'BREAK_END',
      'WORK_RESUMED',
      'Ended break: Resumed task timer and telemetry state continuation'
    );
  };

  const handleFinish = async () => {
    const taskTitle = activeTaskTitle || 'Active Engineering Session';
    setIsRunning(false);
    setActiveBreak(null);
    onActiveTaskChange(null);

    try {
      await supabaseSync.syncTaskSession({
        task_title: taskTitle,
        employee_id: user.id,
        start_time: sessionStartTime,
        end_time: new Date().toISOString(),
        total_seconds: secondsElapsed,
        break_seconds: breakSeconds,
        status: 'completed',
      });

      dataService.logAction(
        user.name,
        'employee',
        'FINISH_TASK_SESSION',
        taskTitle,
        `Completed session of ${formatTime(secondsElapsed)} (Breaks: ${formatTime(breakSeconds)})`
      );

      alert(`Task session completed! Tracked ${formatTime(secondsElapsed)} synchronized to Supabase.`);
      setSecondsElapsed(0);
      setBreakSeconds(0);
    } catch (err: any) {
      console.warn('Could not sync task session:', err);
      alert(`Task session finished locally (${formatTime(secondsElapsed)}).`);
    }
  };

  // Progress Ratio & Dial Arc Coordinates
  const displayMinutes = isRunning ? remainingSeconds / 60 : durationMinutes;
  const progressRatio = Math.max(0, Math.min(1, displayMinutes / 60));
  // Total circumference for radius 42 is 263.89 ~ 264
  const strokeDashoffset = progressRatio === 0 ? 264 : Math.round(264 * (1 - progressRatio));

  // Knob coordinate calculation on circle perimeter (radius 42)
  const knobAngleDeg = progressRatio * 360;
  const knobAngleRad = ((knobAngleDeg - 90) * Math.PI) / 180;
  const knobX = 50 + 42 * Math.cos(knobAngleRad);
  const knobY = 50 + 42 * Math.sin(knobAngleRad);

  // Clock tick marks for a physical dial look
  const clockTicks = Array.from({ length: 60 }, (_, i) => {
    const isMajor = i % 5 === 0;
    const angleDeg = i * 6 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const r1 = isMajor ? 36 : 38;
    const r2 = 40.5;
    const x1 = 50 + r1 * Math.cos(angleRad);
    const y1 = 50 + r1 * Math.sin(angleRad);
    const x2 = 50 + r2 * Math.cos(angleRad);
    const y2 = 50 + r2 * Math.sin(angleRad);
    const isPassed = (i / 60) <= progressRatio;
    return { i, x1, y1, x2, y2, isMajor, isPassed };
  });

  const presetDurations = [15, 20, 25, 30, 45, 60];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <span className="pulse-beacon" />
            <span>Time Tracking & Focus Hub</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Precision Task Timer
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Drag the circular handle to adjust session time &bull; Auto-excludes break intervals &bull; Direct Supabase telemetry
          </p>
        </div>
      </div>

      {/* Main Frosted Dial Card */}
      <div
        className="frosted-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          gap: '1.25rem',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: 520,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span>Active Task Focus:</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>
              {activeTaskTitle || 'General Engineering Work'}
            </strong>
          </div>
          <button
            type="button"
            className="btn-icon-circle"
            style={{
              background: '#c5e836',
              color: '#1a2e05',
              border: 'none',
              boxShadow: '0 2px 8px rgba(197, 232, 54, 0.4)',
              cursor: 'pointer',
              width: 36,
              height: 36,
              flexShrink: 0,
            }}
            onClick={() => setIsFocusSessionOpen(true)}
            title="Open Windows Focus Session"
          >
            <ArrowUpRight size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Big Interactive Circular SVG Dial with Drag Handle */}
        <div
          ref={dialRef}
          onPointerDown={handleDialPointerDown}
          style={{
            position: 'relative',
            width: 270,
            height: 270,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          title="Drag the green circle handle to adjust the timer duration"
        >
          <svg
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
            viewBox="0 0 100 100"
          >
            {/* Clock face ticks */}
            {clockTicks.map((t) => (
              <line
                key={t.i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isPassed ? 'var(--color-secondary, #10b981)' : 'var(--surface-border-subtle, rgba(255,255,255,0.12))'}
                strokeWidth={t.isMajor ? 1.4 : 0.8}
                strokeLinecap="round"
                opacity={t.isPassed ? 0.9 : 0.35}
              />
            ))}

            {/* Dial Track Circle (Radius 42) */}
            <circle
              className="timer-track"
              cx="50"
              cy="50"
              r="42"
              strokeWidth="5"
              style={{
                stroke: 'var(--surface-border-subtle, rgba(255,255,255,0.15))',
                strokeDasharray: '2 3',
              }}
            />

            {/* Progress Arc (starts at 12 o'clock, clockwise) */}
            <circle
              className="timer-progress-arc"
              cx="50"
              cy="50"
              r="42"
              strokeWidth="5"
              strokeDasharray="264"
              strokeDashoffset={strokeDashoffset}
              style={{
                stroke: progressRatio === 0 ? 'transparent' : 'var(--color-secondary, #10b981)',
                transform: 'rotate(-90deg)',
                transformOrigin: '50px 50px',
                transition: isDragging ? 'none' : 'stroke-dashoffset 0.35s ease',
              }}
            />

            {/* Tactile Draggable Knob on the Ring Perimeter */}
            <g
              style={{
                transformOrigin: '50px 50px',
                transition: isDragging ? 'none' : 'all 0.35s ease',
              }}
            >
              {/* Outer Glow Halo */}
              <circle
                cx={knobX}
                cy={knobY}
                r="7.5"
                fill="rgba(16, 185, 129, 0.28)"
                style={{
                  filter: 'blur(1px)',
                }}
              />
              {/* Main Knob Ring */}
              <circle
                cx={knobX}
                cy={knobY}
                r="5"
                fill="#ffffff"
                stroke="var(--color-secondary, #10b981)"
                strokeWidth="2.5"
                style={{
                  filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.4))',
                }}
              />
              {/* Center Accent Dot */}
              <circle
                cx={knobX}
                cy={knobY}
                r="1.6"
                fill="var(--color-secondary, #10b981)"
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
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: 46,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: activeBreak ? 'var(--status-warning)' : 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatRemaining(remainingSeconds)}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: isDragging ? 'var(--color-secondary, #10b981)' : 'var(--text-muted)',
                }}
              >
                {isDragging
                  ? `Set: ${durationMinutes} min`
                  : activeBreak === 'general'
                  ? 'Coffee Break Active'
                  : activeBreak === 'namaz'
                  ? 'Namaz Break Active'
                  : isRunning
                  ? 'Active Focus Session'
                  : 'Drag Ring To Adjust'}
              </span>
            </div>

            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                marginTop: 4,
                background: 'rgba(255,255,255,0.05)',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              Total Workday: {formatTime(secondsElapsed)}
            </span>
          </div>
        </div>

        {/* Quick Stepper Adjustments */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn-icon-circle"
            style={{ width: 32, height: 32 }}
            onClick={() => handleAdjustMinutes(-5)}
            title="Deduct 5 minutes"
          >
            <Minus size={14} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 70, textAlign: 'center' }}>
            {durationMinutes} min
          </span>
          <button
            type="button"
            className="btn-icon-circle"
            style={{ width: 32, height: 32 }}
            onClick={() => handleAdjustMinutes(5)}
            title="Add 5 minutes"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="btn-icon-circle"
            style={{ width: 32, height: 32, marginLeft: 6 }}
            onClick={handleReset}
            title="Reset timer to duration start"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Preset Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {presetDurations.map((mins) => (
            <button
              key={mins}
              type="button"
              className={`btn-pill ${durationMinutes === mins ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                borderRadius: 20,
                borderColor: durationMinutes === mins ? 'var(--color-secondary)' : undefined,
              }}
              onClick={() => handleSelectPreset(mins)}
            >
              {mins}m
            </button>
          ))}
        </div>

        {/* Break Banner */}
        {activeBreak && (
          <div className="status-pill late" style={{ padding: '6px 16px', fontSize: 12 }}>
            <Coffee size={14} />
            <span>
              {activeBreak === 'general' ? 'Coffee Break (11:00 – 11:30 AM)' : 'Namaz / Prayer (01:00 – 02:00 PM)'}: {formatTime(breakSeconds)}
            </span>
          </div>
        )}

        {/* Supabase Telemetry Sync Feedback Banner */}
        {breakSyncMessage && (
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-card-sm)',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--color-primary)',
              fontSize: 12,
              fontWeight: 600,
              maxWidth: 580,
              textAlign: 'center',
            }}
          >
            {breakSyncMessage}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4 }}>
          {!isRunning && !activeBreak && (
            <button
              type="button"
              className="btn-pill btn-pill-primary"
              style={{ padding: '10px 24px', fontSize: 14 }}
              onClick={handleStart}
            >
              <Play size={16} />
              <span>Start Timer</span>
            </button>
          )}

          {isRunning && (
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              style={{ padding: '10px 24px', fontSize: 14 }}
              onClick={handlePause}
            >
              <Pause size={16} />
              <span>Pause Focus</span>
            </button>
          )}

          {activeBreak ? (
            <button
              type="button"
              className="btn-pill btn-pill-primary"
              style={{ padding: '10px 24px', fontSize: 14 }}
              onClick={handleEndBreak}
            >
              <Play size={16} />
              <span>Resume Work</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                onClick={() => handleBreak('general')}
                title="Designated Coffee Break: 11:00 AM – 11:30 AM"
              >
                <Coffee size={15} />
                <span>Coffee Break (11:00–11:30 AM)</span>
              </button>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                onClick={() => handleBreak('namaz')}
                title="Designated Namaz Break: 01:00 PM – 02:00 PM"
              >
                <Moon size={15} />
                <span>Namaz / Prayer (01:00–02:00 PM)</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="btn-pill btn-pill-primary"
            style={{ background: 'var(--status-success)', color: '#ffffff' }}
            onClick={handleFinish}
          >
            <CheckCircle2 size={16} />
            <span>Finish Task Session</span>
          </button>
        </div>
      </div>

      {/* Windows 11 Focus Session Floating Widget (same as employee dashboard) */}
      <FocusSessionWidget
        isOpen={isFocusSessionOpen}
        onClose={() => setIsFocusSessionOpen(false)}
        timerSeconds={focusElapsedSeconds}
        isTimerRunning={isRunning && !activeBreak}
        onToggleTimer={() => {
          if (isRunning) {
            handlePause();
          } else {
            handleStart();
          }
        }}
        onResetTimer={handleReset}
        targetMinutes={durationMinutes}
        onTargetMinutesChange={(mins) => {
          setDurationMinutes(mins);
          setRemainingSeconds(mins * 60);
        }}
      />
    </motion.div>
  );
};
