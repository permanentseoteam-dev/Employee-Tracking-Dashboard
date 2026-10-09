import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, UserCheck, Plus, X, Edit2, Trash2, Users, Search, Check } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { TeamRecord, ManagerRecord, EmployeeRecord } from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
export const AdminTeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRecord | null>(null);
  const [managingMembersTeam, setManagingMembersTeam] = useState<TeamRecord | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<TeamRecord | null>(null);

  // Form states for Add Team
  const [teamName, setTeamName] = useState('');
  const [teamDept, setTeamDept] = useState('Engineering');
  const [teamManagerId, setTeamManagerId] = useState('');

  // Form states for Edit Team
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [editAttendanceRate, setEditAttendanceRate] = useState(100);

  // Assigned members for the team being managed
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const [teamList, mgrList, empList] = await Promise.all([
        dataService.getTeams('admin'),
        dataService.getManagers('admin'),
        dataService.getEmployees('admin'),
      ]);
      setTeams(teamList);
      setManagers(mgrList);
      setEmployees(empList);

      if (mgrList.length > 0 && !teamManagerId) {
        setTeamManagerId(mgrList[0].id);
      }
    } catch (err) {
      console.error('Error loading team data:', err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, []);

  // 1. Create New Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    const mgr = managers.find((m) => m.id === teamManagerId) || managers[0];

    try {
      await dataService.addTeam('admin', {
        name: teamName.trim(),
        department: teamDept,
        manager_id: mgr?.id || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        manager_name: mgr?.name || 'Arsal (Manager)',
      });

      setIsAddTeamModalOpen(false);
      setTeamName('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 2. Open Edit Team Modal
  const handleOpenEditModal = (team: TeamRecord) => {
    setEditingTeam(team);
    setEditName(team.name);
    setEditDept(team.department);
    setEditManagerId(team.manager_id);
    setEditAttendanceRate(team.attendance_rate || 100);
  };

  // 3. Save Edited Team
  const handleSaveEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editName.trim()) return;

    const mgr = managers.find((m) => m.id === editManagerId) || managers[0];

    try {
      await dataService.updateTeam('admin', editingTeam.id, {
        name: editName.trim(),
        department: editDept,
        manager_id: mgr?.id || editManagerId,
        manager_name: mgr?.name || editingTeam.manager_name,
        attendance_rate: editAttendanceRate,
      });

      setEditingTeam(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 4. Open Manage Members Modal
  const handleOpenManageMembers = (team: TeamRecord) => {
    setManagingMembersTeam(team);
    // Find all employees that belong to this team or default to Arsal
    const assigned = employees
      .filter((e) => e.team_name === team.name || e.team_id === team.id || e.department === team.department)
      .map((e) => e.id);
    setSelectedMemberIds(assigned.length > 0 ? assigned : employees.slice(0, 1).map((e) => e.id));
  };

  // 5. Toggle Member in Team
  const handleToggleMember = (empId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // 6. Save Team Members
  const handleSaveMembers = async () => {
    if (!managingMembersTeam) return;

    try {
      await dataService.updateTeam('admin', managingMembersTeam.id, {
        member_count: Math.max(1, selectedMemberIds.length),
        active_count: selectedMemberIds.length > 0 ? 1 : 0,
      });

      setManagingMembersTeam(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 7. Delete Team
  const handleConfirmDelete = async () => {
    if (!deletingTeam) return;

    try {
      await dataService.deleteTeam('admin', deletingTeam.id);
      setDeletingTeam(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredTeams = teams.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.department.toLowerCase().includes(q) ||
      (t.manager_name || '').toLowerCase().includes(q)
    );
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
            <Building2 size={14} color="var(--color-secondary)" />
            <span>Operational Architecture</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Teams & Operational Units
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Manage workforce teams, departmental allocations, manager leads, and member rosters with full editability
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshButton onRefresh={loadData}   title="Refresh team roster" />
          <button className="btn-pill btn-pill-primary" onClick={() => setIsAddTeamModalOpen(true)}>
            <Plus size={15} />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="stitch-input"
            style={{ paddingLeft: 36, height: 38 }}
            placeholder="Search teams by name, department, lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Showing <strong>{filteredTeams.length}</strong> operational units
        </div>
      </div>

      {/* Grid of Team Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {filteredTeams.map((team) => (
          <div key={team.id} className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Card Top: Title, Department & Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {team.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'var(--surface-frosted-subdued)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      color: 'var(--color-secondary)',
                      border: '1px solid var(--surface-border-subtle)',
                    }}
                  >
                    {team.department}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Edit, Members, Delete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 32, height: 32 }}
                  title="Edit team settings & name"
                  onClick={() => handleOpenEditModal(team)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 32, height: 32 }}
                  title="Manage team members"
                  onClick={() => handleOpenManageMembers(team)}
                >
                  <Users size={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 32, height: 32, color: 'var(--status-error)' }}
                  title="Delete team"
                  onClick={() => setDeletingTeam(team)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Manager Lead Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--surface-frosted-subdued)',
                borderRadius: 'var(--radius-card-sm)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={15} color="var(--color-secondary)" />
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lead Manager: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{team.manager_name || 'Arsal (Manager)'}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenEditModal(team)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Change
              </button>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
              <div style={{ padding: '8px 4px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Members</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{team.member_count}</div>
              </div>

              <div style={{ padding: '8px 4px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Active Now</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-success)', marginTop: 2 }}>{team.active_count}</div>
              </div>

              <div style={{ padding: '8px 4px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Attendance</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-tertiary)', marginTop: 2 }}>{team.attendance_rate}%</div>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Shift Capacity & Presence</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{team.attendance_rate}%</span>
              </div>
              <div style={{ height: 6, width: '100%', background: 'var(--surface-border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, team.attendance_rate)}%`,
                    background: team.attendance_rate >= 80 ? 'var(--color-secondary)' : 'var(--status-warning)',
                    borderRadius: 'var(--radius-pill)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
                onClick={() => handleOpenManageMembers(team)}
              >
                <Users size={13} />
                <span>Roster ({team.member_count})</span>
              </button>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
                onClick={() => handleOpenEditModal(team)}
              >
                <Edit2 size={13} />
                <span>Edit Settings</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Create Team Modal */}
      {isAddTeamModalOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsAddTeamModalOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Create New Operational Team</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsAddTeamModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Team Name</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  placeholder="e.g. Core Backend Team"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Department</label>
                <select
                  className="stitch-select"
                  value={teamDept}
                  onChange={(e) => setTeamDept(e.target.value)}
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Security">Security & Compliance</option>
                  <option value="Product">Product & Design</option>
                  <option value="QA">Quality Assurance</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Assign Manager Lead</label>
                <select
                  className="stitch-select"
                  value={teamManagerId}
                  onChange={(e) => setTeamManagerId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.department || 'Management'})
                    </option>
                  ))}
                  {managers.length === 0 && (
                    <option value="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb">Arsal (Manager)</option>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsAddTeamModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Team Modal */}
      {editingTeam && (
        <div className="stitch-modal-backdrop" onClick={() => setEditingTeam(null)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Edit Operational Team</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setEditingTeam(null)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveEditTeam} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Team Name</label>
                <input
                  type="text"
                  required
                  className="stitch-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Department</label>
                <select
                  className="stitch-select"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Security">Security & Compliance</option>
                  <option value="Product">Product & Design</option>
                  <option value="QA">Quality Assurance</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Assigned Lead Manager</label>
                <select
                  className="stitch-select"
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.department || 'Management'})
                    </option>
                  ))}
                  {managers.length === 0 && (
                    <option value="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb">Arsal (Manager)</option>
                  )}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Target Shift Attendance Rate: {editAttendanceRate}%</label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={editAttendanceRate}
                  onChange={(e) => setEditAttendanceRate(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-secondary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setEditingTeam(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Manage Team Members Modal */}
      {managingMembersTeam && (
        <div className="stitch-modal-backdrop" onClick={() => setManagingMembersTeam(null)}>
          <div className="stitch-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="var(--color-secondary)" />
                <div>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Manage Members</span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{managingMembersTeam.name}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setManagingMembersTeam(null)}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Select which employees are assigned to this operational team:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {employees.map((emp) => {
                const isSelected = selectedMemberIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleToggleMember(emp.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: isSelected ? 'rgba(76, 107, 255, 0.08)' : 'var(--surface-frosted-subdued)',
                      borderRadius: 'var(--radius-card-sm)',
                      border: isSelected ? '1px solid var(--color-secondary)' : '1px solid var(--surface-border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar-chip" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.department} &bull; {emp.email}</div>
                      </div>
                    </div>

                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: isSelected ? 'none' : '1px solid var(--surface-border)',
                        background: isSelected ? 'var(--color-secondary)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                      }}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                onClick={() => setManagingMembersTeam(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-pill btn-pill-primary"
                onClick={handleSaveMembers}
              >
                Save Member Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Delete Team Confirmation Modal */}
      {deletingTeam && (
        <div className="stitch-modal-backdrop" onClick={() => setDeletingTeam(null)}>
          <div className="stitch-modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-error)' }}>
                <Trash2 size={18} />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Delete Operational Team?</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setDeletingTeam(null)}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete <strong>{deletingTeam.name}</strong>? Assigned projects and telemetry records will remain in the database.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn-pill btn-pill-secondary"
                onClick={() => setDeletingTeam(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-pill"
                style={{ background: 'var(--status-error)', color: '#ffffff', border: 'none' }}
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
