import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Filter, X, Eye, Activity, Monitor, Video, CheckCircle2, Play, Download, Clock, Search, ShieldCheck, Flame, Keyboard, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService, isAdminRecord } from '../../services/dataService';
import { MatrixHeatmap } from '../../components/telemetry/MatrixHeatmap';
import { KeyboardActivityView } from '../../components/telemetry/KeyboardActivityView';
import { formatCaptureDateTime, formatCaptureTime } from '../../utils/datetime';
import { agentCommandEmployeeId } from '../../utils/agentEmployeeId';
import type { ScreenshotItem, EmployeeRecord, ScreenRecordingItem } from '../../types/roles';
import { FrameSequencePlayer } from '../../components/monitoring/FrameSequencePlayer';
import { LiveScreenFrame } from '../../components/monitoring/LiveScreenFrame';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
interface ManagerMonitoringPageProps {
  initialSubTab?: 'heatmaps' | 'keyboard' | 'recordings' | 'live' | 'screenshots';
}

export const ManagerMonitoringPage: React.FC<ManagerMonitoringPageProps> = ({ initialSubTab = 'live' }) => {
  const { user, navigate } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'heatmaps' | 'keyboard' | 'recordings' | 'live' | 'screenshots'>(initialSubTab);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [recordings, setRecordings] = useState<ScreenRecordingItem[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<EmployeeRecord[]>([]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [recordingSearch, setRecordingSearch] = useState<string>('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<ScreenRecordingItem | null>(null);

  // Live Screen Inspection & Recording Modal State
  const [selectedLiveEmployee, setSelectedLiveEmployee] = useState<EmployeeRecord | null>(null);
  const [liveFrameUrl, setLiveFrameUrl] = useState<string | null>(null);
  const [liveStatusText, setLiveStatusText] = useState<string>('Connecting to agent…');
  const [isRecordingMap, setIsRecordingMap] = useState<Record<string, boolean>>({});
  const [recordingSecondsMap, setRecordingSecondsMap] = useState<Record<string, number>>({});
  const [recordingSuccessMessage, setRecordingSuccessMessage] = useState<string | null>(null);
  const [screenshotActionMessage, setScreenshotActionMessage] = useState<string | null>(null);
  const [isDeletingScreenshots, setIsDeletingScreenshots] = useState(false);
  const isDeletingScreenshotsRef = useRef(false);
  const [liveKeysToday, setLiveKeysToday] = useState(0);
  const [liveMovesToday, setLiveMovesToday] = useState(0);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const loadData = async () => {
    if (isDeletingScreenshotsRef.current) return;
    try {
      const filter = filterEmployeeId === 'all' ? undefined : filterEmployeeId;
      const [empList, scList, recList, keysLive, mouseLive] = await Promise.all([
        dataService.getEmployees('manager', user.id),
        dataService.getScreenshots('manager', user.id, filter),
        dataService.getScreenRecordings('manager', user.id, filter),
        dataService.getLiveKeystrokeTelemetry('manager', filter, user.id),
        dataService.getLiveMouseTelemetry('manager', filter, user.id),
      ]);
      if (isDeletingScreenshotsRef.current) return;
      const safeEmps = empList.filter((e) => !isAdminRecord(e.id, e.name, e.email));
      const safeScs = scList.filter((s) => !isAdminRecord(s.employee_id, s.employee_name));
      const safeRecs = recList.filter((r) => !isAdminRecord(r.employee_id, r.employee_name));

      setTeamEmployees(safeEmps);
      setScreenshots(safeScs);
      setRecordings(safeRecs);
      setLiveKeysToday(keysLive.totalKeys || 0);
      setLiveMovesToday(mouseLive.totalMoves || 0);

      // Keep selected live employee updated in real time
      if (selectedLiveEmployee) {
        const updated = safeEmps.find((e) => e.id === selectedLiveEmployee.id);
        if (updated) {
          setSelectedLiveEmployee(updated);
        }
      }
    } catch (err) {
      console.error('ManagerMonitoringPage loadData error:', err);
    }
  };

  useAppRefresh(loadData);

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
  }, [user.id, filterEmployeeId]);

  const handleStartScreenRecording = async (emp: EmployeeRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const empId = emp.id;
    if (isRecordingMap[empId]) return;
    setIsRecordingMap((prev) => ({ ...prev, [empId]: true }));
    setRecordingSecondsMap((prev) => ({ ...prev, [empId]: 0 }));
    setRecordingSuccessMessage(null);

    let secs = 0;
    const recTimer = setInterval(() => {
      secs += 1;
      setRecordingSecondsMap((prev) => ({ ...prev, [empId]: secs }));
    }, 1000);

    try {
      const agentEmpId = agentCommandEmployeeId(emp);
      const res = await dataService.triggerOnDemandScreenRecording(
        'manager',
        agentEmpId,
        user.name,
        emp.name,
        emp.active_window
      );
      setRecordingSuccessMessage(
        res.success
          ? `Real desktop recording saved for ${emp.name}.`
          : res.message || `Recording failed for ${emp.name}.`
      );
      if (res.success && res.recording) setSelectedRecording(res.recording);
      await loadData();
    } finally {
      clearInterval(recTimer);
      setIsRecordingMap((prev) => ({ ...prev, [empId]: false }));
      setTimeout(() => setRecordingSuccessMessage(null), 8000);
    }
  };

  const handleOpenScreenshot = (sc: ScreenshotItem) => {
    setSelectedScreenshot(sc);
    dataService.logAction(
      user.name,
      'manager',
      'VIEW_SCREENSHOT',
      `${sc.employee_name} (${formatCaptureDateTime(sc.captured_at)})`,
      'Team manager inspected screenshot capture',
      user?.id
    );
  };

  const handleDeleteScreenshot = async (sc: ScreenshotItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isDeletingScreenshotsRef.current) return;
    if (!window.confirm(`Delete screenshot for ${sc.employee_name} at ${formatCaptureDateTime(sc.captured_at)}?`)) {
      return;
    }
    isDeletingScreenshotsRef.current = true;
    setIsDeletingScreenshots(true);
    setScreenshots((prev) => prev.filter((s) => s.id !== sc.id));
    if (selectedScreenshot?.id === sc.id) setSelectedScreenshot(null);
    try {
      const res = await dataService.deleteScreenshot(sc);
      setScreenshotActionMessage(res.message);
    } finally {
      isDeletingScreenshotsRef.current = false;
      setIsDeletingScreenshots(false);
      await loadData();
      setTimeout(() => setScreenshotActionMessage(null), 4000);
    }
  };

  const handleCloseLiveModal = async () => {
    const emp = selectedLiveEmployee;
    setSelectedLiveEmployee(null);
    setLiveFrameUrl(null);
    setLiveStatusText('Connecting to agent…');
    if (emp) {
      await dataService.stopLiveSession(agentCommandEmployeeId(emp), user.name);
    }
  };

  const handleOpenLiveModal = async (emp: EmployeeRecord) => {
    setSelectedLiveEmployee(emp);
    setLiveFrameUrl(null);
    setLiveStatusText('Requesting live frames from agent…');
    dataService.logAction(
      user.name,
      'manager',
      'INSPECT_LIVE_SCREEN',
      emp.name,
      `Opened live workstation stream for ${emp.name}`,
      user?.id
    );
    const res = await dataService.startLiveSession(agentCommandEmployeeId(emp), user.name);
    if (!res.success) {
      setLiveStatusText(res.message || 'Failed to start live session');
    }
  };

  useEffect(() => {
    if (!selectedLiveEmployee) return;
    const empId = agentCommandEmployeeId(selectedLiveEmployee);
    let cancelled = false;

    const tick = async () => {
      const session = await dataService.getLiveSession(empId);
      if (cancelled) return;
      if (session?.frame_url) {
        setLiveFrameUrl(session.frame_url);
        setLiveStatusText(
          session.active
            ? `Live · ${session.width || '?'}×${session.height || '?'} · ${formatCaptureTime(session.updated_at)}`
            : 'Waiting for agent…'
        );
      } else {
        setLiveStatusText('Waiting for agent live frame…');
      }
    };

    tick();
    const poll = setInterval(tick, 1000);
    const keepalive = setInterval(() => {
      void dataService.heartbeatLiveSession(empId, user.name);
    }, 25000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(keepalive);
    };
  }, [selectedLiveEmployee?.id, selectedLiveEmployee?.user_id, user.name]);

  const selectedEmpRecord = teamEmployees.find(
    (e) => e.id === filterEmployeeId || e.user_id === filterEmployeeId || e.name === filterEmployeeId
  );
  const activeFilterEmployeeName = filterEmployeeId === 'all'
    ? undefined
    : (selectedEmpRecord ? selectedEmpRecord.name : filterEmployeeId);

  const filteredEmployees = teamEmployees
    .filter((e) => !isAdminRecord(e.id, e.name, e.email))
    .filter((e) =>
      filterEmployeeId === 'all'
        ? true
        : e.id === filterEmployeeId ||
          e.user_id === filterEmployeeId ||
          e.name.toLowerCase() === filterEmployeeId.toLowerCase()
    );

  const filteredScreenshots = screenshots
    .filter((s) => !isAdminRecord(s.employee_id, s.employee_name))
    .filter((s) => {
      if (filterEmployeeId === 'all') return true;
      return (
        s.employee_id === filterEmployeeId ||
        (selectedEmpRecord && (
          s.employee_id === selectedEmpRecord.user_id ||
          s.employee_id === selectedEmpRecord.id ||
          (s.employee_name && s.employee_name.toLowerCase().includes(selectedEmpRecord.name.toLowerCase()))
        )) ||
        (s.employee_name && s.employee_name.toLowerCase().includes(filterEmployeeId.toLowerCase()))
      );
    });

  const handleDeleteAllScreenshots = async () => {
    if (isDeletingScreenshotsRef.current) return;
    const toDelete = [...filteredScreenshots];
    if (toDelete.length === 0) return;
    if (!window.confirm(`Delete ALL ${toDelete.length} team screenshot(s)? This cannot be undone.`)) {
      return;
    }
    const deleteIds = new Set(toDelete.map((s) => s.id));
    isDeletingScreenshotsRef.current = true;
    setIsDeletingScreenshots(true);
    setScreenshots((prev) => prev.filter((s) => !deleteIds.has(s.id)));
    setSelectedScreenshot(null);
    setScreenshotActionMessage(`Deleting ${toDelete.length} screenshot(s)…`);
    try {
      const res = await dataService.deleteAllScreenshots(
        'manager',
        user.id,
        filterEmployeeId === 'all' ? undefined : filterEmployeeId,
        toDelete
      );
      setScreenshotActionMessage(res.message);
    } catch (err: any) {
      setScreenshotActionMessage(err?.message || 'Failed to delete screenshots.');
    } finally {
      isDeletingScreenshotsRef.current = false;
      setIsDeletingScreenshots(false);
      await loadData();
      setTimeout(() => setScreenshotActionMessage(null), 5000);
    }
  };

  const filteredRecordings = recordings
    .filter((r) => !isAdminRecord(r.employee_id, r.employee_name))
    .filter((r) => {
      const matchesEmp = filterEmployeeId === 'all'
        ? true
        : r.employee_id === filterEmployeeId ||
          (selectedEmpRecord && (
            r.employee_id === selectedEmpRecord.user_id ||
            r.employee_id === selectedEmpRecord.id ||
            (r.employee_name && r.employee_name.toLowerCase().includes(selectedEmpRecord.name.toLowerCase()))
          )) ||
          (r.employee_name && r.employee_name.toLowerCase().includes(filterEmployeeId.toLowerCase()));
      const matchesSearch = recordingSearch === ''
        ? true
        : r.employee_name.toLowerCase().includes(recordingSearch.toLowerCase()) ||
          r.active_window.toLowerCase().includes(recordingSearch.toLowerCase());
      return matchesEmp && matchesSearch;
    });

  const totalActiveCount = filteredEmployees.filter(
    (e) => e.status === 'active' || e.status === 'idle' || e.status === 'on_break'
  ).length;
  const totalKeysAgg = liveKeysToday;
  const totalMovesAgg = liveMovesToday;

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
            <span>Team Live Feed &bull; Live Telemetry Sync</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Team Telemetry & Screen Captures
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Active windows and screen captures scoped to {user.team_name || 'your assigned team'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Segmented Switcher */}
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'live' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubTab('live');
                navigate('/manager/monitoring/live');
              }}
            >
              <Activity size={14} />
              <span>Live Feeds</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'screenshots' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubTab('screenshots');
                navigate('/manager/monitoring/screenshots');
              }}
            >
              <Camera size={14} />
              <span>Screenshots ({filteredScreenshots.length})</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'heatmaps' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubTab('heatmaps');
                navigate('/manager/monitoring/heatmaps');
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
                navigate('/manager/monitoring/keyboard');
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
                navigate('/manager/monitoring/recordings');
              }}
            >
              <Video size={14} />
              <span>Live Recordings ({filteredRecordings.length})</span>
            </button>
          </div>

          <RefreshButton onRefresh={loadData} iconOnly size={15} title="Refresh captures" />
        </div>
      </div>

      {/* Live Metrics Ribbon */}
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
              Team Stream: {totalActiveCount} / {filteredEmployees.length} Online
            </span>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }} title="Today's real key presses from activity_aggregates">
            Keyboard: <strong style={{ color: 'var(--text-primary)' }}>{totalKeysAgg.toLocaleString()}</strong> events today
          </span>
          <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }} title="Today's real mouse moves from activity_aggregates">
            Mouse Moves: <strong style={{ color: 'var(--text-primary)' }}>{totalMovesAgg.toLocaleString()}</strong> today
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Team Member:</span>
          <select
            className="stitch-select"
            style={{ width: 230, padding: '4px 12px', fontSize: 12 }}
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
          >
            <option value="all">All Team Members</option>
            {teamEmployees
              .filter((e) => !isAdminRecord(e.id, e.name, e.email))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
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
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  border: isRecording ? '1px solid var(--status-error)' : '1px solid var(--surface-border-subtle)',
                }}
              >
                {/* Employee Header */}
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
                    background: '#000000',
                    border: '1px solid var(--surface-border-subtle)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {isOnline ? (
                    <>
                      {emp.latest_screenshot_url ? (
                        <img
                          src={emp.latest_screenshot_url}
                          alt={emp.active_window || 'Live Screen Stream'}
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

                        {emp.active_window && emp.active_window !== '—' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Monitor size={14} color="#38bdf8" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.active_window}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: '#000000',
                      }}
                    />
                  )}
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
          {filteredEmployees.length === 0 && (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              No team members found in assigned scope.
            </div>
          )}
        </div>
      )}

      {/* 2. Live Recordings Subtab (Scoped to Team) */}
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
                  placeholder="Search team recordings..."
                  value={recordingSearch}
                  onChange={(e) => setRecordingSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none',
                    width: 200,
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
                <span>Team Member:</span>
                <select
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                  className="stitch-select"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  <option value="all">All Team Members</option>
                  {teamEmployees
                    .filter((e) => !isAdminRecord(e.id, e.name, e.email))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
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
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>No team screen recordings stored</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 420, margin: 0 }}>
                Screen recordings are captured on-demand. Click "Record Screen" on any of your team member cards in Live Feeds to capture a session.
              </p>
              <button
                type="button"
                className="btn-pill btn-pill-primary"
                onClick={() => {
                  setActiveSubTab('live');
                  navigate('/manager/monitoring/live');
                }}
              >
                <Activity size={13} />
                <span>Go to Live Feeds</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              <Camera size={16} color="var(--color-secondary)" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Screenshots ({filteredScreenshots.length})
              </span>
              {screenshotActionMessage && (
                <span className="live-telemetry-badge" style={{ fontSize: 11 }}>
                  {screenshotActionMessage}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              style={{
                padding: '6px 12px',
                fontSize: 12,
                opacity: filteredScreenshots.length === 0 || isDeletingScreenshots ? 0.55 : 1,
                cursor: filteredScreenshots.length === 0 || isDeletingScreenshots ? 'not-allowed' : 'pointer',
                pointerEvents: isDeletingScreenshots ? 'none' : 'auto',
              }}
              disabled={filteredScreenshots.length === 0 || isDeletingScreenshots}
              aria-busy={isDeletingScreenshots}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleDeleteAllScreenshots();
              }}
            >
              <Trash2 size={13} />
              <span>{isDeletingScreenshots ? 'Deleting…' : 'Delete all screenshots'}</span>
            </button>
          </div>

          {filteredScreenshots.length === 0 ? (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No screenshot records available for your team.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredScreenshots.map((sc) => (
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
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = 'none';
                          const fallback = el.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        height: '100%',
                        display: sc.thumbnail_url || sc.high_res_url ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                        gap: 8,
                        flexDirection: 'column',
                      }}
                    >
                      <Camera size={28} />
                      <span>Capture unavailable</span>
                    </div>
                    <div style={{ position: 'absolute', top: 10, right: 10 }} className="status-pill active">
                      {sc.activity_type || 'Active'}
                    </div>
                    <button
                      type="button"
                      className="btn-pill btn-pill-secondary"
                      title="Delete this screenshot"
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        padding: '4px 8px',
                        fontSize: 11,
                        background: 'rgba(15,23,42,0.72)',
                        color: '#fff',
                      }}
                      onClick={(e) => handleDeleteScreenshot(sc, e)}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>

                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sc.employee_name || 'Team Member'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={formatCaptureDateTime(sc.captured_at)}>
                        {formatCaptureTime(sc.captured_at)}
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

      {/* 3. Mouse Heatmaps Tab */}
      {activeSubTab === 'heatmaps' && (
        <MatrixHeatmap
          initialPreset="hourly"
          role="manager"
          showBreakSchedule={true}
          selectedEmployeeName={activeFilterEmployeeName}
        />
      )}

      {/* 4. Keyboard Activity Tab */}
      {activeSubTab === 'keyboard' && (
        <KeyboardActivityView
          role="manager"
          showBreakSchedule={true}
          selectedEmployeeName={activeFilterEmployeeName}
        />
      )}

      {/* Interactive Live Screen Inspector & On-Demand Recording Modal */}
      <AnimatePresence>
        {selectedLiveEmployee && (
          <div className="stitch-modal-backdrop" onClick={() => void handleCloseLiveModal()}>
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
                    onClick={() => void handleCloseLiveModal()}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Main Screen Stream Frame — real agent live JPEG (no self-mirror / no flicker) */}
              <LiveScreenFrame
                frameUrl={liveFrameUrl}
                statusText={liveStatusText}
                employeeName={selectedLiveEmployee.name}
                deviceId={selectedLiveEmployee.device_id}
                deviceName={selectedLiveEmployee.device_name}
                activeWindow={selectedLiveEmployee.active_window}
              >
                {/* Top Overlay Banner with Window Title */}
                {selectedLiveEmployee.status !== 'offline' && (
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
                      <span>
                        Active Window:{' '}
                        {selectedLiveEmployee.active_window && selectedLiveEmployee.active_window !== '—'
                          ? selectedLiveEmployee.active_window
                          : 'Unavailable'}
                      </span>
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
                      {liveStatusText}
                    </div>
                  </div>
                )}
              </LiveScreenFrame>

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
                    Capture timestamp: {formatCaptureDateTime(selectedScreenshot.captured_at)} &bull; {selectedScreenshot.window_title}
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

      {/* Video Recording Playback Modal */}
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
                    {selectedRecording.employee_name} — Team Screen Recording
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Triggered by {selectedRecording.recorded_by} &bull; {selectedRecording.active_window}
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
                {selectedRecording.frame_manifest?.frame_urls?.length ? (
                  <FrameSequencePlayer
                    manifest={selectedRecording.frame_manifest}
                    posterUrl={selectedRecording.thumbnail_url}
                    style={{ width: '100%', maxHeight: 520, minHeight: 320 }}
                  />
                ) : selectedRecording.video_url &&
                  (selectedRecording.video_url.includes('.mp4') ||
                    selectedRecording.video_url.includes('.webm')) ? (
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
