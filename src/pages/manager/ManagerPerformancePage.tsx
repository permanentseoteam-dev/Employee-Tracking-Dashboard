import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Award, Star, Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord } from '../../types/roles';

export const ManagerPerformancePage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  
  // Award Stars Modal State
  const [isAwardOpen, setIsAwardOpen] = useState(false);
  const [awardEmpId, setAwardEmpId] = useState('');
  const [awardDelta, setAwardDelta] = useState(2);
  const [awardReason, setAwardReason] = useState('Completed milestone tasks ahead of schedule');

  const loadData = async () => {
    try {
      const list = await dataService.getEmployees('manager', user.id);
      setEmployees(list);
      if (list.length > 0 && !awardEmpId) {
        setAwardEmpId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const handleAwardStars = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardEmpId) return;

    try {
      await dataService.awardEmployeeStars('manager', awardEmpId, awardDelta, awardReason, user.name);
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
            <span>Team Output & Merit Standings</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Team Performance & Star Ledger
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Holistic output indicators for <strong style={{ color: 'var(--text-primary)' }}>{user.team_name || 'assigned team'}</strong> with transparent merit stars
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* Main Table Card */}
      <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Team Output & Telemetry Summary</span>
            <span className="live-telemetry-badge">{employees.length} members</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Metrics combine attendance punctuality, task completion consistency, and merit incentives. Keystrokes/mouse counts are activity indicators rather than an opaque productivity score.
        </p>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Attendance Punctuality</th>
                <th>Tracked Active Hours</th>
                <th>Idle Time Today</th>
                <th>Current Stars</th>
                <th style={{ textAlign: 'right' }}>Current Sprint Task</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar-chip" style={{ width: 28, height: 28, fontSize: 10 }}>
                        {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        emp.attendance_status === 'on_time'
                          ? 'active'
                          : 'late'
                      }`}
                    >
                      {(emp?.attendance_status || 'on_time').replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {(((emp?.active_seconds || 0) / 3600)).toFixed(1)} hrs
                  </td>
                  <td style={{ color: (emp?.idle_seconds || 0) > 3600 ? 'var(--status-warning)' : 'var(--text-muted)' }}>
                    {(((emp?.idle_seconds || 0) / 3600)).toFixed(1)} hrs
                  </td>
                  <td style={{ fontWeight: 800, color: '#f59e0b', fontSize: 14 }}>
                    ⭐ {emp?.stars ?? 0}
                  </td>
                  <td style={{ textAlign: 'right', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {emp.current_task || 'Idle / No active task'}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No team members assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Award Stars Modal */}
      {isAwardOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsAwardOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={18} color="#f59e0b" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Award Team Stars</span>
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
                <label className="stitch-label">Team Member</label>
                <select
                  className="stitch-select"
                  value={awardEmpId}
                  onChange={(e) => setAwardEmpId(e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — Current: ⭐ {emp.stars}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Merit Stars Amount</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 5].map((num) => (
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
                  placeholder="e.g. Great velocity and milestone delivery"
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
                  Award Stars
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
