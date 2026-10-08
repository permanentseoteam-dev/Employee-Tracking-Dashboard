import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, RefreshCw, UserCheck, Plus, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { TeamRecord, ManagerRecord } from '../../types/roles';

export const AdminTeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDept, setTeamDept] = useState('Engineering');
  const [teamManagerId, setTeamManagerId] = useState('mgr-001');

  const loadData = async () => {
    try {
      const [teamList, mgrList] = await Promise.all([
        dataService.getTeams('admin'),
        dataService.getManagers('admin'),
      ]);
      setTeams(teamList);
      setManagers(mgrList);
      if (mgrList.length > 0 && (!teamManagerId || teamManagerId === 'mgr-001')) {
        setTeamManagerId(mgrList[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    const mgr = managers.find((m) => m.id === teamManagerId);

    try {
      await dataService.addTeam('admin', {
        name: teamName.trim(),
        department: teamDept,
        manager_id: teamManagerId,
        manager_name: mgr?.name || 'Alex Vance',
      });

      dataService.logAction(
        'Super Admin',
        'admin',
        'CREATE_TEAM',
        teamName,
        `Created operational unit in ${teamDept}`
      );

      setIsAddTeamModalOpen(false);
      setTeamName('');
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
            <Building2 size={14} color="var(--color-secondary)" />
            <span>Operational Architecture</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Teams & Operational Units
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Cross-department team breakdown, manager leads, active workforce counts, and attendance telemetry
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-pill btn-pill-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="btn-pill btn-pill-primary" onClick={() => setIsAddTeamModalOpen(true)}>
            <Plus size={15} />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      {/* Grid of Team Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {teams.map((team) => (
          <div key={team.id} className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{team.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {team.department}
                </div>
              </div>
              <div className="avatar-chip" style={{ width: 34, height: 34 }}>
                <Building2 size={16} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)' }}>
              <UserCheck size={14} color="var(--color-secondary)" />
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Lead: </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{team.manager_name}</span>
              </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', paddingTop: 6 }}>
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

            {/* Attendance Progress bar */}
            <div style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Shift Capacity</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{team.attendance_rate}%</span>
              </div>
              <div style={{ height: 6, width: '100%', background: 'var(--surface-border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${team.attendance_rate}%`,
                    background: 'var(--color-secondary)',
                    borderRadius: 'var(--radius-pill)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Team Modal */}
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
                  placeholder="e.g. Platform Infrastructure"
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
                      {m.name} ({m.department})
                    </option>
                  ))}
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
    </motion.div>
  );
};
