import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Clock,
  Calendar,
  ArrowUpRight,
  Download,
  Check,
  Phone,
  Mail,
  Play,
  Pause,
  RotateCcw,
  Search,
  CheckCircle2,
  Camera,
  Eye,
  Star,
  FolderKanban,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService, isAdminRecord } from '../../services/dataService';
import { FocusSessionWidget } from '../../components/timer/FocusSessionWidget';
import { downloadCsv } from '../../utils/csvExport';
import { greetUser } from '../../utils/datetime';
import type { EmployeeRecord } from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
interface ManagerDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const ManagerDashboardPage: React.FC<ManagerDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<{
    totalEmployees: number;
    online: number;
    late: number;
    idle: number;
    onBreak: number;
    tasksInProgress: number;
    tasksCompleted: number;
    teamAttendanceRate: number;
  } | null>(null);

  const [teamEmployees, setTeamEmployees] = useState<EmployeeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isFocusSessionOpen, setIsFocusSessionOpen] = useState(false);
  const [focusTargetMinutes, setFocusTargetMinutes] = useState(25);

  // Persistent Team Milestones Checklist
  const [milestones, setMilestones] = useState<
    Array<{ id: number | string; title: string; desc: string; done: boolean }>
  >(() => {
    try {
      const saved = localStorage.getItem(`stitch_manager_milestones_${user.id}`) || localStorage.getItem('stitch_manager_milestones');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      { id: 1, title: 'Team Daily Standup & Check-in', desc: 'Sync on sprint goals & workstation status', done: true },
      { id: 2, title: 'Rust Workstation Daemon Heartbeats', desc: 'WIN-DESKTOP-QUVQI4B-ok & telemetry stream active', done: true },
      { id: 3, title: 'Official Recess & Break Windows', desc: 'Coffee (11:00 AM) & Namaz (01:00 PM) calibrated', done: true },
      { id: 4, title: 'Sprint Task Review & Code Deliveries', desc: 'Inspect active branch pull requests and code review', done: false },
      { id: 5, title: 'Sprint Merits & Stars Allocation', desc: 'Allocate merit points and evaluate daily velocity', done: false },
    ];
  });

  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDesc, setNewMilestoneDesc] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(`stitch_manager_milestones_${user.id}`, JSON.stringify(milestones));
      localStorage.setItem('stitch_manager_milestones', JSON.stringify(milestones));
    } catch (e) {
      console.error(e);
    }
  }, [milestones, user.id]);

  const toggleMilestone = (id: number | string) => {
    setMilestones((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      const target = next.find((item) => item.id === id);
      dataService.logAction(
        user.name,
        'manager',
        'UPDATE_MILESTONE',
        target?.title || 'Milestone',
        `Marked as ${target?.done ? 'Completed' : 'Pending'}`
      );
      return next;
    });
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;
    const newItem = {
      id: Date.now(),
      title: newMilestoneTitle.trim(),
      desc: newMilestoneDesc.trim() || 'Sprint Team Objective',
      done: false,
    };
    setMilestones((prev) => [...prev, newItem]);
    dataService.logAction(user.name, 'manager', 'ADD_MILESTONE', newItem.title, 'Created team milestone');
    setNewMilestoneTitle('');
    setNewMilestoneDesc('');
    setIsAddingMilestone(false);
  };

  const handleDeleteMilestone = (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMilestones((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      dataService.logAction(user.name, 'manager', 'DELETE_MILESTONE', String(id), 'Removed team milestone');
      return filtered;
    });
  };

  const completedMilestonesCount = milestones.filter((m) => m.done).length;
  const milestonesCompletionPct = milestones.length > 0 ? Math.round((completedMilestonesCount / milestones.length) * 100) : 100;

  const loadData = async () => {
    try {
      const [kpiData, empData] = await Promise.all([
        dataService.getManagerKpis(user.id),
        dataService.getEmployees('manager', user.id),
      ]);
      setKpis(kpiData);
      setTeamEmployees(empData.filter((e) => !isAdminRecord(e.id, e.name, e.email)));
    } catch (err) {
      console.error('Failed to load manager dashboard:', err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [user.id]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
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

  const targetSeconds = Math.max(60, focusTargetMinutes * 60);
  const progressRatio = timerSeconds === 0 ? 0 : Math.min(1, Math.max(0, timerSeconds / targetSeconds));
  const strokeDashoffset = timerSeconds === 0 ? 264 : Math.round(264 * (1 - progressRatio));

  const filteredTeam = teamEmployees
    .filter((emp) => !isAdminRecord(emp.id, emp.name, emp.email))
    .filter((emp) => {
      const q = searchQuery.toLowerCase();
      return (
        (emp.name || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q)
      );
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* 1. Operations Header */}
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <span className="pulse-beacon" />
            <span>Team Operations Console</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            {greetUser(user.name)}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <RefreshButton onRefresh={loadData} title="Refresh dashboard" />
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              onClick={() => onNavigate('/manager/projects')}
            >
              <FolderKanban size={15} />
              <span>Projects & Folders</span>
            </button>
            <button type="button" className="btn-pill btn-pill-secondary">
              <Calendar size={15} color="var(--text-muted)" />
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </button>
            <button
              type="button"
              className="btn-pill btn-pill-primary"
              onClick={() => onNavigate('/manager/monitoring')}
            >
              <Camera size={15} />
              <span>Live Telemetry Stream</span>
            </button>
          </div>
        </div>

        {/* Header Stats */}
        <div className="frosted-card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '1rem 1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{kpis?.totalEmployees || teamEmployees.length || 4}</span>
              <span className="stat-diff-badge">Team</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Assigned Staff</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{kpis?.online || 3}</span>
              <span className="stat-diff-badge">Live</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Active Now</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{kpis?.teamAttendanceRate || 100}%</span>
              <span className="stat-diff-badge">Punctual</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Attendance Rate</span>
          </div>
        </div>
      </div>

      {/* 2. Middle Bento Telemetry Row */}
      <div className="grid-telemetry-row">
        {/* Working Progress Matrix Card */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Team Sprint Velocity</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span className="stat-numeric-lg">82%</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-secondary)' }}>▲ On Track</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-icon-circle"
              onClick={() => onNavigate('/manager/projects')}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>

          {/* Dotted Matrix */}
          <div className="matrix-grid-container" style={{ margin: '1.25rem 0' }}>
            {[
              [1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0],
              [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
              [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
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
            <span>Sprint Open</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Target Cadence</span>
            <span>Sprint Goal</span>
          </div>
        </div>

        {/* Team Distribution */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={12} />
              </div>
              <span>Active Workstations</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">80%</span>
              <span className="stat-diff-badge">In-Office</span>
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={12} />
              </div>
              <span>Tasks in Progress</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">{kpis?.tasksInProgress || 3}</span>
              <span className="status-pill active" style={{ padding: '1px 8px', fontSize: 10 }}>Live</span>
            </div>
          </div>
        </div>

        {/* Circular Progress Timer */}
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
              title={isTimerRunning ? 'Pause timer' : 'Resume timer'}
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

        {/* Task Completion Bar */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Sprint Delivery</span>
            <button
              type="button"
              className="btn-icon-circle accent"
              onClick={() => onNavigate('/manager/projects')}
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 'auto 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{milestonesCompletionPct}% Delivered</span>
              <span>{100 - milestonesCompletionPct}% Active</span>
              <span>Sprint 4</span>
            </div>
            <div style={{ width: '100%', height: 28, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', padding: 3, display: 'flex', gap: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(15, milestonesCompletionPct)}%`,
                  height: '100%',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-secondary-container, #c5e836)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'width 0.4s ease',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-secondary-container, #1a2e05)' }}>
                  {milestonesCompletionPct}%
                </span>
              </div>
              {milestonesCompletionPct < 100 && (
                <div
                  style={{
                    width: `${Math.max(15, 100 - milestonesCompletionPct)}%`,
                    height: '100%',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-primary, #4f46e5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'width 0.4s ease',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-primary, #ffffff)' }}>
                    {100 - milestonesCompletionPct}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-secondary)' }} /> Delivered ({completedMilestonesCount})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} /> Remaining ({milestones.length - completedMilestonesCount})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} /> Total ({milestones.length})
            </span>
          </div>
        </div>
      </div>

      {/* 3. Lower Split Section: Lead Spotlight & Team Roster Table */}
      <div className="grid-split-roster">
        {/* Left: Lead Spotlight */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Team Lead & Manager</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="btn-icon-circle" style={{ width: 28, height: 28 }} title="Call Team">
                <Phone size={13} />
              </button>
              <button type="button" className="btn-icon-circle" style={{ width: 28, height: 28 }} title="Email Team">
                <Mail size={13} />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.75rem 0' }}>
            <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'var(--color-secondary-container)', opacity: 0.4, filter: 'blur(20px)' }} />
            <div className="avatar-chip" style={{ width: 90, height: 90, fontSize: 28, zIndex: 10 }}>
              {user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-frosted-subdued)', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: 11, zIndex: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <span className="pulse-beacon" /> Monitoring Active Team
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Operations</span>
          </div>
        </div>

        {/* Center: Team Member Data Table */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Assigned Team Roster</h3>
              <span className="status-pill neutral" style={{ fontSize: 10 }}>{filteredTeam.length} Staff</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="stitch-search-pill" style={{ maxWidth: 200, padding: '4px 10px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-icon-circle accent"
                title="Export CSV"
                onClick={() => {
                  try {
                    downloadCsv(
                      `team-telemetry-${new Date().toISOString().slice(0, 10)}.csv`,
                      filteredTeam.map((e) => ({
                        name: e.name,
                        email: e.email,
                        status: e.status,
                        active_hours: (e.active_seconds / 3600).toFixed(2),
                        idle_hours: (e.idle_seconds / 3600).toFixed(2),
                        stars: e.stars,
                        current_task: e.current_task || '',
                        last_activity: e.last_activity_at || '',
                      }))
                    );
                  } catch (err: any) {
                    alert(err.message || 'Export failed');
                  }
                }}
              >
                <Download size={15} />
              </button>
            </div>
          </div>

          <div className="stitch-table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Hours Tracked</th>
                  <th>Performance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeam.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No team records found.
                    </td>
                  </tr>
                ) : (
                  filteredTeam.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar-chip">
                            {emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${emp.status === 'active' ? 'active' : emp.status === 'idle' ? 'idle' : 'offline'}`}>
                          {emp.status === 'active' ? 'Active' : emp.status === 'idle' ? 'Idle' : 'Offline'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {(((emp.active_seconds || 14400) / 3600)).toFixed(1)}h
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: '#f59e0b' }}>
                          <Star size={13} fill="#f59e0b" /> {emp.stars || 10}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-pill btn-pill-secondary"
                          style={{ padding: '3px 10px', fontSize: 11 }}
                          onClick={() => onNavigate('/manager/monitoring')}
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Live telemetry synced via Supabase</span>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              style={{ padding: '4px 12px', fontSize: 11 }}
              onClick={() => onNavigate('/manager/team')}
            >
              View Full Team Profile
            </button>
          </div>
        </div>

        {/* Right: Team Milestones */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="var(--color-secondary)" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Milestones</h3>
              <span className="status-pill active" style={{ fontSize: 10, padding: '1px 7px' }}>
                {completedMilestonesCount}/{milestones.length} ({milestonesCompletionPct}%)
              </span>
            </div>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              style={{ padding: '3px 9px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setIsAddingMilestone(!isAddingMilestone)}
              title="Add a new sprint milestone"
            >
              <Plus size={13} />
              <span>{isAddingMilestone ? 'Close' : 'Add Milestone'}</span>
            </button>
          </div>

          {/* Dynamic Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ width: '100%', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${milestonesCompletionPct}%`,
                  height: '100%',
                  background: milestonesCompletionPct === 100 ? 'var(--status-success, #10b981)' : 'var(--color-secondary, #c5e836)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Inline Add Milestone Form */}
          {isAddingMilestone && (
            <form
              onSubmit={handleAddMilestone}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 'var(--radius-card-sm)',
                background: 'var(--surface-frosted-subdued)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              <input
                type="text"
                placeholder="Milestone title (e.g., Code Review & PR Merges)..."
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                autoFocus
                style={{
                  background: 'transparent',
                  border: '1px solid var(--surface-border-subtle)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Description or target (e.g., Core Backend Sprint 4)..."
                value={newMilestoneDesc}
                onChange={(e) => setNewMilestoneDesc(e.target.value)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--surface-border-subtle)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => setIsAddingMilestone(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-pill btn-pill-primary"
                  style={{ padding: '3px 10px', fontSize: 11 }}
                >
                  Save Milestone
                </button>
              </div>
            </form>
          )}

          {/* Milestone List Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
            {milestones.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleMilestone(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-card-sm)',
                  background: item.done ? 'var(--surface-frosted-subdued)' : 'transparent',
                  border: '1px solid var(--surface-border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      minWidth: 18,
                      borderRadius: '50%',
                      background: item.done ? 'var(--color-primary)' : 'transparent',
                      border: item.done ? 'none' : '1.5px solid var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-on-primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {item.done && <Check size={11} strokeWidth={3} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        textDecoration: item.done ? 'line-through' : 'none',
                        opacity: item.done ? 0.65 : 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.desc}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 22, height: 22, minWidth: 22, opacity: 0.5, border: 'none', background: 'transparent' }}
                  onClick={(e) => handleDeleteMilestone(item.id, e)}
                  title="Delete milestone"
                >
                  <Trash2 size={12} color="var(--text-muted)" />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>Auto-synced with team sprint backlog</span>
            <span style={{ fontWeight: 700, color: milestonesCompletionPct === 100 ? 'var(--status-success)' : 'var(--color-secondary)' }}>
              {milestonesCompletionPct === 100 ? '100% Delivered' : `${100 - milestonesCompletionPct}% Remaining`}
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
