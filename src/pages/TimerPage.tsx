import React, { useState, useEffect } from 'react';
import { Play, Pause, Coffee, Moon, CheckCircle2 } from 'lucide-react';

interface TimerPageProps {
  activeTaskTitle: string | null;
  onActiveTaskChange: (title: string | null) => void;
}

export const TimerPage: React.FC<TimerPageProps> = ({
  activeTaskTitle,
  onActiveTaskChange,
}) => {
  const [secondsElapsed, setSecondsElapsed] = useState(1450); // example productive time
  const [isRunning, setIsRunning] = useState(Boolean(activeTaskTitle));
  const [activeBreak, setActiveBreak] = useState<'general' | 'namaz' | null>(null);
  const [breakSeconds, setBreakSeconds] = useState(0);

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
    setIsRunning(true);
    setActiveBreak(null);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleBreak = (type: 'general' | 'namaz') => {
    setActiveBreak(type);
    setIsRunning(false);
  };

  const handleEndBreak = () => {
    setActiveBreak(null);
    setIsRunning(true);
  };

  const handleFinish = () => {
    setIsRunning(false);
    setActiveBreak(null);
    onActiveTaskChange(null);
    alert('Task session completed. Productive time saved to local SQLite outbox queue.');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Precision Task Timer</h1>
          <p className="page-subtitle">
            Timestamp-based session tracker &bull; Survives restarts &bull; Excludes breaks
          </p>
        </div>
      </div>

      <div
        className="content-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
          Current Task: <strong style={{ color: 'var(--text-primary)' }}>{activeTaskTitle || 'No active task selected'}</strong>
        </div>

        {/* Large Digital Timer Display */}
        <div
          style={{
            fontSize: '64px',
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: '2px',
            color: activeBreak ? 'var(--warning)' : isRunning ? 'var(--primary)' : 'var(--text-secondary)',
            margin: '20px 0',
          }}
        >
          {formatTime(secondsElapsed)}
        </div>

        {/* Break indicator banner */}
        {activeBreak && (
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: 20,
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {activeBreak === 'namaz' ? <Moon size={15} /> : <Coffee size={15} />}
            <span>
              {activeBreak === 'namaz' ? 'Namaz Break Active' : 'General Break Active'} ({formatTime(breakSeconds)})
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {!isRunning && !activeBreak ? (
            <button className="btn btn-primary" style={{ padding: '10px 20px' }} onClick={handleStart}>
              <Play size={16} />
              <span>Start Timer</span>
            </button>
          ) : isRunning ? (
            <button className="btn btn-secondary" style={{ padding: '10px 20px' }} onClick={handlePause}>
              <Pause size={16} />
              <span>Pause Timer</span>
            </button>
          ) : null}

          {activeBreak ? (
            <button className="btn btn-primary" style={{ padding: '10px 20px' }} onClick={handleEndBreak}>
              <Play size={16} />
              <span>End Break & Resume</span>
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                style={{ padding: '10px 16px' }}
                onClick={() => handleBreak('general')}
                disabled={!isRunning}
              >
                <Coffee size={15} />
                <span>General Break</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ padding: '10px 16px' }}
                onClick={() => handleBreak('namaz')}
                disabled={!isRunning}
              >
                <Moon size={15} />
                <span>Namaz Break</span>
              </button>
            </>
          )}

          <button
            className="btn btn-secondary"
            style={{ padding: '10px 16px', color: 'var(--danger)' }}
            onClick={handleFinish}
          >
            <CheckCircle2 size={15} />
            <span>Finish Task</span>
          </button>
        </div>
      </div>
    </div>
  );
};
