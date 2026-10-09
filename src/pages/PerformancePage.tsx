import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Keyboard, MousePointer, ShieldCheck, CheckCircle2, Star, Trophy, Activity, Flame, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MatrixHeatmap } from '../components/telemetry/MatrixHeatmap';
import { KeyboardActivityView } from '../components/telemetry/KeyboardActivityView';
import type { DbStats } from '../types';

interface PerformancePageProps {
  dbStats: DbStats;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ dbStats }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'merits' | 'heatmap' | 'keyboard'>('merits');

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
            <span>Workforce Analytics &bull; Shift 09:00 AM – 05:00 PM</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Performance & Telemetry
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Sprint accomplishments &bull; Keystroke counts &bull; Mouse heatmap &bull; Verified Coffee & Namaz schedule
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeTab === 'merits' ? 'active' : ''}`}
              onClick={() => setActiveTab('merits')}
            >
              <Trophy size={14} />
              <span>Merits & Stars</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeTab === 'heatmap' ? 'active' : ''}`}
              onClick={() => setActiveTab('heatmap')}
            >
              <Flame size={14} />
              <span>Mouse Heatmap</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeTab === 'keyboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('keyboard')}
            >
              <Keyboard size={14} />
              <span>Keyboard Activity</span>
            </button>
          </div>

          <div className="live-telemetry-badge" style={{ background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}>
            <Trophy size={14} />
            <span>Sprint Rank: Exemplary</span>
          </div>
        </div>
      </div>

      {activeTab === 'heatmap' && (
        <MatrixHeatmap
          initialPreset="hourly"
          role="employee"
          showBreakSchedule={true}
          selectedEmployeeName={user?.name || 'Arsal'}
        />
      )}

      {activeTab === 'keyboard' && (
        <KeyboardActivityView
          role="employee"
          showBreakSchedule={true}
          selectedEmployeeName={user?.name || 'Arsal'}
        />
      )}

      {activeTab === 'merits' && (
        <>
          {/* Coffee & Namaz Break Schedule Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 'var(--radius-card-sm)',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.22)',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: 'var(--color-primary)' }}>
                <Clock size={14} />
                <span>OFFICIAL RECESS & BREAK SCHEDULE:</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(245, 158, 11, 0.14)',
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <span>☕</span>
                <span>Coffee Break: 11:00 AM – 11:30 AM</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <span>🕌</span>
                <span>Zuhr Namaz & Lunch: 01:00 PM – 02:00 PM</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(139, 92, 246, 0.14)',
                  color: '#7c3aed',
                  border: '1px solid rgba(139, 92, 246, 0.28)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <span>🕌</span>
                <span>Asr Prayer: 04:30 PM – 04:45 PM</span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Excused from telemetry minimums
            </span>
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

      {/* Personal Sprint Merit Achievements & Milestones */}
      <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--color-secondary)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Personal Sprint Merit Achievements</span>
          </div>
          <span className="status-pill active" style={{ fontSize: 11, padding: '2px 10px' }}>
            Verified Contributions
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Your individual sprint accomplishments and awarded stars based on deliverable milestones, clean code reviews, and on-time attendance.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-card-sm)',
              background: 'var(--surface-frosted-subdued)',
              border: '1px solid var(--surface-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Sprint Task Delivery</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Completed sprint deliverables ahead of target date</div>
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--status-success)' }}>+3 ⭐</span>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-card-sm)',
              background: 'var(--surface-frosted-subdued)',
              border: '1px solid var(--surface-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Punctual Check-In Streak</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>On-time attendance verified 5 days in a row</div>
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--status-success)' }}>+2 ⭐</span>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-card-sm)',
              background: 'var(--surface-frosted-subdued)',
              border: '1px solid var(--surface-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Architecture & Code Review</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Exemplary peer review and bug prevention</div>
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--status-success)' }}>+2 ⭐</span>
          </div>
        </div>
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
        </>
      )}
    </motion.div>
  );
};
