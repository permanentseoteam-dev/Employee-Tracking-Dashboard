import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Star, Award, Zap, Plus, X, Flame } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { MatrixHeatmap } from '../../components/telemetry/MatrixHeatmap';
import type { StarRuleItem, EmployeeRecord } from '../../types/roles';

export const AdminPerformancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'heatmap'>('rules');
  const [starRules, setStarRules] = useState<StarRuleItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  
  // Award Stars Modal State
  const [isAwardOpen, setIsAwardOpen] = useState(false);
  const [awardEmpId, setAwardEmpId] = useState('');
  const [awardDelta, setAwardDelta] = useState(3);
  const [awardReason, setAwardReason] = useState('Exemplary sprint contribution and code review quality');

  const loadData = async () => {
    try {
      const [rules, emps] = await Promise.all([
        dataService.getStarRules('admin'),
        dataService.getEmployees('admin'),
      ]);
      setStarRules(rules);
      setEmployees(emps);
      if (emps.length > 0 && !awardEmpId) {
        setAwardEmpId(emps[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleRule = async (rule: StarRuleItem) => {
    try {
      await dataService.updateStarRule('admin', rule.id, rule.star_delta, !rule.is_active);
      dataService.logAction(
        'Super Admin',
        'admin',
        'TOGGLE_STAR_RULE',
        rule.name,
        `Status set to ${!rule.is_active ? 'Active' : 'Disabled'}`
      );
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAwardStars = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardEmpId) return;

    try {
      await dataService.awardEmployeeStars('admin', awardEmpId, awardDelta, awardReason, 'Super Admin');
      setIsAwardOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

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
            <Award size={14} color="var(--color-secondary)" />
            <span>Merit & Incentives Engine</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Performance & Star Incentives
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Configure transparent merit star rules and monitor the organization-wide multi-factor performance ledger
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              <Award size={14} />
              <span>Merit Rules & Stars</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeTab === 'heatmap' ? 'active' : ''}`}
              onClick={() => setActiveTab('heatmap')}
            >
              <Flame size={14} />
              <span>Activity Heatmap</span>
            </button>
          </div>

          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="btn-pill btn-pill-primary" onClick={() => setIsAwardOpen(true)}>
            <Plus size={15} />
            <span>Award Stars</span>
          </button>
        </div>
      </div>

      {activeTab === 'heatmap' ? (
        <MatrixHeatmap initialPreset="hourly" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Star Rules Configuration */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} color="var(--color-secondary)" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Automated Star Reward & Penalty Rules</span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Rules evaluate employee telemetry events (punctuality, task completions, sprint deliverables) and adjust stars automatically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {starRules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--surface-frosted-subdued)',
                  borderRadius: 'var(--radius-card-sm)',
                  border: '1px solid var(--surface-border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{rule.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{rule.condition}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: rule.star_delta > 0 ? 'var(--status-success)' : 'var(--status-error)',
                    }}
                  >
                    {rule.star_delta > 0 ? `+${rule.star_delta}` : rule.star_delta} ⭐
                  </span>

                  <button
                    type="button"
                    className={`btn-pill ${rule.is_active ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
                    style={{ padding: '4px 12px', fontSize: 11 }}
                    onClick={() => handleToggleRule(rule)}
                  >
                    {rule.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Star Balances */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={18} color="#f59e0b" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Employee Star Standings</span>
            </div>
            <span className="live-telemetry-badge">{employees.length} members</span>
          </div>

          <div className="stitch-table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Rank & Member</th>
                  <th>Team</th>
                  <th>Active Tracked</th>
                  <th style={{ textAlign: 'right' }}>Total Stars</th>
                </tr>
              </thead>
              <tbody>
                {[...(employees || [])]
                  .sort((a, b) => (b?.stars || 0) - (a?.stars || 0))
                  .map((emp, index) => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: index < 3 ? 'var(--color-secondary)' : 'var(--text-muted)', width: 16 }}>
                            #{index + 1}
                          </span>
                          <div className="avatar-chip" style={{ width: 26, height: 26, fontSize: 10 }}>
                            {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</span>
                        </div>
                      </td>
                      <td>{emp.team_name}</td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {(((emp?.active_seconds || 0) / 3600)).toFixed(1)} hrs
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#f59e0b', fontSize: 14 }}>
                        ⭐ {emp?.stars ?? 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      {/* Award Stars Modal */}
      {isAwardOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsAwardOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={18} color="#f59e0b" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Award Merit Stars</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsAwardOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAwardStars} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Select Employee</label>
                <select
                  className="stitch-select"
                  value={awardEmpId}
                  onChange={(e) => setAwardEmpId(e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.team_name}) — Current: ⭐ {emp.stars}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Merit Stars Amount</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`btn-pill ${awardDelta === num ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
                      style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
                      onClick={() => setAwardDelta(num)}
                    >
                      +{num} ⭐
                    </button>
                  ))}
                </div>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Reason / Justification</label>
                <textarea
                  className="stitch-input"
                  style={{ minHeight: 70, resize: 'vertical' }}
                  required
                  value={awardReason}
                  onChange={(e) => setAwardReason(e.target.value)}
                  placeholder="e.g. Exceptional leadership during sprint deployment"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsAwardOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Grant Stars
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
