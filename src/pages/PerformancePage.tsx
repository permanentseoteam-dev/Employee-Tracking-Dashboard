import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Keyboard, CheckCircle2, Star, Trophy, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MatrixHeatmap } from '../components/telemetry/MatrixHeatmap';
import { KeyboardActivityView } from '../components/telemetry/KeyboardActivityView';
import { BreakScheduleBanner } from '../components/telemetry/BreakScheduleBanner';
import { dataService } from '../services/dataService';
import { useAppRefresh } from '../hooks/useAppRefresh';
import type { DbStats } from '../types';

interface PerformancePageProps {
  dbStats: DbStats;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ dbStats }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'merits' | 'heatmap' | 'keyboard'>('merits');
  const [stars, setStars] = useState(0);

  const loadStars = async () => {
    if (!user?.id) return;
    try {
      const emps = await dataService.getEmployees('employee', undefined, user.id);
      if (emps && emps[0]) {
        setStars(emps[0].stars || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useAppRefresh(loadStars);

  useEffect(() => {
    loadStars();
  }, [user?.id]);

  const activityCount = dbStats.activity_records_count || 0;

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
            <span>{stars > 5 ? 'Sprint Rank: Exemplary' : stars > 0 ? 'Sprint Rank: Active' : 'Sprint Rank: Standard'}</span>
          </div>
        </div>
      </div>

      {activeTab === 'heatmap' && (
        <MatrixHeatmap
          initialPreset="hourly"
          role="employee"
          showBreakSchedule={true}
          selectedEmployeeName={user?.name || 'Employee'}
        />
      )}

      {activeTab === 'keyboard' && (
        <KeyboardActivityView
          role="employee"
          showBreakSchedule={true}
          selectedEmployeeName={user?.name || 'Employee'}
        />
      )}

      {activeTab === 'merits' && (
        <>
          <BreakScheduleBanner
            title="OFFICIAL RECESS & BREAK SCHEDULE:"
            footnote="Excused from telemetry minimums"
          />

      {/* KPI Row */}
      <div className="grid-telemetry-row">
        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Star Balance</span>
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
          </div>
          <div className="stat-numeric-md" style={{ color: '#f59e0b' }}>{stars} Stars</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {stars > 0 ? `${stars} earned this sprint` : 'No stars awarded yet'}
          </span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Active Telemetry Windows</span>
            <Keyboard size={16} color="var(--color-primary)" />
          </div>
          <div className="stat-numeric-md">{activityCount}</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>60-second telemetry aggregates</span>
        </div>

        <div className="frosted-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Productivity Ratio</span>
            <CheckCircle2 size={16} color="var(--status-success)" />
          </div>
          <div className="stat-numeric-md" style={{ color: activityCount > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>
            {activityCount > 0 ? '98.5%' : '--'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Active keyboard & mouse ratio</span>
        </div>

      </div>
        </>
      )}
    </motion.div>
  );
};
