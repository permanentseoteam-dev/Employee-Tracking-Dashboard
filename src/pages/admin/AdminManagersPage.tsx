import React, { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { ManagerRecord } from '../../types/roles';

export const AdminManagersPage: React.FC = () => {
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      const list = await dataService.getManagers('admin');
      setManagers(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = managers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manager Hierarchy & Scopes</h1>
          <p className="page-subtitle">
            Configure managerial authority, assigned teams, and team employee access boundaries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-title">
          <span>Active Managers ({filtered.length})</span>
          <div className="search-box" style={{ width: 220, padding: '4px 10px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search manager..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Department</th>
                <th>Assigned Teams</th>
                <th>Direct Reports</th>
                <th>Active Projects</th>
                <th>Access Scope</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mgr) => (
                <tr key={mgr.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div>{mgr.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mgr.email}</div>
                  </td>
                  <td>{mgr.department}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {mgr.teams.map((t) => (
                        <span
                          key={t}
                          style={{
                            padding: '2px 8px',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 11,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {mgr.assigned_employee_ids.length} employees
                    </span>
                  </td>
                  <td>{mgr.active_projects_count} projects</td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        backgroundColor: 'var(--success-bg)',
                        color: 'var(--success)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      Team-Scoped
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
