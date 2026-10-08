import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Award, Star, Plus, Minus, X, Flame, Sliders } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { MatrixHeatmap } from '../../components/telemetry/MatrixHeatmap';
import type { EmployeeRecord } from '../../types/roles';

export const ManagerPerformancePage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ledger' | 'heatmap'>('ledger');
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  // Star Modal State
  const [isStarModalOpen, setIsStarModalOpen] = useState(false);
  const [starModalMode, setStarModalMode] = useState<'allocate' | 'deallocate'>('allocate');
  const [awardEmpId, setAwardEmpId] = useState('');
  const [awardDelta, setAwardDelta] = useState(2);
  const [awardReason, setAwardReason] = useState('Completed milestone tasks ahead of schedule');

  // Exact Balance Modal State
  const [isEditBalanceOpen, setIsEditBalanceOpen] = useState(false);
  const [balanceEmp, setBalanceEmp] = useState<EmployeeRecord | null>(null);
  const [exactInput, setExactInput] = useState<number>(20);
  const [balanceReason, setBalanceReason] = useState('Team performance target alignment');

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

  const handleOpenStarModal = (mode: 'allocate' | 'deallocate', empId?: string) => {
    setStarModalMode(mode);
    if (empId) setAwardEmpId(empId);
    setAwardDelta(mode === 'allocate' ? 2 : 1);
    setAwardReason(
      mode === 'allocate'
        ? 'Completed sprint deliverables ahead of schedule'
        : 'Missed scheduled team check-in without notice'
    );
    setIsStarModalOpen(true);
  };

  const handleAwardStars = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardEmpId) return;

    const delta = starModalMode === 'allocate' ? Math.abs(awardDelta) : -Math.abs(awardDelta);

    try {
      await dataService.awardEmployeeStars('manager', awardEmpId, delta, awardReason, user.name);
      setIsStarModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleQuickStar = async (emp: EmployeeRecord, delta: number) => {
    try {
      await dataService.awardEmployeeStars(
        'manager',
        emp.id,
        delta,
        delta > 0 ? 'Team star allocation' : 'Team star deduction',
        user.name
      );
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEditBalance = (emp: EmployeeRecord) => {
    setBalanceEmp(emp);
    setExactInput(emp.stars ?? 20);
    setBalanceReason('Team performance target alignment');
    setIsEditBalanceOpen(true);
  };

  const handleSubmitExactBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceEmp) return;

    try {
      await dataService.setEmployeeStars('manager', balanceEmp.id, exactInput, balanceReason, user.name);
      setIsEditBalanceOpen(false);
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
            Allocate and deallocate merit stars for <strong style={{ color: 'var(--text-primary)' }}>{user.team_name || 'Core Backend Team'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
            >
              <Award size={14} />
              <span>Team Merit Ledger</span>
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
          <button
            className="btn-pill btn-pill-primary"
            style={{ background: '#10b981', color: '#ffffff', border: 'none' }}
            onClick={() => handleOpenStarModal('allocate')}
          >
            <Plus size={15} />
            <span>Allocate Stars</span>
          </button>
          <button
            className="btn-pill"
            style={{ background: '#ef4444', color: '#ffffff', border: 'none' }}
            onClick={() => handleOpenStarModal('deallocate')}
          >
            <Minus size={15} />
            <span>Deallocate Stars</span>
          </button>
        </div>
      </div>

      {activeTab === 'heatmap' ? (
        <MatrixHeatmap initialPreset="hourly" />
      ) : (
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="content-card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Team Output & Telemetry Summary</span>
              <span className="live-telemetry-badge">{employees.length} members</span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Metrics combine attendance punctuality, task completions, and merit star balance. You can allocate or deduct stars directly per employee.
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
                  <th>Sprint Task</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
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
                    <td style={{ fontWeight: 800, color: '#f59e0b', fontSize: 15 }}>
                      ⭐ {emp?.stars ?? 0}
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {emp.current_task || 'Desktop Workstation Tracking'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <button
                          type="button"
                          className="btn-icon-circle"
                          style={{ width: 28, height: 28, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'none' }}
                          title="Quick allocate +1 star"
                          onClick={() => handleQuickStar(emp, 1)}
                        >
                          <Plus size={13} strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-circle"
                          style={{ width: 28, height: 28, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none' }}
                          title="Quick deallocate -1 star"
                          onClick={() => handleQuickStar(emp, -1)}
                        >
                          <Minus size={13} strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-circle"
                          style={{ width: 28, height: 28 }}
                          title="Set exact star balance"
                          onClick={() => handleOpenEditBalance(emp)}
                        >
                          <Sliders size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No team members assigned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allocate / Deallocate Stars Modal */}
      {isStarModalOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsStarModalOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={18} color={starModalMode === 'allocate' ? '#10b981' : '#ef4444'} />
                <span style={{ fontSize: 17, fontWeight: 700 }}>
                  {starModalMode === 'allocate' ? 'Allocate Team Stars' : 'Deallocate / Deduct Stars'}
                </span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsStarModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: 8, background: 'var(--surface-frosted-subdued)', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setStarModalMode('allocate')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 6,
                  border: 'none',
                  background: starModalMode === 'allocate' ? '#10b981' : 'transparent',
                  color: starModalMode === 'allocate' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} />
                <span>Allocate (+)</span>
              </button>
              <button
                type="button"
                onClick={() => setStarModalMode('deallocate')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 6,
                  border: 'none',
                  background: starModalMode === 'deallocate' ? '#ef4444' : 'transparent',
                  color: starModalMode === 'deallocate' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Minus size={14} />
                <span>Deallocate (-)</span>
              </button>
            </div>

            <form onSubmit={handleAwardStars} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Team Member</label>
                <select
                  className="stitch-select"
                  value={awardEmpId}
                  onChange={(e) => setAwardEmpId(e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} &bull; Current: ⭐ {emp.stars}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">
                  {starModalMode === 'allocate' ? 'Stars To Allocate' : 'Stars To Deduct'}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`btn-pill ${awardDelta === num ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        fontSize: 12,
                        background:
                          awardDelta === num
                            ? starModalMode === 'allocate'
                              ? '#10b981'
                              : '#ef4444'
                            : undefined,
                        borderColor: awardDelta === num ? 'transparent' : undefined,
                      }}
                      onClick={() => setAwardDelta(num)}
                    >
                      {starModalMode === 'allocate' ? `+${num}` : `-${num}`} ⭐
                    </button>
                  ))}
                </div>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Reason / Feedback</label>
                <textarea
                  className="stitch-input"
                  style={{ minHeight: 70, resize: 'vertical' }}
                  required
                  value={awardReason}
                  onChange={(e) => setAwardReason(e.target.value)}
                  placeholder="e.g. Completed milestone ahead of deadline"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsStarModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-pill"
                  style={{
                    background: starModalMode === 'allocate' ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  {starModalMode === 'allocate'
                    ? `Allocate +${awardDelta} Stars`
                    : `Deallocate -${awardDelta} Stars`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Set Balance Modal */}
      {isEditBalanceOpen && balanceEmp && (
        <div className="stitch-modal-backdrop" onClick={() => setIsEditBalanceOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sliders size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Set Exact Star Balance</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsEditBalanceOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmitExactBalance} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">New Star Balance for {balanceEmp.name}</label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  required
                  className="stitch-input"
                  value={exactInput}
                  onChange={(e) => setExactInput(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Reason</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsEditBalanceOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Save Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
