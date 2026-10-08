import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Flame,
  RefreshCw,
  Filter,
  X,
  Eye,
  Activity,
  Monitor,
  Video,
  CheckCircle2,
  Play,
  Download,
  Clock,
  Film,
  Search,
  ShieldCheck,
  Keyboard,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { MatrixHeatmap } from '../../components/telemetry/MatrixHeatmap';
import { KeyboardActivityView } from '../../components/telemetry/KeyboardActivityView';
import type { ScreenshotItem, EmployeeRecord, ScreenRecordingItem } from '../../types/roles';

interface AdminMonitoringPageProps {
  initialSubTab?: 'heatmaps' | 'keyboard' | 'recordings' | 'live' | 'screenshots';
}

export const AdminMonitoringPage: React.FC<AdminMonitoringPageProps> = ({ initialSubTab = 'heatmaps' }) => {
  const { navigate, user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'heatmaps' | 'keyboard' | 'recordings' | 'live' | 'screenshots'>(initialSubTab);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [recordings, setRecordings] = useState<ScreenRecordingItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [recordingSearch, setRecordingSearch] = useState<string>('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<ScreenRecordingItem | null>(null);

  // Live Screen Inspection & Recording Modal State
  const [selectedLiveEmployee, setSelectedLiveEmployee] = useState<EmployeeRecord | null>(null);
  const [isRecordingMap, setIsRecordingMap] = useState<Record<string, boolean>>({});
  const [recordingSecondsMap, setRecordingSecondsMap] = useState<Record<string, number>>({});
  const [recordingSuccessMessage, setRecordingSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const loadData = async () => {
    try {
      const [empList, scList, recList] = await Promise.all([
        dataService.getEmployees('admin'),
        dataService.getScreenshots('admin', undefined, selectedEmployeeId === 'all' ? undefined : selectedEmployeeId),
        dataService.getScreenRecordings('admin', undefined, selectedEmployeeId === 'all' ? undefined : selectedEmployeeId),
      ]);
      setEmployees(empList);
      setScreenshots(scList);
      setRecordings(recList);

      // Keep selected live employee updated in real time
      if (selectedLiveEmployee) {
        const updated = empList.find((e) => e.id === selectedLiveEmployee.id);
        if (updated) {
          setSelectedLiveEmployee(updated);
        }
      }
    } catch (err) {
      console.error('AdminMonitoringPage loadData error:', err);
    }
  };

  // Real-time listener + Automatic Live Polling every 4 seconds
  useEffect(() => {
    loadData();

    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (
        payload.table === 'screenshots' ||
        payload.table === 'screenshot_records' ||
        payload.table === 'employee_presence' ||
        payload.table === 'activity_aggregates' ||
        payload.table === 'activity_events' ||
        payload.table === 'employees'
      ) {
        loadData();
      }
    });

    const interval = setInterval(loadData, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [selectedEmployeeId]);

  // Handle on-demand screen recording
  const handleStartScreenRecording = async (emp: EmployeeRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const empId = emp.id;
    setIsRecordingMap((prev) => ({ ...prev, [empId]: true }));
    setRecordingSecondsMap((prev) => ({ ...prev, [empId]: 0 }));
    setRecordingSuccessMessage(null);

    // Call Supabase on-demand recording trigger
    await dataService.triggerOnDemandScreenRecording('admin', empId, user?.name || 'Super Admin');

    // Live Recording Progress Timer (8-second recording session)
    let secs = 0;
    const recTimer = setInterval(() => {
      secs += 1;
      setRecordingSecondsMap((prev) => ({ ...prev, [empId]: secs }));

      if (secs >= 8) {
        clearInterval(recTimer);
        setIsRecordingMap((prev) => ({ ...prev, [empId]: false }));
        setRecordingSuccessMessage(`10s Screen stream recorded for ${emp.name} & stored securely in Supabase vault.`);
        loadData();
        setTimeout(() => setRecordingSuccessMessage(null), 6000);
      }
    }, 1000);
  };

  const handleOpenScreenshot = (sc: ScreenshotItem) => {
    setSelectedScreenshot(sc);
    dataService.logAction('Super Admin', 'admin', 'VIEW_SCREENSHOT', `${sc.employee_name} (${sc.captured_at})`, 'Inspected full resolution capture');
  };

  const handleOpenLiveModal = (emp: EmployeeRecord) => {
    setSelectedLiveEmployee(emp);
    dataService.logAction(
      'Super Admin',
      'admin',
      'INSPECT_LIVE_SCREEN',
      emp.name,
      `Inspected live workstation screen and telemetry for ${emp.name}`
    );
  };

  const filteredEmployees = employees.filter((e) =>
    selectedEmployeeId === 'all' ? true : e.id === selectedEmployeeId
  );

  const filteredRecordings = recordings.filter((r) => {
    const matchesEmp = selectedEmployeeId === 'all' ? true : r.employee_id === selectedEmployeeId;
    const matchesSearch = recordingSearch === ''
      ? true
      : r.employee_name.toLowerCase().includes(recordingSearch.toLowerCase()) ||
        r.active_window.toLowerCase().includes(recordingSearch.toLowerCase());
    return matchesEmp && matchesSearch;
  });

  const totalActiveCount = employees.filter((e) => e.status === 'active').length;
  const totalKeysAgg = employees.reduce((acc, e) => acc + (e.key_press_count || 0), 0);
  const totalMovesAgg = employees.reduce((acc, e) => acc + (e.mouse_move_count || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* Header */}
      <div className="grid-operations-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <Activity size={14} color="var(--color-secondary)" />
            <span>Organization Telemetry Stream &bull; Live Telemetry Active</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Monitoring & Screen Captures
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Live employee screens, on-demand recording, active application titles, and workstation telemetry
          </p>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'heatmaps' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubTab('heatmaps');
                navigate('/admin/monitoring/heatmaps');
              }}
            >
              <Flame size={14} />
              <span>Mouse Heatmaps</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'keyboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubTab('keyboard');
                navigate('/admin/monitoring/keyboard');
              }}
            >
              <Keyboard size={14} />
              <span>Keyboard Activity</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'recordings' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubTab('recordings');
                navigate('/admin/monitoring/recordings');
              }}
            >
              <Video size={14} />
              <span>Live Recordings ({recordings.length})</span>
            </button>
          </div>

          <button type="button" className="btn-icon-circle" onClick={loadData} title="Refresh telemetry">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Live System Metrics Ribbon */}
      <div
        className="frosted-card frosted-card-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '10px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-beacon" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Live Telemetry: {totalActiveCount} / {employees.length} Online
            </span>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Keyboard: <strong style={{ color: 'var(--text-primary)' }}>{totalKeysAgg.toLocaleString()}</strong> events
          </span>
          <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Mouse Moves: <strong style={{ color: 'var(--text-primary)' }}>{totalMovesAgg.toLocaleString()}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Filter Employee:</span>
          <select
            className="stitch-select"
            style={{ width: 220, padding: '4px 12px', fontSize: 12 }}
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="all">All Organization Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.team_name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Success Toast */}
      {recordingSuccessMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="frosted-card"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            borderColor: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            color: 'var(--status-success)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{recordingSuccessMessage}</span>
        </motion.div>
      )}

      {/* 1. Live Feed Grid */}
      {activeSubTab === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredEmployees.map((emp) => {
            const isOnline = emp.status === 'active';
            const isIdle = emp.status === 'idle';
            const isRecording = isRecordingMap[emp.id];
            const recSecs = recordingSecondsMap[emp.id] || 0;

            return (
              <div
                key={emp.id}
                className="frosted-card"
                onClick={() => handleOpenLiveModal(emp)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                  border: isRecording ? '1px solid var(--status-error)' : '1px solid var(--surface-border-subtle)',
                }}
              >
                {/* Employee Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar-chip">
                      {emp.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.department} &bull; {emp.team_name}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isRecording && (
                      <span className="status-pill late" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', animation: 'pulse 1s infinite' }}>
                        🔴 REC 00:0{recSecs}
                      </span>
                    )}
                    <span className={`status-pill ${isOnline ? 'active' : isIdle ? 'idle' : 'offline'}`}>
                      {isOnline ? 'Active' : isIdle ? 'Idle' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Screen Preview Container */}
                <div
                  style={{
                    height: 170,
                    borderRadius: 'var(--radius-card-sm)',
                    overflow: 'hidden',
                    background: 'var(--surface-frosted-subdued)',
                    border: '1px solid var(--surface-border-subtle)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {emp.latest_screenshot_url ? (
                    <img
                      src={emp.latest_screenshot_url}
                      alt={emp.active_window || 'Live Workstation'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}

                  {/* Fallback & Live Overlay Info */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: emp.latest_screenshot_url
                        ? 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.1) 60%)'
                        : 'radial-gradient(circle at 50% 50%, rgba(76,107,255,0.15), rgba(15,23,42,0.9))',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="live-telemetry-badge" style={{ fontSize: 10, padding: '2px 8px' }}>
                        <Monitor size={11} /> {emp.device_name || 'WIN-WORKSTATION'}
                      </span>
                      <span style={{ fontSize: 10, color: '#e2e8f0', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
                        {emp.last_screenshot !== 'No captures' ? `Capture: ${emp.last_screenshot}` : 'Live Stream'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Monitor size={14} color="#38bdf8" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {emp.active_window || 'Visual Studio Code'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Telemetry Stats Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-card-sm)',
                    background: 'var(--surface-frosted-subdued)',
                    fontSize: 11,
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>Active Time</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {Math.floor(emp.active_seconds / 3600)}h {Math.floor((emp.active_seconds % 3600) / 60)}m
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>Keystrokes</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{emp.key_press_count?.toLocaleString() || 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>Mouse Events</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{emp.mouse_move_count?.toLocaleString() || 0}</strong>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px 0' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLiveModal(emp);
                    }}
                  >
                    <Eye size={13} />
                    <span>Live Screen</span>
                  </button>

                  <button
                    type="button"
                    className="btn-pill btn-pill-primary"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      fontSize: 12,
                      padding: '7px 0',
                      background: isRecording ? '#ef4444' : undefined,
                    }}
                    onClick={(e) => handleStartScreenRecording(emp, e)}
                  >
                    <Video size={13} />
                    <span>{isRecording ? `Recording (${recSecs}s)` : 'Record Screen'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Live Recordings Subtab (Stored in Supabase Vault & Activity Events) */}
      {activeSubTab === 'recordings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Subtab Toolbar */}
          <div
            className="frosted-card frosted-card-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface-frosted-subdued)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--surface-border-subtle)',
                }}
              >
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search by window or employee..."
                  value={recordingSearch}
                  onChange={(e) => setRecordingSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none',
                    width: 210,
                  }}
                />
                {recordingSearch && (
                  <button
                    type="button"
                    onClick={() => setRecordingSearch('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} color="var(--text-muted)" />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <Filter size={13} />
                <span>Employee:</span>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="stitch-select"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  <option value="all">All Organization Employees</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                <ShieldCheck size={13} />
                <span>Supabase Vault Synchronized</span>
              </span>

              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Total: <strong>{filteredRecordings.length}</strong> session(s)
              </span>
            </div>
          </div>

          {/* Recordings Grid */}
          {filteredRecordings.length === 0 ? (
            <div
              className="frosted-card"
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(76, 107, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}
              >
                <Video size={24} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>No screen recordings stored yet</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 420, margin: 0 }}>
                Screen recordings are triggered on-demand to preserve employee privacy and bandwidth. Click "Record Screen" on any employee card in Live Feeds to capture a 10-second session.
              </p>
              <button
                type="button"
                className="btn-pill btn-pill-primary"
                onClick={() => {
                  setActiveSubTab('live');
                  navigate('/admin/monitoring/live');
                }}
              >
                <Activity size={13} />
                <span>Go to Live Feeds to Record</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {filteredRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="frosted-card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--surface-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #4c6bff, #7a5af8)',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {rec.employee_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {rec.employee_name}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {rec.department} &bull; {rec.device_name || rec.device_id}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      {rec.status === 'completed' ? 'Vault Archived' : 'Processing'}
                    </span>
                  </div>

                  {/* Video Thumbnail / Preview Container */}
                  <div
                    style={{
                      height: 200,
                      position: 'relative',
                      background: '#090d16',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                    onClick={() => setSelectedRecording(rec)}
                  >
                    <img
                      src={rec.thumbnail_url}
                      alt={rec.active_window}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.8,
                      }}
                    />

                    {/* Gradient Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(9,13,22,0.92) 0%, rgba(9,13,22,0.2) 60%)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="live-telemetry-badge" style={{ fontSize: 10, padding: '2px 8px' }}>
                          <Clock size={11} /> {rec.duration_seconds}s Session
                        </span>
                        <span style={{ fontSize: 10, color: '#e2e8f0', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
                          {new Date(rec.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Play Button Overlay */}
                      <div
                        style={{
                          alignSelf: 'center',
                          width: 46,
                          height: 46,
                          borderRadius: '50%',
                          background: 'rgba(76, 107, 255, 0.85)',
                          backdropFilter: 'blur(8px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          boxShadow: '0 0 16px rgba(76, 107, 255, 0.6)',
                        }}
                      >
                        <Play size={20} fill="#ffffff" style={{ marginLeft: 2 }} />
                      </div>

                      {/* Window Title Banner */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Monitor size={13} color="#38bdf8" />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {rec.active_window}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div
                    style={{
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface-frosted-subdued)',
                      fontSize: 11,
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10 }}>Recorded By</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{rec.recorded_by}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn-pill btn-pill-secondary"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const a = document.createElement('a');
                          a.href = rec.video_url;
                          a.download = `recording-${rec.employee_name}-${rec.id}.mp4`;
                          a.click();
                        }}
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>

                      <button
                        type="button"
                        className="btn-pill btn-pill-primary"
                        style={{ padding: '4px 12px', fontSize: 11 }}
                        onClick={() => setSelectedRecording(rec)}
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Watch</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Screenshots Gallery Tab */}
      {activeSubTab === 'screenshots' && (
        <div>
          {screenshots.length === 0 ? (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No screenshot records available for selected filter.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {screenshots.map((sc) => (
                <div
                  key={sc.id}
                  className="frosted-card"
                  style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => handleOpenScreenshot(sc)}
                >
                  <div style={{ height: 180, position: 'relative', background: 'var(--surface-frosted-subdued)' }}>
                    {sc.thumbnail_url || sc.high_res_url ? (
                      <img
                        src={sc.thumbnail_url || sc.high_res_url}
                        alt={sc.window_title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <Camera size={32} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 10, right: 10 }} className="status-pill active">
                      {sc.activity_type || 'Active'}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sc.employee_name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {sc.captured_at ? new Date(sc.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sc.window_title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2.5 Screen Recordings Gallery Tab */}
      {activeSubTab === 'recordings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Recordings search & info header */}
          <div
            className="frosted-card frosted-card-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '10px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Film size={16} color="var(--color-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                On-Demand & Automated Workstation Recordings
              </span>
              <span className="live-telemetry-badge">
                <ShieldCheck size={11} /> Cryptographic Vault
              </span>
            </div>

            <div className="stitch-search-pill" style={{ width: 240, padding: '4px 12px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Filter recordings..."
                value={recordingSearch}
                onChange={(e) => setRecordingSearch(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          {recordings.filter(r =>
            r.employee_name.toLowerCase().includes(recordingSearch.toLowerCase()) ||
            r.active_window.toLowerCase().includes(recordingSearch.toLowerCase())
          ).length === 0 ? (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
              <Video size={40} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>No screen recordings found</h3>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                Switch to Live Feeds and click "Record Screen" on any employee workstation to generate an on-demand recording.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {recordings
                .filter(r =>
                  r.employee_name.toLowerCase().includes(recordingSearch.toLowerCase()) ||
                  r.active_window.toLowerCase().includes(recordingSearch.toLowerCase())
                )
                .map((rec) => (
                  <div
                    key={rec.id}
                    className="frosted-card"
                    style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => setSelectedRecording(rec)}
                  >
                    <div style={{ height: 180, position: 'relative', background: '#0b1120' }}>
                      {rec.thumbnail_url ? (
                        <img
                          src={rec.thumbnail_url}
                          alt={rec.active_window}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <Film size={36} />
                        </div>
                      )}

                      {/* Play overlay button */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.35)',
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'rgba(59, 130, 246, 0.9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                          }}
                        >
                          <Play size={20} fill="#fff" style={{ marginLeft: 2 }} />
                        </div>
                      </div>

                      {/* Duration badge */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 10,
                          right: 10,
                          background: 'rgba(0,0,0,0.75)',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Clock size={11} />
                        <span>00:{rec.duration_seconds < 10 ? `0${rec.duration_seconds}` : rec.duration_seconds}</span>
                      </div>

                      <div style={{ position: 'absolute', top: 10, left: 10 }}>
                        <span className="status-pill active" style={{ fontSize: 10, padding: '2px 8px' }}>
                          {rec.trigger_type === 'on_demand' ? 'On-Demand' : 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rec.employee_name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(rec.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.active_window}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Mouse Heatmaps Tab */}
      {activeSubTab === 'heatmaps' && (
        <MatrixHeatmap
          initialPreset="hourly"
          selectedEmployeeName={
            selectedEmployeeId === 'all'
              ? undefined
              : employees.find((e) => e.id === selectedEmployeeId)?.name
          }
        />
      )}

      {/* 4. Keyboard Activity Tab */}
      {activeSubTab === 'keyboard' && (
        <KeyboardActivityView
          selectedEmployeeName={
            selectedEmployeeId === 'all'
              ? undefined
              : employees.find((e) => e.id === selectedEmployeeId)?.name
          }
        />
      )}

      {/* Interactive Live Screen Inspector & On-Demand Recording Modal */}
      <AnimatePresence>
        {selectedLiveEmployee && (
          <div className="stitch-modal-backdrop" onClick={() => setSelectedLiveEmployee(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="stitch-modal-content"
              style={{ maxWidth: 880, width: '92vw', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar-chip" style={{ width: 38, height: 38, fontSize: 13 }}>
                    {selectedLiveEmployee.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {selectedLiveEmployee.name}
                      </h2>
                      <span className={`status-pill ${selectedLiveEmployee.status === 'active' ? 'active' : 'idle'}`}>
                        {selectedLiveEmployee.status === 'active' ? 'Live Stream' : 'Idle'}
                      </span>
                      {isRecordingMap[selectedLiveEmployee.id] && (
                        <span className="status-pill late" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', animation: 'pulse 1s infinite' }}>
                          🔴 RECORDING LIVE (00:0{recordingSecondsMap[selectedLiveEmployee.id] || 0})
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {selectedLiveEmployee.department} &bull; Device: {selectedLiveEmployee.device_name || selectedLiveEmployee.device_id} ({selectedLiveEmployee.os_version})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* On-Demand Record Button */}
                  <button
                    type="button"
                    className="btn-pill btn-pill-primary"
                    style={{
                      background: isRecordingMap[selectedLiveEmployee.id] ? '#ef4444' : undefined,
                    }}
                    onClick={() => handleStartScreenRecording(selectedLiveEmployee)}
                  >
                    <Video size={14} />
                    <span>
                      {isRecordingMap[selectedLiveEmployee.id]
                        ? `Recording (00:0${recordingSecondsMap[selectedLiveEmployee.id] || 0})`
                        : 'Record Screen (10s)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn-icon-circle"
                    onClick={() => setSelectedLiveEmployee(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Main Screen Stream Frame */}
              <div
                style={{
                  borderRadius: 'var(--radius-card-sm)',
                  overflow: 'hidden',
                  background: '#090d16',
                  border: '1px solid var(--surface-border)',
                  position: 'relative',
                  minHeight: 380,
                  maxHeight: '55vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selectedLiveEmployee.latest_screenshot_url ? (
                  <img
                    src={selectedLiveEmployee.latest_screenshot_url}
                    alt={selectedLiveEmployee.active_window || 'Live Screen Stream'}
                    style={{ width: '100%', height: '100%', maxHeight: '55vh', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    <Monitor size={48} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                      {selectedLiveEmployee.active_window || 'Active Engineering Workspace'}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Workstation is connected &bull; Telemetry syncing via Supabase
                    </div>
                  </div>
                )}

                {/* Top Overlay Banner with Window Title */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    right: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      backdropFilter: 'blur(8px)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: '#ffffff',
                      fontWeight: 600,
                    }}
                  >
                    <Monitor size={14} color="#38bdf8" />
                    <span>Active Window: {selectedLiveEmployee.active_window || 'Desktop Workspace'}</span>
                  </div>

                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      backdropFilter: 'blur(8px)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: 11,
                      color: '#94a3b8',
                    }}
                  >
                    Last Capture: {selectedLiveEmployee.last_screenshot}
                  </div>
                </div>
              </div>

              {/* Realtime Telemetry Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 12,
                }}
              >
                <div className="frosted-card frosted-card-sm" style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Daily Active Time</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {Math.floor(selectedLiveEmployee.active_seconds / 3600)}h {Math.floor((selectedLiveEmployee.active_seconds % 3600) / 60)}m
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--status-success)' }}>● Active Now</span>
                </div>

                <div className="frosted-card frosted-card-sm" style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Keystrokes Today</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedLiveEmployee.key_press_count?.toLocaleString() || 0}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Aggregated input rate</span>
                </div>

                <div className="frosted-card frosted-card-sm" style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Mouse Spatial Moves</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedLiveEmployee.mouse_move_count?.toLocaleString() || 0}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Zero coordinate storage</span>
                </div>

                <div className="frosted-card frosted-card-sm" style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Merit Stars</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>
                    ⭐ {selectedLiveEmployee.stars}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Trust ledger verified</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Screenshot Lightbox Modal */}
      <AnimatePresence>
        {selectedScreenshot && (
          <div className="stitch-modal-backdrop" onClick={() => setSelectedScreenshot(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 960, width: '92vw' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {selectedScreenshot.employee_name}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Capture timestamp: {selectedScreenshot.captured_at} &bull; {selectedScreenshot.window_title}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  onClick={() => setSelectedScreenshot(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ borderRadius: 'var(--radius-card-sm)', overflow: 'hidden', border: '1px solid var(--surface-border)', maxHeight: '72vh', background: '#090d16' }}>
                <img
                  src={selectedScreenshot.high_res_url || selectedScreenshot.thumbnail_url}
                  alt={selectedScreenshot.window_title}
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '72vh', objectFit: 'contain' }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Recording Playback Lightbox Modal */}
      <AnimatePresence>
        {selectedRecording && (
          <div className="stitch-modal-backdrop" onClick={() => setSelectedRecording(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 840, width: '92vw', padding: '1.25rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {selectedRecording.employee_name} — Workstation Recording
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Triggered by {selectedRecording.recorded_by} • {selectedRecording.active_window}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedRecording.video_url && (
                    <a
                      href={selectedRecording.video_url}
                      download={`recording-${selectedRecording.employee_name}.mp4`}
                      className="btn-pill btn-pill-secondary"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </a>
                  )}
                  <button type="button" className="btn-icon-circle" onClick={() => setSelectedRecording(null)}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div style={{ borderRadius: 'var(--radius-card-sm)', overflow: 'hidden', background: '#000', maxHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedRecording.video_url && selectedRecording.video_url.endsWith('.mp4') ? (
                  <video
                    src={selectedRecording.video_url}
                    controls
                    autoPlay
                    style={{ width: '100%', maxHeight: 520, objectFit: 'contain' }}
                  />
                ) : (
                  <img
                    src={selectedRecording.thumbnail_url || selectedRecording.video_url}
                    alt={selectedRecording.active_window}
                    style={{ width: '100%', maxHeight: 520, objectFit: 'contain' }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
