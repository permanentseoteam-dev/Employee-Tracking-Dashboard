import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  HardDrive,
  Shield,
  ArrowUpRight,
  Calendar,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AgentStatusDto, DbStats, SystemInfoDto } from '../types';

interface DashboardPageProps {
  status: AgentStatusDto;
  dbStats: DbStats;
  systemInfo: SystemInfoDto;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  status,
  dbStats,
  systemInfo,
  onNavigateToTab,
}) => {
  const { user } = useAuth();
  const [timerSeconds, setTimerSeconds] = useState(19800); // 05:30:00
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => setTimerSeconds((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimerDigits = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    return `${hrs}.${mins}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* 1. Header Section */}
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <span className="pulse-beacon" />
            <span>Workstation Operations</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Hello, {user.name}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn-pill btn-pill-primary"
              onClick={() => onNavigateToTab('timer')}
            >
              <Play size={15} />
              <span>Launch Task Timer</span>
            </button>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              onClick={() => onNavigateToTab('tasks')}
            >
              <CheckSquare size={15} />
              <span>View Assigned Tasks</span>
            </button>
            <button type="button" className="btn-pill btn-pill-secondary">
              <Calendar size={15} color="var(--text-muted)" />
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </button>
          </div>
        </div>

        {/* Quick Workstation Stat Card */}
        <div className="frosted-card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '1rem 1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{(timerSeconds / 3600).toFixed(1)}h</span>
              <span className="stat-diff-badge">Today</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Active Work</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">10</span>
              <span className="stat-diff-badge">⭐ High</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Stars Balance</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">0</span>
              <span className="stat-diff-badge">Punctual</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Late Flags</span>
          </div>
        </div>
      </div>

      {/* 2. Middle Bento Row */}
      <div className="grid-telemetry-row">
        {/* Working Progress Matrix */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Today's Activity Cadence</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span className="stat-numeric-lg">92%</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-secondary)' }}>Active Telemetry</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-icon-circle"
              onClick={() => onNavigateToTab('attendance')}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>

          <div className="matrix-grid-container" style={{ margin: '1.25rem 0' }}>
            {[
              [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
              [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
              [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
              [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            ].map((row, rIdx) => (
              <div key={rIdx} className="matrix-row">
                {row.map((val, cIdx) => (
                  <div key={cIdx} className={`matrix-node ${val ? 'filled' : ''}`} />
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>09:00 AM Check-in</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Standard Shift</span>
            <span>05:00 PM Check-out</span>
          </div>
        </div>

        {/* Workstation Status */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HardDrive size={12} />
              </div>
              <span>Daemon Engine</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">v{status.agent_version}</span>
              <span className="status-pill active" style={{ padding: '1px 8px', fontSize: 10 }}>Rust x64</span>
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={12} />
              </div>
              <span>Sync Outbox</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">{dbStats.pending_outbox_count}</span>
              <span className="status-pill neutral" style={{ padding: '1px 8px', fontSize: 10 }}>Pending</span>
            </div>
          </div>
        </div>

        {/* Time Tracking Circular Dial */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Work Timer</span>
            <button
              type="button"
              className="btn-icon-circle accent"
              onClick={() => onNavigateToTab('timer')}
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="timer-dial-container">
            <svg className="timer-dial-svg" viewBox="0 0 100 100">
              <circle className="timer-track" cx="50" cy="50" r="42" />
              <circle
                className="timer-progress-arc"
                cx="50"
                cy="50"
                r="42"
                strokeDashoffset={isTimerRunning ? 90 : 180}
              />
            </svg>
            <div className="timer-inner-content">
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {formatTimerDigits(timerSeconds)}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Session
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn-icon-circle"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
            >
              {isTimerRunning ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              type="button"
              className="btn-icon-circle"
              style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
              onClick={() => setIsTimerRunning(false)}
            >
              <div style={{ width: 10, height: 10, background: 'currentColor', borderRadius: 2 }} />
            </button>
            <button
              type="button"
              className="btn-icon-circle"
              onClick={() => setTimerSeconds(0)}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* Task Progress */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Daily Tasks</span>
            <button
              type="button"
              className="btn-icon-circle accent"
              onClick={() => onNavigateToTab('tasks')}
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 'auto 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>2 Completed</span>
              <span>1 In Progress</span>
              <span>1 Todo</span>
            </div>
            <div style={{ width: '100%', height: 28, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', padding: 3, display: 'flex', gap: 4, overflow: 'hidden' }}>
              <div style={{ width: '50%', height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-secondary-container)' }}>50%</span>
              </div>
              <div style={{ width: '25%', height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-primary)' }}>25%</span>
              </div>
              <div style={{ width: '25%', height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--surface-frosted-subdued)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-secondary)' }} /> Done
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} /> In Progress
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} /> Queue
            </span>
          </div>
        </div>
      </div>

      {/* 3. Lower Privacy & Architecture Card */}
      <div className="frosted-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Privacy & Transparent Telemetry</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Local Workstation ID: {systemInfo.device_id} ({systemInfo.hostname})</span>
          </div>
          <span className="status-pill active">Verified Secure</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', borderRadius: 'var(--radius-card-sm)', background: 'var(--surface-frosted-subdued)', border: '1px solid var(--surface-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
              <Shield size={16} color="var(--status-success)" />
              <span>Zero Keylogging Guarantee</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Actual keystrokes and sensitive text are never recorded. Only aggregate activity intensity and idle time are tracked.
            </p>
          </div>

          <div style={{ padding: '1rem', borderRadius: 'var(--radius-card-sm)', background: 'var(--surface-frosted-subdued)', border: '1px solid var(--surface-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
              <HardDrive size={16} color="var(--color-tertiary)" />
              <span>Offline Outbox & Idempotency</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              All activity events and captures are queued locally in SQLite and synchronized automatically when online.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
