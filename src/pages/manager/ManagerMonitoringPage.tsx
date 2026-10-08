import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Filter, Calendar, Activity, Camera, Monitor, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { MatrixHeatmap } from '../../components/telemetry/MatrixHeatmap';
import type { ScreenshotItem, EmployeeRecord } from '../../types/roles';

interface ManagerMonitoringPageProps {
  initialSubTab?: 'live' | 'screenshots' | 'heatmaps';
}

export const ManagerMonitoringPage: React.FC<ManagerMonitoringPageProps> = ({ initialSubTab = 'live' }) => {
  const { user, navigate } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'screenshots' | 'heatmaps'>(initialSubTab);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<EmployeeRecord[]>([]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const loadData = async () => {
    try {
      const [empList, scList] = await Promise.all([
        dataService.getEmployees('manager', user.id),
        dataService.getScreenshots(
          'manager',
          user.id,
          filterEmployeeId === 'all' ? undefined : filterEmployeeId
        ),
      ]);
      setTeamEmployees(empList);
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
  }, [user.id, filterEmployeeId]);

  const handleOpenScreenshot = (sc: ScreenshotItem) => {
    setSelectedScreenshot(sc);
    dataService.logAction(
      user.name,
      'manager',
      'VIEW_SCREENSHOT',
      `${sc.employee_name} (${sc.captured_at})`,
      'Team manager inspected screenshot capture'
    );
  };

  const filteredEmployees = teamEmployees.filter((e) =>
    filterEmployeeId === 'all' ? true : e.id === filterEmployeeId
  );

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
            <span>Team Live Feed</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
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
              <span>Screenshots ({screenshots.length})</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeSubTab === 'heatmaps' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubTab('heatmaps');
                navigate('/manager/monitoring/heatmaps');
              }}
            >
              <span>Heatmaps</span>
            </button>
          </div>

          <button type="button" className="btn-icon-circle" onClick={loadData} title="Refresh captures">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="frosted-card frosted-card-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Team Member:</span>
          <select
            style={{
              background: 'var(--surface-frosted-subdued)',
              border: '1px solid var(--surface-border-subtle)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
            }}
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
          >
            <option value="all">All Team Members</option>
            {teamEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span className="live-telemetry-badge">
            <Calendar size={12} /> Live Sync
          </span>
          <span>&bull;</span>
          <span>Privacy-Preserving Telemetry</span>
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
                    {emp.current_task || 'Visual Studio Code - Sprint Task'}
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
          {filteredEmployees.length === 0 && (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              No team members found.
            </div>
          )}
        </div>
      )}

      {/* 2. Screenshot Card Grid */}
      {activeSubTab === 'screenshots' && (
        <div>
          {screenshots.length === 0 ? (
            <div className="frosted-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No screenshots recorded for your team.
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
                    <div style={{ position: 'absolute', top: 10, right: 10 }} className={`status-pill ${sc.activity_type === 'active' ? 'active' : 'idle'}`}>
                      {sc.activity_type}
                    </div>
                  </div>

                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sc.employee_name || 'Team Member'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {sc.captured_at ? (sc.captured_at.includes(' ') ? sc.captured_at.split(' ')[1] : sc.captured_at) : 'Live'}
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
        <MatrixHeatmap initialPreset="workforce" />
      )}

      {/* Modal */}
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
                    {selectedScreenshot.captured_at} &bull; {selectedScreenshot.window_title}
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
