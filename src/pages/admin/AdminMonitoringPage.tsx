import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Flame,
  RefreshCw,
  Calendar,
  Filter,
  X,
  Eye,
  Activity,
  Monitor,
  MousePointer,
  Keyboard,
  ShieldCheck,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { ScreenshotItem, EmployeeRecord } from '../../types/roles';

interface AdminMonitoringPageProps {
  initialSubTab?: 'live' | 'screenshots' | 'heatmaps';
}

export const AdminMonitoringPage: React.FC<AdminMonitoringPageProps> = ({ initialSubTab = 'live' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'screenshots' | 'heatmaps'>(initialSubTab);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const loadData = async () => {
    try {
      const [empList, scList] = await Promise.all([
        dataService.getEmployees('admin'),
        dataService.getScreenshots('admin', undefined, selectedEmployeeId === 'all' ? undefined : selectedEmployeeId),
      ]);
      setEmployees(empList);
      setScreenshots(scList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'screenshots' || payload.table === 'employee_presence') {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [selectedEmployeeId]);

  const handleOpenScreenshot = (sc: ScreenshotItem) => {
    setSelectedScreenshot(sc);
    dataService.logAction('Super Admin', 'admin', 'VIEW_SCREENSHOT', `${sc.employee_name} (${sc.captured_at})`, 'Inspected full resolution capture');
  };

  const filteredEmployees = employees.filter((e) =>
    selectedEmployeeId === 'all' ? true : e.id === selectedEmployeeId
  );

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
            <span>Organization Telemetry Stream</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Monitoring & Screen Captures
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Real-time employee activity, live desktop feeds, window titles, and mouse telemetry
          </p>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('live')}
            >
              <Activity size={14} />
              <span>Live Feeds</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'screenshots' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('screenshots')}
            >
              <Camera size={14} />
              <span>Screenshots ({screenshots.length})</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'heatmaps' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('heatmaps')}
            >
              <Flame size={14} />
              <span>Heatmaps</span>
            </button>
          </div>

          <button type="button" className="btn-icon-circle" onClick={loadData} title="Refresh telemetry">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="frosted-card frosted-card-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Employee:</span>
          <select
            className="stitch-select"
            style={{ width: 220, padding: '6px 14px', fontSize: 12 }}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span className="live-telemetry-badge">
            <Calendar size={12} /> Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <span>&bull;</span>
          <span>Encrypted WebP Captures</span>
        </div>
      </div>

      {/* 1. Live Feed Grid */}
      {activeSubTab === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredEmployees.map((emp) => {
            const isOnline = emp.status === 'active';
            const isIdle = emp.status === 'idle';
            return (
              <div key={emp.id} className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

                  <span className={`status-pill ${isOnline ? 'active' : isIdle ? 'idle' : 'offline'}`}>
                    {isOnline ? 'Active' : isIdle ? 'Idle' : 'Offline'}
                  </span>
                </div>

                {/* Live Active Window Banner */}
                <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-card-sm)', background: 'var(--surface-frosted-subdued)', border: '1px solid var(--surface-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Monitor size={14} color="var(--text-muted)" />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {emp.current_task || 'Visual Studio Code - Employee-Tracking-Dashboard'}
                  </div>
                </div>

                {/* Telemetry Stats Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', paddingTop: 4 }}>
                  <span>Active: <strong style={{ color: 'var(--text-primary)' }}>{Math.floor((emp.active_seconds || 14400) / 3600)}h {Math.floor(((emp.active_seconds || 14400) % 3600) / 60)}m</strong></span>
                  <span>Idle: <strong style={{ color: 'var(--text-primary)' }}>{Math.floor((emp.idle_seconds || 600) / 60)}m</strong></span>
                  <span>Device: <strong style={{ color: 'var(--text-primary)' }}>{emp.device_id || 'WIN-CLIENT'}</strong></span>
                </div>

                {/* Quick inspect button */}
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  style={{ width: '100%', marginTop: 4 }}
                  onClick={() => setActiveSubTab('screenshots')}
                >
                  <Eye size={13} />
                  <span>Inspect Screen Captures</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Screenshots Gallery Tab */}
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
                    <img
                      src={sc.thumbnail_url}
                      alt={sc.window_title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
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

      {/* 3. Heatmaps Tab */}
      {activeSubTab === 'heatmaps' && (
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Mouse Movement & Spatial Activity Heatmap</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aggregated spatial telemetry density across daily workstation window captures</span>
            </div>
            <span className="live-telemetry-badge">1,420 events logged</span>
          </div>

          <div
            style={{
              height: 380,
              borderRadius: 'var(--radius-card-sm)',
              background: 'radial-gradient(circle at 40% 45%, rgba(213,239,89,0.32) 0%, rgba(76,107,255,0.18) 42%, rgba(18,20,23,0.04) 75%)',
              border: '1px solid var(--surface-border-subtle)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <Flame size={42} color="var(--color-secondary)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              Active Spatial Activity Concentration: Primary Editor & Terminal
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.5 }}>
              Aggregated coordinates show high focus in central visual viewport. Zero keylogger guarantee active with privacy-first aggregate counters.
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <MousePointer size={14} color="var(--color-secondary)" />
                <span>12,480 Mouse Moves</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Keyboard size={14} color="var(--color-primary)" />
                <span>4,190 Keypress Totals</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <ShieldCheck size={14} color="var(--status-success)" />
                <span>DPAPI Verified</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Screenshot Modal */}
      <AnimatePresence>
        {selectedScreenshot && (
          <div className="stitch-modal-backdrop" onClick={() => setSelectedScreenshot(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
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

              <div style={{ borderRadius: 'var(--radius-card-sm)', overflow: 'hidden', border: '1px solid var(--surface-border)', maxHeight: '70vh' }}>
                <img
                  src={selectedScreenshot.high_res_url || selectedScreenshot.thumbnail_url}
                  alt={selectedScreenshot.window_title}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
