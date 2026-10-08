import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Coffee, Moon, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabaseSync } from '../services/supabaseService';
import { dataService } from '../services/dataService';

interface TimerPageProps {
  activeTaskTitle: string | null;
  onActiveTaskChange: (title: string | null) => void;
}

export const TimerPage: React.FC<TimerPageProps> = ({
  activeTaskTitle,
  onActiveTaskChange,
}) => {
  const { user } = useAuth();
  const [secondsElapsed, setSecondsElapsed] = useState(20700); // 05:45:00
  const [isRunning, setIsRunning] = useState(Boolean(activeTaskTitle));
  const [activeBreak, setActiveBreak] = useState<'general' | 'namaz' | null>(null);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    let interval: any = null;
    if (isRunning && !activeBreak) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else if (activeBreak) {
      interval = setInterval(() => {
        setBreakSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeBreak]);

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const handleBreak = (type: 'general' | 'namaz') => {
    setActiveBreak(type);
    setIsRunning(false);
    dataService.logAction(
      user.name,
      'employee',
      'BREAK_START',
      type.toUpperCase(),
      `Started ${type} break`
    );
  };

  const handleEndBreak = () => {
    setActiveBreak(null);
    setIsRunning(true);
    dataService.logAction(
      user.name,
      'employee',
      'BREAK_END',
      'WORK_RESUMED',
      'Ended break and resumed task timer'
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
            Timestamp-based session tracker &bull; Auto-excludes break intervals &bull; Direct Supabase telemetry
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
          padding: '3rem 2rem',
          textAlign: 'center',
          gap: '1.5rem',
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Active Task Focus: <strong style={{ color: 'var(--text-primary)', fontSize: 16 }}>{activeTaskTitle || 'General Engineering Work'}</strong>
        </div>

        {/* Big Circular SVG Dial */}
        <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
            <circle className="timer-track" cx="50" cy="50" r="42" strokeWidth="4" />
            <circle
              className="timer-progress-arc"
              cx="50"
              cy="50"
              r="42"
              strokeWidth="4"
              strokeDashoffset={isRunning ? 70 : 180}
            />
          </svg>

          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', color: activeBreak ? 'var(--status-warning)' : 'var(--text-primary)' }}>
              {formatTime(secondsElapsed)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              {activeBreak ? `${activeBreak} break active` : isRunning ? 'Active Focus Session' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Break Banner */}
        {activeBreak && (
          <div className="status-pill late" style={{ padding: '6px 16px', fontSize: 12 }}>
            <Coffee size={14} />
            <span>Break Duration: {formatTime(breakSeconds)}</span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
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
              >
                <Coffee size={15} />
                <span>Coffee Break</span>
              </button>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                onClick={() => handleBreak('namaz')}
              >
                <Moon size={15} />
                <span>Namaz / Prayer</span>
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
    </motion.div>
  );
};
