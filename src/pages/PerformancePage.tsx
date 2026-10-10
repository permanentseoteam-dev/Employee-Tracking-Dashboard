import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Keyboard, CheckCircle2, Star, Trophy, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MatrixHeatmap } from '../components/telemetry/MatrixHeatmap';
import { KeyboardActivityView } from '../components/telemetry/KeyboardActivityView';
import { BreakScheduleBanner } from '../components/telemetry/BreakScheduleBanner';
import { dataService } from '../services/dataService';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { useOfficeHours } from '../hooks/useOfficeHours';
import type { DbStats } from '../types';

interface PerformancePageProps {
  dbStats: DbStats;
}

export const PerformancePage: React.FC<PerformancePageProps> = () => {
  const { user } = useAuth();
  const { workStartFormatted, workEndFormatted } = useOfficeHours();
  const [activeTab, setActiveTab] = useState<'merits' | 'heatmap' | 'keyboard'>('merits');
  const [telemetryStats, setTelemetryStats] = useState({
    stars: 0,
    activeWindowsCount: 0,
    productivityRatio: '--',
    activeHours: 0,
    idleHours: 0,
  });

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const stats = await dataService.getEmployeeTelemetryStats(user.id);
      setTelemetryStats(stats);
    } catch (e) {
      console.error('Failed to load employee telemetry stats:', e);
    }
  }, [user?.id]);

  useAppRefresh(loadStats);

  useEffect(() => {
    loadStats();
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'activity_aggregates' || payload.table === 'employee_star_balances') {
        loadStats();
      }
    });
    return () => unsubscribe();
  }, [loadStats]);

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
            <span>Workforce Analytics &bull; Shift {workStartFormatted} – {workEndFormatted}</span>
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
            <span>
              {telemetryStats.stars > 5
                ? 'Sprint Rank: Exemplary'
                : telemetryStats.stars > 0
                  ? 'Sprint Rank: Active'
                  : 'Sprint Rank: Standard'}
            </span>
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
              <div className="stat-numeric-md" style={{ color: '#f59e0b' }}>
                {telemetryStats.stars} Stars
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {telemetryStats.stars > 0 ? `${telemetryStats.stars} earned this sprint` : 'No stars awarded yet'}
              </span>
            </div>

            <div className="frosted-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Active Telemetry Windows</span>
                <Keyboard size={16} color="var(--color-primary)" />
              </div>
              <div className="stat-numeric-md">
                {telemetryStats.activeWindowsCount}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {telemetryStats.activeWindowsCount > 0 ? '60-second telemetry aggregates' : 'No telemetry recorded today'}
              </span>
            </div>

            <div className="frosted-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Productivity Ratio</span>
                <CheckCircle2 size={16} color="var(--status-success)" />
              </div>
              <div
                className="stat-numeric-md"
                style={{
                  color: telemetryStats.productivityRatio !== '--' ? 'var(--status-success)' : 'var(--text-muted)',
                }}
              >
                {telemetryStats.productivityRatio}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {telemetryStats.productivityRatio !== '--' ? 'Active keyboard & mouse ratio' : 'Pending workstation activity'}
              </span>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};
