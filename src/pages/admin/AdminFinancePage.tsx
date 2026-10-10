import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Send, Plus, Search, CheckCircle2, Clock, Lock, Mail, Edit2, Eye, X, CreditCard, TrendingUp, Download, ShieldCheck, Calendar } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import type { EmployeeSalaryRecord, ConfidentialMessageItem } from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
export const AdminFinancePage: React.FC = () => {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<EmployeeSalaryRecord[]>([]);
  const [sentMessages, setSentMessages] = useState<ConfidentialMessageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  // Active Tab: 'salaries' | 'messages'
  const [activeTab, setActiveTab] = useState<'salaries' | 'messages'>('salaries');

  // Edit Salary Modal State
  const [editingRecord, setEditingRecord] = useState<EmployeeSalaryRecord | null>(null);
  const [editBase, setEditBase] = useState<number>(0);
  const [editBonus, setEditBonus] = useState<number>(0);
  const [editDeduct, setEditDeduct] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<EmployeeSalaryRecord['payment_status']>('paid');
  const [editPayDate, setEditPayDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Add Salary Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDept, setNewDept] = useState('Engineering');
  const [newTeam, setNewTeam] = useState('Core Team');
  const [newBaseSalary, setNewBaseSalary] = useState<number>(5500);
  const [newBonus, setNewBonus] = useState<number>(0);
  const [newNextDate, setNewNextDate] = useState('2026-11-01');
  const [newBank, setNewBank] = useState('•••• 0000');

  // Send Confidential Message Modal State
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [msgTargetEmp, setMsgTargetEmp] = useState<EmployeeSalaryRecord | null>(null);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgPriority, setMsgPriority] = useState<ConfidentialMessageItem['priority']>('confidential');
  const [msgAttachSlip, setMsgAttachSlip] = useState(true);
  const [msgSuccessBanner, setMsgSuccessBanner] = useState<string | null>(null);

  // View Sent Message Preview
  const [previewMsg, setPreviewMsg] = useState<ConfidentialMessageItem | null>(null);

  const loadData = async () => {
    try {
      const [salList, msgList] = await Promise.all([
        dataService.getEmployeeSalaries('admin'),
        dataService.getConfidentialMessages('admin', user.id, user.email, user.name),
      ]);
      setSalaries(salList);
      setSentMessages(msgList);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Salaries
  const filteredSalaries = salaries.filter((s) => {
    const matchesSearch =
      s.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.bank_account_mask.includes(searchQuery);

    const matchesStatus =
      statusFilter === 'all' || (s.payment_status || '').toLowerCase() === statusFilter.toLowerCase();
    const matchesDept =
      deptFilter === 'all' || (s.department || '').trim().toLowerCase() === deptFilter.trim().toLowerCase();

    return matchesSearch && matchesStatus && matchesDept;
  });

  // KPI Calculations
  const totalPayroll = salaries.reduce((acc, s) => acc + s.net_salary, 0);
  const paidPayroll = salaries
    .filter((s) => s.payment_status === 'paid')
    .reduce((acc, s) => acc + s.net_salary, 0);
  const pendingPayroll = salaries
    .filter((s) => s.payment_status === 'pending' || s.payment_status === 'processing')
    .reduce((acc, s) => acc + s.net_salary, 0);
  const avgSalary = salaries.length > 0 ? Math.round(totalPayroll / salaries.length) : 0;

  // Open Edit Modal
  const handleOpenEdit = (rec: EmployeeSalaryRecord) => {
    setEditingRecord(rec);
    setEditBase(rec.base_salary);
    setEditBonus(rec.bonus_amount || 0);
    setEditDeduct(rec.deduction_amount || 0);
    setEditStatus(rec.payment_status);
    setEditPayDate(rec.next_pay_date);
    setEditNotes(rec.notes || '');
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      await dataService.updateEmployeeSalary('admin', editingRecord.id, {
        base_salary: editBase,
        bonus_amount: editBonus,
        deduction_amount: editDeduct,
        payment_status: editStatus,
        next_pay_date: editPayDate,
        notes: editNotes,
      });
      setEditingRecord(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update salary');
    }
  };

  // Submit Add Salary
  const handleAddSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    try {
      await dataService.addEmployeeSalary('admin', {
        employee_id: `emp-${Date.now()}`,
        employee_name: newName.trim(),
        email: newEmail.trim(),
        department: newDept,
        team_name: newTeam,
        base_salary: newBaseSalary,
        currency: 'USD',
        pay_frequency: 'monthly',
        bonus_amount: newBonus,
        deduction_amount: 0,
        net_salary: newBaseSalary + newBonus,
        payment_status: 'pending',
        next_pay_date: newNextDate,
        bank_account_mask: newBank,
        last_payment_date: '2026-10-01',
        notes: 'Configured by Admin',
      });

      setIsAddModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewBaseSalary(5500);
      setNewBonus(0);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create record');
    }
  };

  // Open Confidential Message Modal for Employee
  const handleOpenSendMessage = (rec: EmployeeSalaryRecord) => {
    setMsgTargetEmp(rec);
    setMsgSubject(`Compensation & Performance Review - ${rec.employee_name}`);
    setMsgBody(
      `Dear ${rec.employee_name},\n\nPlease find your confidential compensation summary below. Your scheduled monthly compensation is $${rec.net_salary.toLocaleString()} USD.\n\nThank you for your continuous contributions to the team's milestone deliverables.`
    );
    setMsgPriority('confidential');
    setMsgAttachSlip(true);
    setIsMsgModalOpen(true);
  };

  // Submit Confidential Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgTargetEmp || !msgSubject.trim() || !msgBody.trim()) return;

    try {
      const payload: any = {
        recipient_id: msgTargetEmp.employee_id,
        recipient_name: msgTargetEmp.employee_name,
        recipient_email: msgTargetEmp.email,
        sender_id: user.id,
        sender_name: user.name || 'Executive Administration',
        sender_role: 'admin',
        subject: msgSubject.trim(),
        message_body: msgBody.trim(),
        priority: msgPriority,
      };

      if (msgAttachSlip) {
        payload.salary_slip_reference = {
          month: 'October 2026',
          amount: msgTargetEmp.net_salary,
          currency: msgTargetEmp.currency,
          pay_status:
            msgTargetEmp.payment_status === 'paid'
              ? 'Disbursed (Direct Deposit)'
              : msgTargetEmp.payment_status === 'processing'
              ? 'Processing via Bank Vault'
              : 'Scheduled for Next Payroll Cycle',
        };
      }

      await dataService.sendConfidentialMessage('admin', payload);

      setIsMsgModalOpen(false);
      setMsgSuccessBanner(`Confidential message sent securely to ${msgTargetEmp.employee_name}!`);
      setTimeout(() => setMsgSuccessBanner(null), 5000);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch confidential message');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Employee Name',
      'Email',
      'Department',
      'Base Salary (USD)',
      'Bonus',
      'Deductions',
      'Net Salary (USD)',
      'Status',
      'Next Pay Date',
      'Bank Account',
    ];
    const rows = salaries.map((s) => [
      `"${s.employee_name}"`,
      `"${s.email}"`,
      `"${s.department}"`,
      s.base_salary,
      s.bonus_amount || 0,
      s.deduction_amount || 0,
      s.net_salary,
      `"${s.payment_status}"`,
      `"${s.next_pay_date}"`,
      `"${s.bank_account_mask}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Executive_Payroll_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const departments = Array.from(new Set(salaries.map((s) => s.department)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
    >
      {/* 1. Header with Title & Action Buttons */}
      <div className="grid-operations-header">
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={12} />
            </div>
            <span>Executive Finance & Payroll Ledger</span>
            <span
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 10,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Lock size={10} />
              ADMIN ONLY
            </span>
          </div>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              marginTop: 4,
            }}
          >
            Payroll, Compensation & Confidential Direct Transmissions
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Confidential employee salary roster, payment cycle controls, and isolated single-employee direct messaging
          </p>
        </div>

        {/* Global Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn-pill btn-pill-secondary"
            onClick={handleExportCSV}
            title="Export Payroll CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <RefreshButton onRefresh={loadData} title="Refresh Ledger" />

          <button
            type="button"
            className="btn-pill btn-pill-primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ fontWeight: 700, gap: 6 }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Salary Record</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {msgSuccessBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="frosted-card"
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
              <ShieldCheck size={18} />
              <span>{msgSuccessBanner}</span>
            </div>
            <button
              type="button"
              className="btn-icon-circle"
              style={{ width: 24, height: 24 }}
              onClick={() => setMsgSuccessBanner(null)}
            >
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Total Monthly Payroll */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Monthly Payroll
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-card-sm)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={17} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="stat-numeric-lg" style={{ color: 'var(--text-primary)' }}>
              ${totalPayroll.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-secondary)' }}>
              {salaries.length} staff
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Allocated enterprise compensation fund
          </span>
        </div>

        {/* Disbursed / Paid */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Disbursed (Paid)
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-card-sm)',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="stat-numeric-lg" style={{ color: '#10b981' }}>
              ${paidPayroll.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              {Math.round((paidPayroll / (totalPayroll || 1)) * 100)}%
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Cleared & confirmed in bank ledger
          </span>
        </div>

        {/* Pending Disbursals */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pending / In-Process
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-card-sm)',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={17} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="stat-numeric-lg" style={{ color: '#f59e0b' }}>
              ${pendingPayroll.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              {salaries.filter((s) => s.payment_status !== 'paid').length} pending
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Mid-month cycle payouts scheduled
          </span>
        </div>

        {/* Average Salary */}
        <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Average Net Salary
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-card-sm)',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={17} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="stat-numeric-lg" style={{ color: 'var(--text-primary)' }}>
              ${avgSalary.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-secondary)' }}>
              /mo
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Competitive compensation index
          </span>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs: 'Employee Salaries' | 'Confidential Message Transmissions' */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--surface-border-subtle)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn-pill ${activeTab === 'salaries' ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
            onClick={() => setActiveTab('salaries')}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            <CreditCard size={14} />
            <span>Employee Salaries ({salaries.length})</span>
          </button>

          <button
            type="button"
            className={`btn-pill ${activeTab === 'messages' ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
            onClick={() => setActiveTab('messages')}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            <Send size={14} />
            <span>Sent Confidential Messages ({sentMessages.length})</span>
          </button>
        </div>

        {activeTab === 'salaries' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search */}
            <div className="stitch-search-pill" style={{ width: 220, padding: '4px 12px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search staff, email, bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>

            {/* Status Filter */}
            <select
              className="stitch-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: 12, padding: '5px 10px', height: 32 }}
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
            </select>

            {/* Department Filter */}
            <select
              className="stitch-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ fontSize: 12, padding: '5px 10px', height: 32 }}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4. Tab Content: SALARIES LEDGER TABLE */}
      {activeTab === 'salaries' && (
        <div className="frosted-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="stitch-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-frosted-subdued)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Employee
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Department & Team
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Base Salary
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Bonus / Incentive
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Net Disbursal
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Next Pay Date
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Disbursal Vault
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Direct Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No employee salary records found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredSalaries.map((rec) => {
                    const initials = rec.employee_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={rec.id}
                        style={{
                          borderBottom: '1px solid var(--surface-border-subtle)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Employee Avatar & Name */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              className="avatar-chip"
                              style={{
                                width: 34,
                                height: 34,
                                fontSize: 12,
                                background: 'var(--color-secondary-container)',
                                color: 'var(--color-on-secondary-container)',
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                {rec.employee_name}
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rec.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Department & Team */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {rec.department}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rec.team_name}</span>
                        </td>

                        {/* Base Salary */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            ${rec.base_salary.toLocaleString()}
                          </span>
                        </td>

                        {/* Bonus */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: (rec.bonus_amount || 0) > 0 ? '#10b981' : 'var(--text-muted)',
                            }}
                          >
                            {(rec.bonus_amount || 0) > 0 ? `+$${rec.bonus_amount?.toLocaleString()}` : '$0'}
                          </span>
                        </td>

                        {/* Net Disbursal */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <strong style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                            ${rec.net_salary.toLocaleString()}
                          </strong>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{rec.currency} / month</div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span
                            className={`status-pill ${
                              rec.payment_status === 'paid'
                                ? 'active'
                                : rec.payment_status === 'processing'
                                ? 'processing'
                                : 'idle'
                            }`}
                            style={{
                              fontSize: 10,
                              padding: '3px 10px',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                            }}
                          >
                            {rec.payment_status}
                          </span>
                        </td>

                        {/* Next Pay Date */}
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={13} />
                            <span>{rec.next_pay_date}</span>
                          </div>
                        </td>

                        {/* Masked Bank Account */}
                        <td style={{ padding: '12px 16px', fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                            <CreditCard size={13} color="var(--text-muted)" />
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rec.bank_account_mask}</span>
                          </div>
                        </td>

                        {/* Action Buttons: SEND CONFIDENTIAL MESSAGE & EDIT */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            {/* SEND CONFIDENTIAL DIRECT MESSAGE */}
                            <button
                              type="button"
                              className="btn-pill btn-pill-primary"
                              style={{ padding: '5px 12px', fontSize: 11, gap: 5 }}
                              onClick={() => handleOpenSendMessage(rec)}
                              title={`Send confidential direct message to ${rec.employee_name}`}
                            >
                              <Send size={12} />
                              <span>Message</span>
                            </button>

                            {/* EDIT SALARY */}
                            <button
                              type="button"
                              className="btn-icon-circle"
                              style={{ width: 28, height: 28 }}
                              onClick={() => handleOpenEdit(rec)}
                              title="Edit salary configuration"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab Content: SENT CONFIDENTIAL MESSAGES */}
      {activeTab === 'messages' && (
        <div className="frosted-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Audited Direct Message Transmissions
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                These messages are cryptographically scoped and delivered <strong>strictly to the targeted employee only</strong>. No manager or peer can view them.
              </p>
            </div>
            <span className="live-telemetry-badge">
              <Lock size={11} style={{ marginRight: 4 }} />
              Direct-to-Recipient Scoped
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="stitch-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-frosted-subdued)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Recipient Employee
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Subject Line
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Attached Slip Reference
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Dispatch Timestamp
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Employee Status
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Inspect
                  </th>
                </tr>
              </thead>
              <tbody>
                {sentMessages.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No confidential messages sent yet. Use the "Message" button on any employee in the ledger to send a direct note.
                    </td>
                  </tr>
                ) : (
                  sentMessages.map((msg) => (
                    <tr key={msg.id} style={{ borderBottom: '1px solid var(--surface-border-subtle)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: 'var(--surface-frosted-subdued)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {msg.recipient_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                              {msg.recipient_name}
                            </strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {msg.recipient_email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {msg.subject}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {msg.salary_slip_reference ? (
                          <div style={{ fontSize: 12, color: 'var(--color-secondary)', fontWeight: 600 }}>
                            ${msg.salary_slip_reference.amount.toLocaleString()} {msg.salary_slip_reference.currency} ({msg.salary_slip_reference.month})
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No slip attached</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(msg.sent_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          className={`status-pill ${msg.is_read ? 'active' : 'processing'}`}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                        >
                          {msg.is_read ? 'Read by Employee' : 'Delivered (Unread)'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-icon-circle"
                          style={{ width: 28, height: 28 }}
                          onClick={() => setPreviewMsg(msg)}
                          title="View message text"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SEND CONFIDENTIAL MESSAGE TO SPECIFIC EMPLOYEE ONLY */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isMsgModalOpen && msgTargetEmp && (
          <div className="stitch-modal-backdrop" onClick={() => setIsMsgModalOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 540 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-card-sm)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                      Send Confidential Message
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Exclusively delivered to {msgTargetEmp.employee_name} ({msgTargetEmp.email})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setIsMsgModalOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Security Privacy Notice */}
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-card-sm)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <Lock size={16} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: '#ef4444' }}>Targeted Privacy Enforcement:</strong> This message will ONLY appear on <strong>{msgTargetEmp.employee_name}'s</strong> workstation portal. No other employees and no team managers can access or view this transmission.
                </div>
              </div>

              <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                {/* Target Employee Summary Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-card-sm)',
                    background: 'var(--surface-frosted-subdued)',
                    border: '1px solid var(--surface-border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Recipient: {msgTargetEmp.employee_name}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {msgTargetEmp.department} &bull; Net Salary: ${msgTargetEmp.net_salary.toLocaleString()} USD
                    </span>
                  </div>
                  <span className="live-telemetry-badge">Single Recipient</span>
                </div>

                {/* Subject */}
                <div className="stitch-form-group">
                  <label className="stitch-label">Subject Line *</label>
                  <input
                    type="text"
                    className="stitch-input"
                    required
                    placeholder="e.g. October 2026 Salary Disbursal Notice"
                    value={msgSubject}
                    onChange={(e) => setMsgSubject(e.target.value)}
                  />
                </div>

                {/* Message Body */}
                <div className="stitch-form-group">
                  <label className="stitch-label">Confidential Message Body *</label>
                  <textarea
                    className="stitch-input"
                    rows={5}
                    required
                    placeholder="Write your private message or instructions to this employee..."
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                  />
                </div>

                {/* Attach Salary Slip Option */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-card-sm)',
                    background: 'var(--surface-frosted-subdued)',
                  }}
                >
                  <input
                    type="checkbox"
                    id="attach-slip"
                    checked={msgAttachSlip}
                    onChange={(e) => setMsgAttachSlip(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="attach-slip" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>
                    Attach Current Pay Slip Reference (${msgTargetEmp.net_salary.toLocaleString()} USD • {msgTargetEmp.payment_status})
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    onClick={() => setIsMsgModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill btn-pill-primary" style={{ gap: 6 }}>
                    <Send size={14} />
                    <span>Send Confidential Message</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT EMPLOYEE SALARY */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingRecord && (
          <div className="stitch-modal-backdrop" onClick={() => setEditingRecord(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={18} color="#10b981" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>
                    Edit Salary: {editingRecord.employee_name}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setEditingRecord(null)}
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Base Monthly Salary (USD) *</label>
                    <input
                      type="number"
                      className="stitch-input"
                      required
                      min={0}
                      step={50}
                      value={editBase}
                      onChange={(e) => setEditBase(Number(e.target.value))}
                    />
                  </div>

                  <div className="stitch-form-group">
                    <label className="stitch-label">Bonus / Incentive (USD)</label>
                    <input
                      type="number"
                      className="stitch-input"
                      min={0}
                      step={50}
                      value={editBonus}
                      onChange={(e) => setEditBonus(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Deduction (USD)</label>
                    <input
                      type="number"
                      className="stitch-input"
                      min={0}
                      step={25}
                      value={editDeduct}
                      onChange={(e) => setEditDeduct(Number(e.target.value))}
                    />
                  </div>

                  <div className="stitch-form-group">
                    <label className="stitch-label">Calculated Net Payout</label>
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--surface-frosted-subdued)',
                        borderRadius: 'var(--radius-card-sm)',
                        fontWeight: 800,
                        fontSize: 16,
                        color: '#10b981',
                      }}
                    >
                      ${Math.max(0, editBase + editBonus - editDeduct).toLocaleString()} USD
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Payment Status</label>
                    <select
                      className="stitch-select"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                    >
                      <option value="paid">Paid</option>
                      <option value="processing">Processing</option>
                      <option value="pending">Pending</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>

                  <div className="stitch-form-group">
                    <label className="stitch-label">Next Payout Date</label>
                    <input
                      type="date"
                      className="stitch-input"
                      value={editPayDate}
                      onChange={(e) => setEditPayDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="stitch-form-group">
                  <label className="stitch-label">Ledger Notes</label>
                  <input
                    type="text"
                    className="stitch-input"
                    placeholder="Compensation review notes, promotions..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    onClick={() => setEditingRecord(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill btn-pill-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: ADD SALARY RECORD */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="stitch-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} color="#10b981" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Add Employee Salary Record</span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAddSalary} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                <div className="stitch-form-group">
                  <label className="stitch-label">Employee Full Name *</label>
                  <input
                    type="text"
                    className="stitch-input"
                    required
                    placeholder="e.g. Liam Gallagher"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div className="stitch-form-group">
                  <label className="stitch-label">Employee Work Email *</label>
                  <input
                    type="email"
                    className="stitch-input"
                    required
                    placeholder="e.g. liam@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Department</label>
                    <input
                      type="text"
                      className="stitch-input"
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                    />
                  </div>

                  <div className="stitch-form-group">
                    <label className="stitch-label">Team Name</label>
                    <input
                      type="text"
                      className="stitch-input"
                      value={newTeam}
                      onChange={(e) => setNewTeam(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Base Monthly Salary (USD) *</label>
                    <input
                      type="number"
                      className="stitch-input"
                      required
                      min={0}
                      step={100}
                      value={newBaseSalary}
                      onChange={(e) => setNewBaseSalary(Number(e.target.value))}
                    />
                  </div>

                  <div className="stitch-form-group">
                    <label className="stitch-label">Bonus (USD)</label>
                    <input
                      type="number"
                      className="stitch-input"
                      min={0}
                      step={50}
                      value={newBonus}
                      onChange={(e) => setNewBonus(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stitch-form-group">
                    <label className="stitch-label">Next Payout Date</label>
                    <input
                      type="date"
                      className="stitch-input"
                      value={newNextDate}
                      onChange={(e) => setNewNextDate(e.target.value)}
                    />
                  </div>

                  <div className="stitch-form-group">
                    <label className="stitch-label">Masked Bank Account</label>
                    <input
                      type="text"
                      className="stitch-input"
                      placeholder="e.g. •••• 1234"
                      value={newBank}
                      onChange={(e) => setNewBank(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill btn-pill-primary">
                    Create Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: VIEW MESSAGE PREVIEW */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {previewMsg && (
          <div className="stitch-modal-backdrop" onClick={() => setPreviewMsg(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 520 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={18} color="var(--color-secondary)" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Confidential Transmission</span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setPreviewMsg(null)}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Recipient:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {previewMsg.recipient_name} ({previewMsg.recipient_email})
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subject:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{previewMsg.subject}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span className={`status-pill ${previewMsg.is_read ? 'active' : 'processing'}`}>
                    {previewMsg.is_read ? 'Read by Recipient' : 'Unread'}
                  </span>
                </div>

                {previewMsg.salary_slip_reference && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-card-sm)',
                      background: 'var(--surface-frosted-subdued)',
                      border: '1px solid var(--surface-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Attached Slip</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                        ${previewMsg.salary_slip_reference.amount.toLocaleString()} {previewMsg.salary_slip_reference.currency}
                      </div>
                    </div>
                    <span className="live-telemetry-badge">{previewMsg.salary_slip_reference.pay_status}</span>
                  </div>
                )}

                <div
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-card-sm)',
                    background: 'var(--surface-frosted-subdued)',
                    border: '1px solid var(--surface-border-subtle)',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {previewMsg.message_body}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminFinancePage;
