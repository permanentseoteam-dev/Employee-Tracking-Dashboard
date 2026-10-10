import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  HardDrive,
  ArrowUpRight,
  Calendar,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FocusSessionWidget } from '../components/timer/FocusSessionWidget';
import { greetUser } from '../utils/datetime';
import { dataService } from '../services/dataService';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { useOfficeHours } from '../hooks/useOfficeHours';
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
  onNavigateToTab,
}) => {
  const { user } = useAuth();
  const {
    isWithinOfficeHours,
    statusLabel: officeStatusLabel,
    workStartFormatted,
    workEndFormatted,
  } = useOfficeHours();
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isFocusSessionOpen, setIsFocusSessionOpen] = useState(false);
  const [focusTargetMinutes, setFocusTargetMinutes] = useState(25);

  const [todayDbHours, setTodayDbHours] = useState(0);
  const [todayStars, setTodayStars] = useState(0);
  const [todayLateFlags, setTodayLateFlags] = useState(0);
  const [todayCheckIn, setTodayCheckIn] = useState('--');
  const [tasksSummary, setTasksSummary] = useState({ completed: 0, inProgress: 0, todo: 0 });

  const loadEmployeeData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [attList, taskList, empList] = await Promise.all([
        dataService.getAttendance('employee', undefined, user.id),
        dataService.getTasks('employee', user.id),
        dataService.getEmployees('employee', undefined, user.id),
      ]);
      const att = attList[0];
      if (att) {
        setTodayDbHours(att.active_hours || 0);
        setTodayLateFlags(att.late_minutes > 0 ? 1 : 0);
        setTodayCheckIn(att.first_activity_at || '--');
      }
      if (empList && empList[0]) {
        setTodayStars(empList[0].stars || 0);
      }
      if (taskList) {
        const completed = taskList.filter((t: any) => t.status === 'completed').length;
        const inProg = taskList.filter((t: any) => t.status === 'in_progress').length;
        const todo = taskList.filter((t: any) => t.status === 'todo' || t.status === 'pending').length;
        setTasksSummary({ completed, inProgress: inProg, todo });
      }
    } catch (e) {
      console.error('Failed to load employee dashboard stats:', e);
    }
  }, [user?.id]);

  useAppRefresh(loadEmployeeData);

  useEffect(() => {
    loadEmployeeData();
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'employee_presence' || payload.table === 'attendance_records' || payload.table === 'tasks') {
        loadEmployeeData();
      }
    });
    return () => unsubscribe();
  }, [loadEmployeeData]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => setTimerSeconds((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimerDigits = (totalSecs: number) => {
    if (totalSecs >= 3600) {
      const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
      const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
      return `${hrs}.${mins}`;
    }
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}.${secs}`;
  };

  const totalActiveHoursNum = Number((todayDbHours + timerSeconds / 3600).toFixed(1));
  const cadencePct = totalActiveHoursNum > 0 ? Math.min(100, Math.round((totalActiveHoursNum / 8) * 100)) : 0;
  const filledDotsCount = Math.round((cadencePct / 100) * 48);

  const targetSeconds = Math.max(60, focusTargetMinutes * 60);
  const progressRatio = timerSeconds === 0 ? 0 : Math.min(1, Math.max(0, timerSeconds / targetSeconds));
  const strokeDashoffset = timerSeconds === 0 ? 264 : Math.round(264 * (1 - progressRatio));

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
            <span style={{ opacity: 0.4 }}>•</span>
            <span style={{ color: isWithinOfficeHours ? 'var(--status-success)' : 'var(--text-muted)' }}>
              {officeStatusLabel} ({workStartFormatted} – {workEndFormatted})
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            {greetUser(user.name)}
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
              onClick={() => onNavigateToTab('projects')}
            >
              <CheckSquare size={15} />
              <span>Projects Workspace</span>
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
              <span className="stat-numeric-lg">{totalActiveHoursNum}h</span>
              <span className="stat-diff-badge">Today</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Active Work</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{todayStars}</span>
              <span className="stat-diff-badge">{todayStars > 5 ? '⭐ High' : todayStars > 0 ? '⭐ Active' : 'Standard'}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Stars Balance</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{todayLateFlags}</span>
              <span className="stat-diff-badge">{todayLateFlags === 0 ? 'Punctual' : 'Flagged'}</span>
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
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Today&apos;s Activity Cadence</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span className="stat-numeric-lg">{cadencePct}%</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: totalActiveHoursNum > 0 ? 'var(--color-secondary)' : 'var(--text-muted)' }}>
                  {totalActiveHoursNum > 0 ? 'Active Telemetry' : 'Standby / Pending'}
                </span>
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
            {[0, 1, 2, 3].map((rIdx) => (
              <div key={rIdx} className="matrix-row">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((cIdx) => {
                  const nodeIndex = rIdx * 12 + cIdx;
                  const isNodeFilled = nodeIndex < filledDotsCount;
                  return (
                    <div key={cIdx} className={`matrix-node ${isNodeFilled ? 'filled' : ''}`} />
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>{todayCheckIn !== '--' ? `${todayCheckIn} Check-in` : `${workStartFormatted} Shift Start`}</span>
            <span style={{ fontWeight: 600, color: isWithinOfficeHours ? 'var(--status-success)' : 'var(--text-muted)' }}>
              {officeStatusLabel}
            </span>
            <span>{workEndFormatted} Shift End</span>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Time Tracking</span>
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
              }}
              onClick={() => setIsFocusSessionOpen(true)}
              title="Open Windows Focus Session"
            >
              <ArrowUpRight size={18} strokeWidth={2.4} />
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
                strokeDashoffset={strokeDashoffset}
                style={{
                  stroke: timerSeconds === 0 ? 'transparent' : 'var(--color-secondary, #566500)',
                  transition: 'stroke-dashoffset 0.8s ease',
                }}
              />
            </svg>
            <div className="timer-inner-content">
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {formatTimerDigits(timerSeconds)}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                WORK TIME
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn-icon-circle"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              title={isTimerRunning ? 'Pause timer' : 'Start timer'}
            >
              {isTimerRunning ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              type="button"
              className="btn-icon-circle"
              style={{ background: '#0f172a', color: '#ffffff', border: 'none' }}
              onClick={() => setIsTimerRunning(false)}
              title="Stop timer"
            >
              <div style={{ width: 10, height: 10, background: 'currentColor', borderRadius: 2 }} />
            </button>
            <button
              type="button"
              className="btn-icon-circle"
              onClick={() => {
                setTimerSeconds(0);
                setIsTimerRunning(false);
              }}
              title="Reset timer to 00.00"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* Task Progress */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Daily Tasks</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 'auto 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{tasksSummary.completed} Completed</span>
              <span>{tasksSummary.inProgress} In Progress</span>
              <span>{tasksSummary.todo} Todo</span>
            </div>
            {(() => {
              const totalTasks = tasksSummary.completed + tasksSummary.inProgress + tasksSummary.todo;
              if (totalTasks === 0) {
                return (
                  <div style={{ width: '100%', height: 28, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>No tasks queued for today</span>
                  </div>
                );
              }
              const donePct = Math.round((tasksSummary.completed / totalTasks) * 100);
              const inProgPct = Math.round((tasksSummary.inProgress / totalTasks) * 100);
              const todoPct = Math.max(0, 100 - donePct - inProgPct);
              return (
                <div style={{ width: '100%', height: 28, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', padding: 3, display: 'flex', gap: 4, overflow: 'hidden' }}>
                  {donePct > 0 && (
                    <div style={{ width: `${donePct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-secondary-container)' }}>{donePct}%</span>
                    </div>
                  )}
                  {inProgPct > 0 && (
                    <div style={{ width: `${inProgPct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-primary)' }}>{inProgPct}%</span>
                    </div>
                  )}
                  {todoPct > 0 && (
                    <div style={{ width: `${todoPct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--surface-frosted-subdued)' }} />
                  )}
                </div>
              );
            })()}
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

      {/* Windows 11 Focus Session Floating Widget */}
      <FocusSessionWidget
        isOpen={isFocusSessionOpen}
        onClose={() => setIsFocusSessionOpen(false)}
        timerSeconds={timerSeconds}
        isTimerRunning={isTimerRunning}
        onToggleTimer={() => setIsTimerRunning(!isTimerRunning)}
        onResetTimer={() => {
          setTimerSeconds(0);
          setIsTimerRunning(false);
        }}
        targetMinutes={focusTargetMinutes}
        onTargetMinutesChange={setFocusTargetMinutes}
      />
    </motion.div>
  );
};
