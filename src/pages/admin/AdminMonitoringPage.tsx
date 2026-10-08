import React, { useState, useEffect } from 'react';
import { Camera, Flame, RefreshCw, Calendar, Filter, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { ScreenshotItem, EmployeeRecord, HeatmapPoint } from '../../types/roles';

export const AdminMonitoringPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'screenshots' | 'heatmaps'>('screenshots');
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);

  const loadData = async () => {
    try {
      const [empList, scList, heatPoints] = await Promise.all([
        dataService.getEmployees('admin'),
        dataService.getScreenshots('admin', undefined, selectedEmployeeId === 'all' ? undefined : selectedEmployeeId),
        dataService.getHeatmapPoints(selectedEmployeeId === 'all' ? 'emp-001' : selectedEmployeeId),
      ]);
      setEmployees(empList);
      setScreenshots(scList);
      setHeatmapPoints(heatPoints);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmployeeId]);

  const handleOpenScreenshot = (sc: ScreenshotItem) => {
    setSelectedScreenshot(sc);
    dataService.logAction('Super Admin', 'admin', 'VIEW_SCREENSHOT', `${sc.employee_name} (${sc.captured_at})`, 'Inspected full resolution capture');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Monitoring & Telemetry Oversight</h1>
          <p className="page-subtitle">
            Compressed screenshot audit timelines &bull; Activity heatmaps &bull; Low-resolution thumbnails
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 2, border: '1px solid var(--border-medium)' }}>
            <button
              className={`btn ${activeSubTab === 'screenshots' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '6px 12px' }}
              onClick={() => setActiveSubTab('screenshots')}
            >
              <Camera size={14} />
              <span>Screenshots Gallery</span>
            </button>
            <button
              className={`btn ${activeSubTab === 'heatmaps' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '6px 12px' }}
              onClick={() => setActiveSubTab('heatmaps')}
            >
              <Flame size={14} />
              <span>Mouse Heatmaps</span>
            </button>
          </div>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="content-card" style={{ padding: '12px 18px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={15} color="var(--text-muted)" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Filter by Employee:</span>
            <select
              className="form-input"
              style={{ width: 220, padding: '6px 10px', fontSize: 13 }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> Today (2026-10-07)
            </span>
            <span>&bull;</span>
            <span>Thumbnails: Compressed WebP</span>
          </div>
        </div>
      </div>

      {/* Screenshots Tab */}
      {activeSubTab === 'screenshots' && (
        <div>
          {screenshots.length === 0 ? (
            <div className="content-card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              No screenshots recorded for selected filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {screenshots.map((sc) => (
                <div
                  key={sc.id}
                  className="content-card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                  }}
                  onClick={() => handleOpenScreenshot(sc)}
                >
                  {/* Thumbnail Image Container */}
                  <div
                    style={{
                      height: 170,
                      backgroundColor: 'var(--bg-surface)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <img
                      src={sc.thumbnail_url}
                      alt={sc.window_title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor: sc.activity_type === 'active' ? 'var(--success-bg)' : 'var(--warning-bg)',
                        color: sc.activity_type === 'active' ? 'var(--success)' : 'var(--warning)',
                        border: '1px solid rgba(0,0,0,0.2)',
                      }}
                    >
                      {sc.activity_type}
                    </span>
                  </div>

                  {/* Metadata Footer */}
                  <div style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{sc.employee_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sc.captured_at.split(' ')[1]}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {sc.team_name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        backgroundColor: 'var(--bg-surface)',
                        padding: '4px 8px',
                        borderRadius: 4,
                      }}
                      title={sc.window_title}
                    >
                      {sc.window_title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Heatmaps Tab */}
      {activeSubTab === 'heatmaps' && (
        <div className="content-card">
          <div className="content-card-title">
            <span>Mouse Activity Heatmap Reconstruction</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Normalized (1920x1080) input windows</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Visualizes aggregated cursor positions and click clusters collected transparently during active tracking periods.
          </p>

          <div
            style={{
              height: 380,
              backgroundColor: '#090d16',
              borderRadius: 'var(--radius-md)',
              position: 'relative',
              border: '1px solid var(--border-medium)',
              overflow: 'hidden',
            }}
          >
            {/* Grid overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* Heatmap clusters */}
            {heatmapPoints.map((pt, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: pt.x,
                  top: pt.y,
                  width: pt.type === 'click' ? 48 : 36,
                  height: pt.type === 'click' ? 48 : 36,
                  borderRadius: '50%',
                  background:
                    pt.type === 'click'
                      ? 'radial-gradient(circle, rgba(239, 68, 68, 0.8) 0%, rgba(245, 158, 11, 0.4) 50%, transparent 75%)'
                      : 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, rgba(16, 185, 129, 0.3) 50%, transparent 75%)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              />
            ))}

            <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444' }} /> Mouse Clicks
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Cursor Movement Paths
              </span>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution Screenshot Modal */}
      {selectedScreenshot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="content-card"
            style={{
              maxWidth: 960,
              width: '100%',
              margin: 0,
              padding: 20,
              backgroundColor: 'var(--bg-card)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="content-card-title">
              <div>
                <span style={{ fontSize: 16 }}>{selectedScreenshot.employee_name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                  Captured at {selectedScreenshot.captured_at} &bull; {selectedScreenshot.window_title}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setSelectedScreenshot(null)}>
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-medium)',
                marginBottom: 14,
              }}
            >
              <img
                src={selectedScreenshot.high_res_url}
                alt="Full Resolution Screenshot"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Local Path: {selectedScreenshot.file_path}</span>
              <span>Size: {(selectedScreenshot.file_size_bytes / 1024).toFixed(1)} KB (WebP Lossy 80)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
