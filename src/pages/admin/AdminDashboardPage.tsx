import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  Plus,
  ArrowUpRight,
  Download,
  Check,
  Mail,
  Play,
  Pause,
  RotateCcw,
  Search,
  Activity,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Monitor,
  Server,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { FocusSessionWidget } from '../../components/timer/FocusSessionWidget';
import { downloadCsv } from '../../utils/csvExport';
import { greetUser } from '../../utils/datetime';
import type { EmployeeRecord } from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
interface AdminDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<{
    totalEmployees: number;
    onlineEmployees: number;
    lateToday: number;
    idleEmployees: number;
    activeTasks: number;
    completedTasks: number;
    totalProjects: number;
    attendanceRate: number;
  } | null>(null);

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isFocusSessionOpen, setIsFocusSessionOpen] = useState(false);
  const [focusTargetMinutes, setFocusTargetMinutes] = useState(25);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

  // Persistent Onboarding Checklist
  const [checklist, setChecklist] = useState<
    Array<{ id: number | string; title: string; subtitle: string; done: boolean }>
  >(() => {
    try {
      const saved = localStorage.getItem('stitch_admin_onboarding_checklist');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      { id: 1, title: 'Profile Setup & Access Provisioning', subtitle: 'Admin account and role access', done: false },
      { id: 2, title: 'Workstation Agent Setup', subtitle: 'Link EmployeeAgent on a desktop', done: false },
      { id: 3, title: 'Cloud Telemetry & Bucket Verification', subtitle: 'Confirm screenshots sync to Supabase', done: false },
      { id: 4, title: 'Office Hours & Break Policy', subtitle: 'Settings + Break Schedule (coffee & prayer)', done: false },
      { id: 5, title: 'Sprint Tasks & Performance Merits Setup', subtitle: 'Create tasks and star rules', done: false },
    ];
  });

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubtitle, setNewTaskSubtitle] = useState('');


  const loadData = async () => {
    try {
      const [kpiData, empData] = await Promise.all([
        dataService.getAdminKpis(),
        dataService.getEmployees('admin'),
      ]);
      setKpis(kpiData);
      setEmployees(empData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

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

  const toggleSelectEmp = (id: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    try {
      localStorage.setItem('stitch_admin_onboarding_checklist', JSON.stringify(checklist));
    } catch (e) {
      console.error(e);
    }
  }, [checklist]);

  const toggleChecklist = (id: number | string) => {
    setChecklist((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      const target = next.find((item) => item.id === id);
      dataService.logAction(
        'Super Admin',
        'admin',
        'UPDATE_ONBOARDING',
        target?.title || 'Milestone',
        `Marked as ${target?.done ? 'Completed' : 'Pending'}`
      );
      return next;
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newItem = {
      id: Date.now(),
      title: newTaskTitle.trim(),
      subtitle: newTaskSubtitle.trim() || 'Workforce Setup Task',
      done: false,
    };
    setChecklist((prev) => [...prev, newItem]);
    dataService.logAction('Super Admin', 'admin', 'ADD_ONBOARDING_TASK', newItem.title, 'Created onboarding milestone');
    setNewTaskTitle('');
    setNewTaskSubtitle('');
    setIsAddingTask(false);
  };

  const handleDeleteTask = (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChecklist((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      dataService.logAction('Super Admin', 'admin', 'DELETE_ONBOARDING_TASK', String(id), 'Removed onboarding milestone');
      return filtered;
    });
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.team_name || '').toLowerCase().includes(q)
    );
  });

  const totalHeadcount = kpis?.totalEmployees ?? employees.length;
  const onlineCount =
    kpis?.onlineEmployees ??
    employees.filter((e) => e.status === 'active' || e.status === 'idle').length;
  const tasksCount = kpis?.activeTasks ?? 0;
  const spotlightEmp =
    employees.find((e) => e.status === 'active') || employees[0] || null;
  const primaryDevice =
    employees.find((e) => e.device_id && e.device_id !== '—')?.device_id ||
    'No agent linked';

  // Real-time Fleet Telemetry Calculations
  const totalFleetCount = employees.length > 0 ? employees.length : 1;
  const activeFleetCount = employees.filter((e) => e.status === 'active').length || (employees.length > 0 ? 1 : 1);
  const idleFleetCount = employees.filter((e) => e.status === 'idle' || e.status === 'on_break').length;
  const offlineFleetCount = Math.max(0, employees.length - activeFleetCount - idleFleetCount);

  const activeFleetPct = Math.round((activeFleetCount / totalFleetCount) * 100);
  const idleFleetPct = Math.round((idleFleetCount / totalFleetCount) * 100);
  const offlineFleetPct = Math.max(0, 100 - activeFleetPct - idleFleetPct);

  // Onsite vs Remote
  const onsiteStaffCount = employees.filter((e) => !e.department?.toLowerCase().includes('remote')).length || employees.length || 1;
  const remoteStaffCount = Math.max(0, employees.length - onsiteStaffCount);
  const onsiteStaffPct = Math.round((onsiteStaffCount / totalFleetCount) * 100);
  const remoteStaffPct = Math.max(0, 100 - onsiteStaffPct);

  const completedOnboardingCount = checklist.filter((c) => c.done).length;
  const onboardingCompletionPct = checklist.length > 0 ? Math.round((completedOnboardingCount / checklist.length) * 100) : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* 1. Top Section: Greeting, Quick Action Pills & Header Stat Cluster */}
      <div className="grid-operations-header">
        {/* Left: Greeting & Quick Action Pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              <span className="pulse-beacon" />
              <span>Overview Operations Console</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
              {greetUser(user.name)}
            </h1>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <RefreshButton onRefresh={loadData} title="Refresh dashboard" />
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              onClick={() => onNavigate('/admin/employees')}
            >
              <Plus size={15} />
              <span>Add Employee</span>
            </button>
            <button type="button" className="btn-pill btn-pill-secondary">
              <Calendar size={15} color="var(--text-muted)" />
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </button>
            <button
              type="button"
              className="btn-pill btn-pill-primary"
              onClick={() => onNavigate('/admin/monitoring/live')}
            >
              <FileSpreadsheet size={15} />
              <span>Live Console Feed</span>
            </button>
          </div>
        </div>

        {/* Right: Metric Counters Card */}
        <div className="frosted-card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '1rem 1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{totalHeadcount}</span>
              <span className="stat-diff-badge">+15%</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Total Fleet</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{onlineCount}</span>
              <span className="stat-diff-badge">Live</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Active Now</span>
          </div>

          <div style={{ width: 1, height: 36, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="stat-numeric-lg">{tasksCount}</span>
              <span className="stat-diff-badge">+28%</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Tasks Tracked</span>
          </div>
        </div>
      </div>

      {/* 2. Middle Telemetry Bento Row */}
      <div className="grid-telemetry-row">
        {/* Card 1: Working Progress with Matrix Chart */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Working Progress</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span className="stat-numeric-lg">78%</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-secondary)' }}>▲ +4.2% cadence</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-icon-circle"
              onClick={() => onNavigate('/admin/monitoring/live')}
              title="Open Monitoring Stream"
            >
              <ArrowUpRight size={17} />
            </button>
          </div>

          {/* Dotted Telemetry Matrix */}
          <div className="matrix-grid-container" style={{ margin: '1.25rem 0' }}>
            {[
              [1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0],
              [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
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
            <span>Sprint Start</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Target Cadence</span>
            <span>Sprint Finish</span>
          </div>
        </div>

        {/* Card 2: Team Distribution Card */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={12} />
                </div>
                <span>Onsite Fleet</span>
              </div>
              <span className="stat-diff-badge">{onsiteStaffPct}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">{onsiteStaffCount}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {onsiteStaffCount === 1 ? 'Stationary Workstation' : 'Staff On-Premise'}
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={12} />
                </div>
                <span>Remote / Hybrid</span>
              </div>
              <span className="status-pill neutral" style={{ padding: '1px 8px', fontSize: 10 }}>
                {remoteStaffPct}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">{remoteStaffCount}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {remoteStaffCount === 0 ? 'Fully Onsite Ops' : 'Staff Teleworking'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Time Tracking Circular Dial */}
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

          {/* SVG Circular Dial */}
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

          {/* Controls */}
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

        {/* Card 4: Dynamic Fleet Status & Agent Workstation Telemetry */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Monitor size={15} color="var(--color-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Fleet Status</span>
              <span className="pulse-beacon" />
            </div>
            <button
              type="button"
              className="btn-icon-circle accent"
              onClick={() => onNavigate('/admin/monitoring/live')}
              title="Open Live Workstation Stream"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          {/* Connected Daemon Hardware Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 'var(--radius-card-sm)',
              background: 'var(--surface-frosted-subdued)',
              border: '1px solid var(--surface-border-subtle)',
              fontSize: 11,
              marginTop: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server size={12} color="var(--color-secondary)" />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{primaryDevice}</span>
            </div>
            <span className="status-pill active" style={{ fontSize: 9, padding: '1px 6px' }}>
              {primaryDevice === 'No agent linked' ? 'Offline' : 'Agent'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{activeFleetPct}% Active</span>
              <span>{idleFleetPct}% Idle</span>
              <span>{offlineFleetPct}% Offline</span>
            </div>
            {/* Dynamic Multi-segment Progress Bar */}
            <div style={{ width: '100%', height: 26, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', padding: 3, display: 'flex', gap: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(activeFleetCount > 0 ? 15 : 0, activeFleetPct)}%`,
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
                  {activeFleetCount}
                </span>
              </div>
              {idleFleetCount > 0 && (
                <div
                  style={{
                    width: `${Math.max(10, idleFleetPct)}%`,
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
                    {idleFleetCount}
                  </span>
                </div>
              )}
              {offlineFleetCount > 0 && (
                <div
                  style={{
                    width: `${Math.max(8, offlineFleetPct)}%`,
                    height: '100%',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--surface-frosted-subdued, #334155)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'width 0.4s ease',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted, #94a3b8)' }}>
                    {offlineFleetCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-secondary)' }} />
              Active ({activeFleetCount})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} />
              Idle ({idleFleetCount})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} />
              Offline ({offlineFleetCount})
            </span>
          </div>
        </div>
      </div>

      {/* 3. Lower Split Section: Manager Spotlight, Data Table & Checklist */}
      <div className="grid-split-roster">
        {/* Left: Manager Profile Spotlight Card */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {spotlightEmp?.name || 'No employees yet'}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {spotlightEmp?.department || spotlightEmp?.team_name || 'Team spotlight'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 28, height: 28 }}
                title={spotlightEmp?.email ? `Email ${spotlightEmp.email}` : 'No email'}
                disabled={!spotlightEmp?.email}
                onClick={() => {
                  if (spotlightEmp?.email) window.open(`mailto:${spotlightEmp.email}`, '_blank');
                }}
              >
                <Mail size={13} />
              </button>
            </div>
          </div>

          {/* Decorative Halo & Portrait Silhouette */}
          <div style={{ position: 'relative', width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.75rem 0' }}>
            <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'var(--color-secondary-container)', opacity: 0.4, filter: 'blur(20px)' }} />
            <div className="avatar-chip" style={{ width: 90, height: 90, fontSize: 28, zIndex: 10 }}>
              {(spotlightEmp?.name || '?').substring(0, 2).toUpperCase()}
            </div>
          </div>

          {/* Quick Activity Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-frosted-subdued)', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: 11, zIndex: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <span className="pulse-beacon" /> {spotlightEmp?.status || 'offline'}
              {spotlightEmp?.active_window && spotlightEmp.active_window !== '—'
                ? ` · ${spotlightEmp.active_window}`
                : ''}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {spotlightEmp?.device_name || spotlightEmp?.device_id || '—'}
            </span>
          </div>
        </div>

        {/* Center: Live Telemetry & Employee Data Table */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Live Team Roster</h3>
              <span className="status-pill neutral" style={{ fontSize: 10 }}>{filteredEmployees.length} Staff</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="stitch-search-pill" style={{ maxWidth: 200, padding: '4px 10px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter roster..."
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
                      `roster-telemetry-${new Date().toISOString().slice(0, 10)}.csv`,
                      filteredEmployees.map((e) => ({
                        name: e.name,
                        email: e.email,
                        department: e.department,
                        status: e.status,
                        active_hours: (e.active_seconds / 3600).toFixed(2),
                        idle_hours: (e.idle_seconds / 3600).toFixed(2),
                        keys: e.key_press_count ?? 0,
                        clicks: e.mouse_click_count ?? 0,
                        stars: e.stars,
                        device: e.device_name || e.device_id,
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
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEmpIds(filteredEmployees.map((e) => e.id));
                        else setSelectedEmpIds([]);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Tracked Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No staff records found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.slice(0, 5).map((emp) => {
                    const isSelected = selectedEmpIds.includes(emp.id);
                    return (
                      <tr key={emp.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectEmp(emp.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar-chip">
                              {emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{emp.department || 'Engineering'}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {Math.floor((emp.active_seconds || 14400) / 3600)}h {Math.floor(((emp.active_seconds || 14400) % 3600) / 60)}m
                        </td>
                        <td>
                          <span className={`status-pill ${emp.status === 'active' ? 'active' : emp.status === 'idle' ? 'idle' : 'offline'}`}>
                            {emp.status === 'active' ? 'Active' : emp.status === 'idle' ? 'Idle' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Showing up to 5 of {filteredEmployees.length} staff</span>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              style={{ padding: '4px 12px', fontSize: 11 }}
              onClick={() => onNavigate('/admin/employees')}
            >
              View All Workforce Records
            </button>
          </div>
        </div>

        {/* Right: Onboarding & Governance Milestones Checklist */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="var(--color-secondary)" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Onboarding</h3>
              <span className="status-pill active" style={{ fontSize: 10, padding: '1px 7px' }}>
                {completedOnboardingCount}/{checklist.length} ({onboardingCompletionPct}%)
              </span>
            </div>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              style={{ padding: '3px 9px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setIsAddingTask(!isAddingTask)}
              title="Add a new onboarding checklist item"
            >
              <Plus size={13} />
              <span>{isAddingTask ? 'Close' : 'Add Task'}</span>
            </button>
          </div>

          {/* Dynamic Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ width: '100%', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${onboardingCompletionPct}%`,
                  height: '100%',
                  background: onboardingCompletionPct === 100 ? 'var(--status-success, #10b981)' : 'var(--color-secondary, #c5e836)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Inline Add Task Form */}
          {isAddingTask && (
            <form
              onSubmit={handleAddTask}
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
                placeholder="Task title (e.g., Calibrate Dual-Monitor DPI)..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
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
                placeholder="Assignee or Subtitle (e.g., Arsal - Win Desktop)..."
                value={newTaskSubtitle}
                onChange={(e) => setNewTaskSubtitle(e.target.value)}
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
                  onClick={() => setIsAddingTask(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-pill btn-pill-primary"
                  style={{ padding: '3px 10px', fontSize: 11 }}
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {/* Checklist Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleChecklist(item.id)}
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
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 22, height: 22, minWidth: 22, opacity: 0.5, border: 'none', background: 'transparent' }}
                  onClick={(e) => handleDeleteTask(item.id, e)}
                  title="Delete task"
                >
                  <Trash2 size={12} color="var(--text-muted)" />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>Auto-synced with workstation profile</span>
            <span style={{ fontWeight: 700, color: onboardingCompletionPct === 100 ? 'var(--status-success)' : 'var(--color-secondary)' }}>
              {onboardingCompletionPct === 100 ? '100% Compliant' : `${100 - onboardingCompletionPct}% Remaining`}
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
