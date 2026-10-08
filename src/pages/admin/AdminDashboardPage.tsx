import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  Plus,
  ArrowUpRight,
  Download,
  Check,
  Phone,
  Mail,
  Play,
  Pause,
  RotateCcw,
  Search,
  Activity,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { FocusSessionWidget } from '../../components/timer/FocusSessionWidget';
import type { EmployeeRecord } from '../../types/roles';

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

  // Checklist items
  const [checklist, setChecklist] = useState([
    { id: 1, title: 'Profile Setup', subtitle: 'Onsite Team', done: true },
    { id: 2, title: 'Document Verification', subtitle: 'Legal & Compliance', done: true },
    { id: 3, title: 'Workstation Agent Sync', subtitle: 'Windows Rust Daemon', done: true },
    { id: 4, title: 'Sprint Review Milestone', subtitle: 'Engineering & Product', done: false },
  ]);

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

  const toggleChecklist = (id: number) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.team_name || '').toLowerCase().includes(q)
    );
  });

  const totalHeadcount = kpis?.totalEmployees || (employees.length > 0 ? employees.length : 12);
  const onlineCount = kpis?.onlineEmployees || (employees.filter((e) => e.status === 'active' || e.status === 'idle').length || 8);
  const tasksCount = kpis?.activeTasks || 24;

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
              Good Morning {user.name}
            </h1>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={12} />
              </div>
              <span>Onsite Fleet</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">86%</span>
              <span className="stat-diff-badge">12 Staff</span>
            </div>
          </div>

          <div style={{ width: '100%', height: 1, background: 'var(--surface-border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-frosted-subdued)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={12} />
              </div>
              <span>Remote Fleet</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="stat-numeric-md">14%</span>
              <span className="status-pill neutral" style={{ padding: '1px 8px', fontSize: 10 }}>2 Staff</span>
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

        {/* Card 4: Onboarding & Fleet Multi-segmented Progress */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Fleet Status</span>
            <button
              type="button"
              className="btn-icon-circle accent"
              onClick={() => onNavigate('/admin/employees')}
              title="View All Employees"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 'auto 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>60% Onsite</span>
              <span>30% Hybrid</span>
              <span>10% Remote</span>
            </div>
            <div style={{ width: '100%', height: 28, borderRadius: 'var(--radius-pill)', background: 'var(--surface-border-subtle)', padding: 3, display: 'flex', gap: 4, overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-secondary-container)' }}>60%</span>
              </div>
              <div style={{ width: '30%', height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-on-primary)' }}>30%</span>
              </div>
              <div style={{ width: '10%', height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--surface-frosted-subdued)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-secondary)' }} /> Verified
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} /> Active
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} /> Queued
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
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Alex Vance</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Operations & Engineering Lead</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="btn-icon-circle" style={{ width: 28, height: 28 }} title="Call Manager">
                <Phone size={13} />
              </button>
              <button type="button" className="btn-icon-circle" style={{ width: 28, height: 28 }} title="Email Manager">
                <Mail size={13} />
              </button>
            </div>
          </div>

          {/* Decorative Halo & Portrait Silhouette */}
          <div style={{ position: 'relative', width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.75rem 0' }}>
            <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'var(--color-secondary-container)', opacity: 0.4, filter: 'blur(20px)' }} />
            <div className="avatar-chip" style={{ width: 90, height: 90, fontSize: 28, zIndex: 10 }}>
              AV
            </div>
          </div>

          {/* Quick Activity Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-frosted-subdued)', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: 11, zIndex: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <span className="pulse-beacon" /> Active in Operations Room
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Floor Lead</span>
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
                onClick={() => alert('Exporting live roster telemetry CSV')}
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
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Onboarding</h3>
              <span className="status-pill active" style={{ fontSize: 10 }}>
                {checklist.filter((c) => c.done).length}/{checklist.length}
              </span>
            </div>
            <CheckCircle2 size={18} color="var(--text-muted)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 'auto 0' }}>
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleChecklist(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-card-sm)',
                  background: item.done ? 'var(--surface-frosted-subdued)' : 'transparent',
                  border: '1px solid var(--surface-border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: item.done ? 'var(--color-primary)' : 'transparent',
                      border: item.done ? 'none' : '1px solid var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-on-primary)',
                    }}
                  >
                    {item.done && <Check size={12} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.7 : 1 }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.subtitle}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
            100% compliant with organizational rules
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
