import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Star,
  Award,
  Zap,
  Plus,
  Minus,
  X,
  Flame,
  Edit2,
  Trash2,
  Sliders,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { MatrixHeatmap } from '../../components/telemetry/MatrixHeatmap';
import type { StarRuleItem, EmployeeRecord } from '../../types/roles';

export const AdminPerformancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'heatmap'>('rules');
  const [starRules, setStarRules] = useState<StarRuleItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  // Allocate / Deallocate Stars Modal State
  const [isStarModalOpen, setIsStarModalOpen] = useState(false);
  const [starModalMode, setStarModalMode] = useState<'allocate' | 'deallocate'>('allocate');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [starAmount, setStarAmount] = useState(3);
  const [starReason, setStarReason] = useState('Sprint deliverables completed ahead of time with zero regressions');

  // Direct Edit Exact Stars Modal State
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [editBalanceEmp, setEditBalanceEmp] = useState<EmployeeRecord | null>(null);
  const [exactBalanceInput, setExactBalanceInput] = useState<number>(20);
  const [balanceEditReason, setBalanceEditReason] = useState('Administrative baseline realignment');

  // Add / Edit Star Rule Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleCondition, setRuleCondition] = useState('');
  const [ruleDelta, setRuleDelta] = useState(2);
  const [ruleIsActive, setRuleIsActive] = useState(true);

  const loadData = async () => {
    try {
      const [rules, emps] = await Promise.all([
        dataService.getStarRules('admin'),
        dataService.getEmployees('admin'),
      ]);
      setStarRules(rules);
      setEmployees(emps);
      if (emps.length > 0 && !selectedEmpId) {
        setSelectedEmpId(emps[0].id);
      }
    } catch (err) {
      console.error('Error loading performance data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Toggle Rule Active/Disabled
  const handleToggleRule = async (rule: StarRuleItem) => {
    try {
      await dataService.updateStarRule('admin', rule.id, rule.star_delta, !rule.is_active);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 2. Open Star Allocate / Deallocate Modal
  const handleOpenStarModal = (mode: 'allocate' | 'deallocate', empId?: string) => {
    setStarModalMode(mode);
    if (empId) setSelectedEmpId(empId);
    setStarAmount(mode === 'allocate' ? 3 : 2);
    setStarReason(
      mode === 'allocate'
        ? 'Sprint deliverables completed ahead of time with high code quality'
        : 'Excessive unexcused idle period during active telemetry window'
    );
    setIsStarModalOpen(true);
  };

  // 3. Submit Star Allocation / Deallocation
  const handleSubmitStarAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;

    const delta = starModalMode === 'allocate' ? Math.abs(starAmount) : -Math.abs(starAmount);

    try {
      await dataService.awardEmployeeStars('admin', selectedEmpId, delta, starReason, 'Super Admin');
      setIsStarModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 4. Quick Inline Single Star Change (+1 or -1)
  const handleQuickStarChange = async (emp: EmployeeRecord, delta: number) => {
    try {
      await dataService.awardEmployeeStars(
        'admin',
        emp.id,
        delta,
        delta > 0 ? 'Quick star allocation' : 'Quick star deduction',
        'Super Admin'
      );
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 5. Open Direct Edit Balance Modal
  const handleOpenEditBalance = (emp: EmployeeRecord) => {
    setEditBalanceEmp(emp);
    setExactBalanceInput(emp.stars ?? 20);
    setBalanceEditReason('Administrative star balance adjustment');
    setIsEditBalanceModalOpen(true);
  };

  // 6. Submit Exact Balance Edit
  const handleSubmitExactBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBalanceEmp) return;

    try {
      await dataService.setEmployeeStars(
        'admin',
        editBalanceEmp.id,
        exactBalanceInput,
        balanceEditReason,
        'Super Admin'
      );
      setIsEditBalanceModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 7. Open Create New Star Rule Modal
  const handleOpenCreateRule = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleCondition('');
    setRuleDelta(2);
    setRuleIsActive(true);
    setIsRuleModalOpen(true);
  };

  // 8. Open Edit Star Rule Modal
  const handleOpenEditRule = (rule: StarRuleItem) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleCondition(rule.condition);
    setRuleDelta(rule.star_delta);
    setRuleIsActive(rule.is_active);
    setIsRuleModalOpen(true);
  };

  // 9. Save Rule (Add or Edit)
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    try {
      if (editingRuleId) {
        await dataService.updateStarRuleFull('admin', editingRuleId, {
          name: ruleName.trim(),
          condition: ruleCondition.trim(),
          star_delta: ruleDelta,
          is_active: ruleIsActive,
        });
      } else {
        await dataService.addStarRule('admin', {
          name: ruleName.trim(),
          condition: ruleCondition.trim(),
          star_delta: ruleDelta,
          is_active: ruleIsActive,
        });
      }

      setIsRuleModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 10. Delete Rule
  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Delete this merit star rule?')) return;
    try {
      await dataService.deleteStarRule('admin', id);
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
            Allocate and deallocate stars, configure automated merit rules, and manage employee standings with complete editability
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

          <button className="btn-pill btn-pill-secondary" onClick={loadData} title="Refresh performance standings">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button
            className="btn-pill btn-pill-primary"
            style={{ background: '#10b981', color: '#ffffff', border: 'none' }}
            onClick={() => handleOpenStarModal('allocate')}
            title="Allocate merit stars to an employee"
          >
            <Plus size={15} />
            <span>Allocate Stars</span>
          </button>
          <button
            className="btn-pill"
            style={{ background: '#ef4444', color: '#ffffff', border: 'none' }}
            onClick={() => handleOpenStarModal('deallocate')}
            title="Deallocate / deduct merit stars from an employee"
          >
            <Minus size={15} />
            <span>Deallocate Stars</span>
          </button>
        </div>
      </div>

      {activeTab === 'heatmap' ? (
        <MatrixHeatmap initialPreset="hourly" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
          {/* Star Rules Configuration (Fully Editable) */}
          <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Automated Star Reward & Penalty Rules</span>
              </div>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={handleOpenCreateRule}
                title="Add custom star rule"
              >
                <Plus size={13} />
                <span>Add Rule</span>
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Rules evaluate telemetry events and apply star adjustments automatically. Click any rule to edit its condition, name, or points delta.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
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
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{rule.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{rule.condition}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        color: rule.star_delta > 0 ? 'var(--status-success)' : 'var(--status-error)',
                        minWidth: 48,
                        textAlign: 'right',
                      }}
                    >
                      {rule.star_delta > 0 ? `+${rule.star_delta}` : rule.star_delta} ⭐
                    </span>

                    <button
                      type="button"
                      className={`btn-pill ${rule.is_active ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
                      style={{ padding: '3px 10px', fontSize: 11 }}
                      onClick={() => handleToggleRule(rule)}
                      title="Toggle rule status"
                    >
                      {rule.is_active ? 'Active' : 'Disabled'}
                    </button>

                    <button
                      type="button"
                      className="btn-icon-circle"
                      style={{ width: 28, height: 28 }}
                      onClick={() => handleOpenEditRule(rule)}
                      title="Edit rule"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn-icon-circle"
                      style={{ width: 28, height: 28, color: 'var(--status-error)' }}
                      onClick={() => handleDeleteRule(rule.id)}
                      title="Delete rule"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Employee Star Standings & Allocation Table */}
          <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={18} color="#f59e0b" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>Employee Star Standings</span>
              </div>
              <span className="live-telemetry-badge">{employees.length} active</span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Allocate or deduct stars on-demand, or directly edit star balances using the quick adjustment controls.
            </p>

            <div className="stitch-table-wrapper">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Rank & Employee</th>
                    <th>Team</th>
                    <th>Total Stars</th>
                    <th style={{ textAlign: 'right' }}>Adjust / Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(employees || [])]
                    .sort((a, b) => (b?.stars || 0) - (a?.stars || 0))
                    .map((emp, index) => (
                      <tr key={emp.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: index === 0 ? '#f59e0b' : 'var(--text-muted)', width: 16 }}>
                              #{index + 1}
                            </span>
                            <div className="avatar-chip" style={{ width: 28, height: 28, fontSize: 10 }}>
                              {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{emp.team_name}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, color: '#f59e0b', fontSize: 15 }}>
                            <span>⭐</span>
                            <span>{emp?.stars ?? 0}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            {/* Quick +1 Star */}
                            <button
                              type="button"
                              className="btn-icon-circle"
                              style={{ width: 28, height: 28, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'none' }}
                              title="Quick allocate +1 star"
                              onClick={() => handleQuickStarChange(emp, 1)}
                            >
                              <Plus size={13} strokeWidth={3} />
                            </button>

                            {/* Quick -1 Star */}
                            <button
                              type="button"
                              className="btn-icon-circle"
                              style={{ width: 28, height: 28, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none' }}
                              title="Quick deallocate -1 star"
                              onClick={() => handleQuickStarChange(emp, -1)}
                            >
                              <Minus size={13} strokeWidth={3} />
                            </button>

                            {/* Direct Set Balance */}
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
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 1. Allocate & Deallocate Stars Modal */}
      {isStarModalOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsStarModalOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={18} color={starModalMode === 'allocate' ? '#10b981' : '#ef4444'} />
                <span style={{ fontSize: 17, fontWeight: 700 }}>
                  {starModalMode === 'allocate' ? 'Allocate Merit Stars' : 'Deallocate / Deduct Stars'}
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
                <span>Allocate Stars (+)</span>
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
                <span>Deallocate Stars (-)</span>
              </button>
            </div>

            <form onSubmit={handleSubmitStarAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Select Employee</label>
                <select
                  className="stitch-select"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.team_name}) &bull; Current: ⭐ {emp.stars}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">
                  {starModalMode === 'allocate' ? 'Stars To Allocate' : 'Stars To Deduct'}
                </label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {(starModalMode === 'allocate' ? [1, 2, 3, 5, 10] : [1, 2, 3, 5, 10]).map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`btn-pill ${starAmount === num ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        fontSize: 12,
                        background:
                          starAmount === num
                            ? starModalMode === 'allocate'
                              ? '#10b981'
                              : '#ef4444'
                            : undefined,
                        borderColor: starAmount === num ? 'transparent' : undefined,
                      }}
                      onClick={() => setStarAmount(num)}
                    >
                      {starModalMode === 'allocate' ? `+${num}` : `-${num}`} ⭐
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Or custom:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="stitch-input"
                    style={{ width: 100, height: 34 }}
                    value={starAmount}
                    onChange={(e) => setStarAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: starModalMode === 'allocate' ? '#10b981' : '#ef4444' }}>
                    {starModalMode === 'allocate' ? `+${starAmount}` : `-${starAmount}`} ⭐
                  </span>
                </div>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Reason / Justification Memo</label>
                <textarea
                  className="stitch-input"
                  style={{ minHeight: 70, resize: 'vertical' }}
                  required
                  value={starReason}
                  onChange={(e) => setStarReason(e.target.value)}
                  placeholder={
                    starModalMode === 'allocate'
                      ? 'e.g. Exceptional leadership during sprint deployment'
                      : 'e.g. Repeated late arrival without prior notice'
                  }
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
                    ? `Allocate +${starAmount} Stars`
                    : `Deallocate -${starAmount} Stars`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Direct Edit Exact Star Balance Modal */}
      {isEditBalanceModalOpen && editBalanceEmp && (
        <div className="stitch-modal-backdrop" onClick={() => setIsEditBalanceModalOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sliders size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Set Exact Star Balance</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsEditBalanceModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Directly set total star balance for <strong>{editBalanceEmp.name}</strong>.
            </p>

            <form onSubmit={handleSubmitExactBalance} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">New Exact Total Stars</label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  required
                  className="stitch-input"
                  value={exactBalanceInput}
                  onChange={(e) => setExactBalanceInput(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Reason for Balance Realignment</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  value={balanceEditReason}
                  onChange={(e) => setBalanceEditReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsEditBalanceModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Save Exact Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add / Edit Star Rule Modal */}
      {isRuleModalOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsRuleModalOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>
                  {editingRuleId ? 'Edit Star Rule' : 'Create New Star Rule'}
                </span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsRuleModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Rule Title</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  placeholder="e.g. Code Review Champion"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Trigger Condition</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  placeholder="e.g. Complete 5+ peer reviews in sprint"
                  value={ruleCondition}
                  onChange={(e) => setRuleCondition(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Star Delta (Reward or Penalty)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    required
                    className="stitch-input"
                    style={{ width: 120 }}
                    value={ruleDelta}
                    onChange={(e) => setRuleDelta(parseInt(e.target.value) || 0)}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: ruleDelta > 0 ? 'var(--status-success)' : 'var(--status-error)',
                    }}
                  >
                    {ruleDelta > 0 ? `+${ruleDelta}` : ruleDelta} ⭐ {ruleDelta > 0 ? '(Reward)' : '(Deduction)'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id="ruleActiveCheck"
                  checked={ruleIsActive}
                  onChange={(e) => setRuleIsActive(e.target.checked)}
                />
                <label htmlFor="ruleActiveCheck" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Rule is active and evaluates live telemetry
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsRuleModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  {editingRuleId ? 'Save Rule Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
