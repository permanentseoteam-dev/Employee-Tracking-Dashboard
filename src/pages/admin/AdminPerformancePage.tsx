import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Star, Award, Zap } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { StarRuleItem, EmployeeRecord } from '../../types/roles';

export const AdminPerformancePage: React.FC = () => {
  const [starRules, setStarRules] = useState<StarRuleItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const loadData = async () => {
    try {
      const [rules, emps] = await Promise.all([
        dataService.getStarRules('admin'),
        dataService.getEmployees('admin'),
      ]);
      setStarRules(rules);
      setEmployees(emps);
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

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
    </motion.div>
  );
};
