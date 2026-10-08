import React, { useState, useEffect } from 'react';
import { RefreshCw, X, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { ScreenshotItem, EmployeeRecord } from '../../types/roles';

export const ManagerMonitoringPage: React.FC = () => {
  const { user } = useAuth();
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<EmployeeRecord[]>([]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotItem | null>(null);

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Screenshots & Activity Telemetry</h1>
          <p className="page-subtitle">
            Restricted to {user.team_name || 'assigned team'} &bull; Transparent employee monitoring
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter by Team Member */}
      <div className="content-card" style={{ padding: '12px 18px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Filter by Team Member:</span>
          <select
            className="form-input"
            style={{ width: 220, padding: '6px 10px', fontSize: 13 }}
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
      </div>

      {screenshots.length === 0 ? (
        <div className="content-card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          No screenshots recorded for your team.
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
              }}
              onClick={() => handleOpenScreenshot(sc)}
            >
              <div
                style={{
                  height: 170,
                  backgroundColor: 'var(--bg-surface)',
                  position: 'relative',
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
                  }}
                >
                  {sc.activity_type}
                </span>
              </div>

              <div style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{sc.employee_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sc.captured_at.split(' ')[1]}</span>
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
                >
                  {sc.window_title}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* High-Res Modal */}
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
            style={{ maxWidth: 960, width: '100%', margin: 0, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="content-card-title">
              <div>
                <span>{selectedScreenshot.employee_name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                  Captured: {selectedScreenshot.captured_at} &bull; {selectedScreenshot.window_title}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setSelectedScreenshot(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-medium)', marginBottom: 14 }}>
              <img
                src={selectedScreenshot.high_res_url}
                alt="Full resolution capture"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Size: {(selectedScreenshot.file_size_bytes / 1024).toFixed(1)} KB (Lossy WebP)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
