import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, RefreshCw, Smartphone, X, Users, UserCheck } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord, ManagerRecord, TeamRecord } from '../../types/roles';

export const AdminEmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('Engineering');
  const [newEmpManagerId, setNewEmpManagerId] = useState('mgr-001');

  const loadData = async () => {
    try {
      const [empList, mgrList, teamList] = await Promise.all([
        dataService.getEmployees('admin'),
        dataService.getManagers('admin'),
        dataService.getTeams('admin'),
      ]);
      setEmployees(empList);
      setManagers(mgrList);
      setTeams(teamList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      if (payload.table === 'employees' || payload.table === 'devices') {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (managers.length > 0 && (!newEmpManagerId || newEmpManagerId === 'mgr-001')) {
      setNewEmpManagerId(managers[0].id);
    }
  }, [managers]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    const mgr = managers.find((m) => m.id === newEmpManagerId);
    const team = teams.find((t) => t.manager_id === newEmpManagerId) || teams[0];

    try {
      await dataService.addEmployee('admin', {
        name: newEmpName,
        email: newEmpEmail || `${newEmpName.toLowerCase().replace(/\s+/g, '.')}@company.com`,
        department: newEmpDept,
        manager_id: newEmpManagerId,
        manager_name: mgr?.name || 'Assigned Manager',
        team_id: team?.id || 'team-backend',
        team_name: team?.name || 'General Team',
      });
      dataService.logAction('Super Admin', 'admin', 'ADD_EMPLOYEE', newEmpName, `Created account in ${newEmpDept}`);
      setIsAddModalOpen(false);
      setNewEmpName('');
      setNewEmpEmail('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetDevice = (emp: EmployeeRecord) => {
    if (confirm(`Reset registered hardware fingerprint for ${emp.name} (${emp.device_id})?`)) {
      dataService.logAction('Super Admin', 'admin', 'DEVICE_RESET', emp.device_id, `Reset hardware binding for ${emp.name}`);
      alert(`Hardware token revoked. ${emp.name}'s desktop agent will re-bind on next launch.`);
    }
  };

  const filtered = (employees || []).filter((e) => {
    const name = e?.name || '';
    const email = e?.email || '';
    const team = e?.team_name || '';
    const search = (searchQuery || '').toLowerCase();
    const matchesSearch =
      name.toLowerCase().includes(search) ||
      email.toLowerCase().includes(search) ||
      team.toLowerCase().includes(search);
    const matchesDept = selectedDept === 'all' || e?.department === selectedDept;
    return matchesSearch && matchesDept;
  });

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
            <Users size={14} color="var(--color-secondary)" />
            <span>Workforce Directory</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Employee Roster Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Manage organization members, hardware device bindings, and team manager assignments
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="btn-pill btn-pill-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={15} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Main Roster Card */}
      <div className="frosted-card">
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Registered Employees</span>
            <span className="live-telemetry-badge">{filtered.length} total</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="stitch-search-pill" style={{ maxWidth: 240 }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="stitch-select"
              style={{ width: 160, padding: '7px 12px', fontSize: 12 }}
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="all">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Frontend">Frontend</option>
              <option value="Mobile">Mobile</option>
            </select>
          </div>
        </div>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Team</th>
                <th>Assigned Manager</th>
                <th>Device ID</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar-chip">
                        {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="status-pill neutral">{emp.department}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{emp.team_name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <UserCheck size={13} color="var(--color-secondary)" />
                      <span>{emp.manager_name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-frosted-subdued)', padding: '2px 6px', borderRadius: 4 }}>
                      {emp.device_id}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.joined_at}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-pill btn-pill-secondary"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                      title="Revoke registered hardware token"
                      onClick={() => handleResetDevice(emp)}
                    >
                      <Smartphone size={12} />
                      <span>Reset Device</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No employee records match the selected search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Register New Employee</span>
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

            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Full Name</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  placeholder="e.g. Alex Johnson"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Corporate Email</label>
                <input
                  type="email"
                  className="stitch-input"
                  placeholder="e.g. alex.johnson@company.com"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Department</label>
                <select
                  className="stitch-select"
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Mobile">Mobile</option>
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Assign Manager</label>
                <select
                  className="stitch-select"
                  value={newEmpManagerId}
                  onChange={(e) => setNewEmpManagerId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.department})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Save & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
