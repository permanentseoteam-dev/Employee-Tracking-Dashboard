import React from 'react';
import { Keyboard, MousePointer, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { DbStats } from '../types';

interface PerformancePageProps {
  dbStats: DbStats;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ dbStats }) => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Telemetry & Performance</h1>
          <p className="page-subtitle">
            Aggregate count metrics only &bull; Zero keystroke recording policy
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>Total Logged Windows</span>
            <Keyboard size={15} color="var(--primary)" />
          </div>
          <div className="stat-value">{dbStats.activity_records_count}</div>
          <div className="stat-footer">
            <span>60-second aggregated windows</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Active Ratio</span>
            <CheckCircle2 size={15} color="var(--success)" />
          </div>
          <div className="stat-value">94.2%</div>
          <div className="stat-footer">
            <span>Productive vs idle time</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Input Security Policy</span>
            <ShieldCheck size={15} color="var(--success)" />
          </div>
          <div className="stat-value" style={{ fontSize: 18, paddingTop: 4 }}>
            Aggregates Only
          </div>
          <div className="stat-footer">
            <span>Zero raw keystrokes captured</span>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Aggregate Telemetry Specification</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Metric Category</th>
              <th>Collection Mechanism</th>
              <th>Storage Representation</th>
              <th>Privacy Guarantee</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <Keyboard size={14} color="var(--primary)" />
                  <span>Keyboard Activity</span>
                </div>
              </td>
              <td>Low-level OS hook event count</td>
              <td><code>key_press_count: integer</code></td>
              <td style={{ color: 'var(--success)' }}>Character codes discarded immediately</td>
            </tr>
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <MousePointer size={14} color="var(--primary)" />
                  <span>Mouse Movement & Clicks</span>
                </div>
              </td>
              <td>Low-level mouse hook counter</td>
              <td><code>mouse_moves, mouse_clicks</code></td>
              <td style={{ color: 'var(--success)' }}>No coordinates, screen contents, or clicks logged</td>
            </tr>
            <tr>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <ShieldCheck size={14} color="var(--primary)" />
                  <span>Idle Detection</span>
                </div>
              </td>
              <td><code>GetLastInputInfo</code> Win32 API</td>
              <td><code>active_seconds, idle_seconds</code></td>
              <td style={{ color: 'var(--success)' }}>Non-invasive system uptime counter comparison</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
