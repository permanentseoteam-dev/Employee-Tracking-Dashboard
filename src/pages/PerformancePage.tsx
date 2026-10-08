import React from 'react';
import { motion } from 'framer-motion';
import { Keyboard, MousePointer, ShieldCheck, CheckCircle2, Star, Trophy, Activity } from 'lucide-react';
import type { DbStats } from '../types';
import { MatrixHeatmap } from '../components/telemetry/MatrixHeatmap';

interface PerformancePageProps {
  dbStats: DbStats;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ dbStats }) => {
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
            <span>Workforce Analytics</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Performance & Star Rewards
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Gamified sprint accomplishments &bull; Aggregate activity counts &bull; Zero keystroke recording policy
          </p>
        </div>

        <div className="live-telemetry-badge" style={{ background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}>
          <Trophy size={14} />
          <span>Sprint Rank: Exemplary</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid-telemetry-row">
        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Star Balance</span>
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
          </div>
          <div className="stat-numeric-md" style={{ color: '#f59e0b' }}>10 Stars</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>+3 earned this sprint</span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Active Telemetry Windows</span>
            <Keyboard size={16} color="var(--color-primary)" />
          </div>
          <div className="stat-numeric-md">{dbStats.activity_records_count || 140}</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>60-second telemetry aggregates</span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Productivity Ratio</span>
            <CheckCircle2 size={16} color="var(--status-success)" />
          </div>
          <div className="stat-numeric-md" style={{ color: 'var(--status-success)' }}>94.2%</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Active keyboard & mouse ratio</span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Security Guarantee</span>
            <ShieldCheck size={16} color="var(--status-success)" />
          </div>
          <div className="stat-numeric-md" style={{ fontSize: 18 }}>Aggregates Only</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Zero raw characters stored</span>
        </div>
      </div>

      {/* Interactive Telemetry Heatmap Matrix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
          <Activity size={18} color="var(--color-secondary)" />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Employee Workstation Activity & Cadence Heatmap
          </h2>
        </div>
        <MatrixHeatmap initialPreset="hourly" />
      </div>

      {/* Aggregate Specification Table */}
      <div className="frosted-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Telemetry Privacy Architecture</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Transparent specification of metrics collected by Rust daemon</span>
          </div>
          <span className="status-pill active">Verified Compliant</span>
        </div>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Metric Category</th>
                <th>Collection Mechanism</th>
                <th>Database Payload</th>
                <th>Privacy Guarantee</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Keyboard size={15} color="var(--color-primary)" />
                    <span>Keyboard Activity</span>
                  </div>
                </td>
                <td>Low-level OS hook event counter</td>
                <td><code>key_press_count: integer</code></td>
                <td style={{ color: 'var(--status-success)', fontWeight: 600 }}>Character codes discarded immediately</td>
              </tr>
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <MousePointer size={15} color="var(--color-primary)" />
                    <span>Mouse Movement & Clicks</span>
                  </div>
                </td>
                <td>Low-level mouse hook counter</td>
                <td><code>mouse_moves, mouse_clicks</code></td>
                <td style={{ color: 'var(--status-success)', fontWeight: 600 }}>No coordinates or passwords stored</td>
              </tr>
              <tr>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <ShieldCheck size={15} color="var(--color-primary)" />
                    <span>Idle Detection</span>
                  </div>
                </td>
                <td><code>GetLastInputInfo</code> Win32 API</td>
                <td><code>active_seconds, idle_seconds</code></td>
                <td style={{ color: 'var(--status-success)', fontWeight: 600 }}>Non-invasive system uptime counter comparison</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
