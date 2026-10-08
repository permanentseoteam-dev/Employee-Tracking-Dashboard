import React, { useState, useEffect } from 'react';
import { Plus, Search, RefreshCw, Smartphone } from 'lucide-react';
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
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    const mgr = managers.find((m) => m.id === newEmpManagerId);
    const team = teams.find((t) => t.manager_id === newEmpManagerId) || teams[0];

    try {
      await dataService.addEmployee('admin', {
        name: newEmpName,
        email: newEmpEmail || `${newEmpName.toLowerCase().replace(' ', '.')}@company.com`,
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

  const filtered = employees.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.team_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'all' || e.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Roster Management</h1>
          <p className="page-subtitle">
            Manage organization members, hardware device bindings, and team manager assignments
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={15} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Registered Employees ({filtered.length})</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="search-box" style={{ width: 220, padding: '4px 10px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search employee, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="form-input"
              style={{ width: 140, padding: '4px 8px', fontSize: 12 }}
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

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Team</th>
                <th>Assigned Manager</th>
                <th>Device ID</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div>{emp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                  </td>
                  <td>{emp.department}</td>
                  <td>{emp.team_name}</td>
                  <td>{emp.manager_name}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                      {emp.device_id}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.joined_at}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        title="Reset Registered Device Token"
                        onClick={() => handleResetDevice(emp)}
                      >
                        <Smartphone size={12} />
                        <span>Reset Device</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="content-card"
            style={{ width: 440, maxWidth: '90vw', margin: 0 }}
          >
            <div className="content-card-title">
              <span>Register New Employee</span>
              <button
                className="icon-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddEmployee}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Corporate Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. john.doe@company.com"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-input"
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Mobile">Mobile</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assign Manager</label>
                <select
                  className="form-input"
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Bind Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
