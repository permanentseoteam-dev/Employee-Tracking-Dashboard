import React, { useState, useEffect } from 'react';
import { RefreshCw, Star } from 'lucide-react';
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Performance & Star Incentives</h1>
          <p className="page-subtitle">
            Configure transparent merit star rules &bull; Multi-factor performance ledger
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Star Rules Configuration */}
        <div className="content-card">
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={16} color="#f59e0b" />
              <span>Automated Star Reward & Penalty Rules</span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Rules evaluate employee telemetry events (punctuality, task completion, sprint quality) and adjust stars automatically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {starRules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{rule.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rule.condition}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: rule.star_delta > 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {rule.star_delta > 0 ? `+${rule.star_delta}` : rule.star_delta} ⭐
                  </span>

                  <button
                    className={`btn ${rule.is_active ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '3px 10px', fontSize: 11 }}
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
        <div className="content-card">
          <div className="content-card-title">
            <span>Employee Star Standings</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Team</th>
                  <th>Active Tracked</th>
                  <th>Total Stars</th>
                </tr>
              </thead>
              <tbody>
                {[...employees]
                  .sort((a, b) => b.stars - a.stars)
                  .map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td>{emp.team_name}</td>
                      <td>{(emp.active_seconds / 3600).toFixed(1)} hrs</td>
                      <td style={{ fontWeight: 700, color: '#f59e0b', fontSize: 14 }}>
                        ⭐ {emp.stars}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
