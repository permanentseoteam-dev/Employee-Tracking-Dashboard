import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, UserCheck, ShieldCheck, FolderKanban, Users, Plus, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { ManagerRecord, TeamRecord } from '../../types/roles';

import { useAppRefresh } from '../../hooks/useAppRefresh';
import { RefreshButton } from '../../components/common/RefreshButton';
export const AdminManagersPage: React.FC = () => {
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Scope Modal State
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [selectedMgrId, setSelectedMgrId] = useState('');
  const [selectedTeamName, setSelectedTeamName] = useState('');

  const loadData = async () => {
    try {
      const [mgrList, teamList] = await Promise.all([
        dataService.getManagers('admin'),
        dataService.getTeams('admin'),
      ]);
      setManagers(mgrList);
      setTeams(teamList);
      if (mgrList.length > 0 && !selectedMgrId) setSelectedMgrId(mgrList[0].id);
      if (teamList.length > 0 && !selectedTeamName) setSelectedTeamName(teamList[0].name);
    } catch (err) {
      console.error(err);
    }
  };

  useAppRefresh(loadData);

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMgrId || !selectedTeamName) return;

    try {
      await dataService.assignManagerScope('admin', selectedMgrId, selectedTeamName);
      setIsScopeModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = (managers || []).filter((m) => {
    const name = m?.name || '';
    const dept = m?.department || '';
    const search = (searchQuery || '').toLowerCase();
    return name.toLowerCase().includes(search) || dept.toLowerCase().includes(search);
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
            <UserCheck size={14} color="var(--color-secondary)" />
            <span>Organizational Hierarchy</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginTop: 2 }}>
            Manager Hierarchy & Scopes
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Configure managerial authority, assigned operational teams, and employee access boundaries
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshButton onRefresh={loadData}   />
          <button className="btn-pill btn-pill-primary" onClick={() => setIsScopeModalOpen(true)}>
            <Plus size={15} />
            <span>Assign Scope</span>
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="frosted-card">
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Active Managers</span>
            <span className="live-telemetry-badge">{filtered.length} leads</span>
          </div>

          <div className="stitch-search-pill" style={{ maxWidth: 240 }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search manager, dept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="stitch-table-wrapper">
          <table className="stitch-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Department</th>
                <th>Assigned Teams</th>
                <th>Direct Reports</th>
                <th>Active Projects</th>
                <th style={{ textAlign: 'right' }}>Access Scope</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mgr) => (
                <tr key={mgr.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar-chip" style={{ background: 'linear-gradient(135deg, #4c6bff, #1e293b)' }}>
                        {mgr.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mgr.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mgr.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="status-pill neutral">{mgr.department}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {(mgr.teams || []).map((t) => (
                        <span
                          key={t}
                          style={{
                            padding: '2px 8px',
                            background: 'var(--surface-frosted-subdued)',
                            border: '1px solid var(--surface-border-subtle)',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={13} color="var(--text-muted)" />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {(mgr.assigned_employee_ids || []).length}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>members</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FolderKanban size={13} color="var(--color-secondary)" />
                      <span style={{ fontWeight: 600 }}>{mgr.active_projects_count}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>projects</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="status-pill active" style={{ display: 'inline-flex', gap: 4 }}>
                      <ShieldCheck size={12} />
                      <span>Team-Scoped</span>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No manager records match the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Manager Scope Modal */}
      {isScopeModalOpen && (
        <div className="stitch-modal-backdrop" onClick={() => setIsScopeModalOpen(false)}>
          <div className="stitch-modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={18} color="var(--color-secondary)" />
                <span style={{ fontSize: 17, fontWeight: 700 }}>Assign Manager Team Scope</span>
              </div>
              <button
                type="button"
                className="btn-icon-circle"
                style={{ width: 30, height: 30 }}
                onClick={() => setIsScopeModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAssignScope} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stitch-form-group">
                <label className="stitch-label">Select Manager</label>
                <select
                  className="stitch-select"
                  value={selectedMgrId}
                  onChange={(e) => setSelectedMgrId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="stitch-form-group">
                <label className="stitch-label">Assign Operational Team</label>
                <select
                  className="stitch-select"
                  value={selectedTeamName}
                  onChange={(e) => setSelectedTeamName(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.department})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setIsScopeModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill btn-pill-primary">
                  Assign Scope
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
