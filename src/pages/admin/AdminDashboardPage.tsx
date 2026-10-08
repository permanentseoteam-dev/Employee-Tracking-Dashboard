import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Percent,
  Play,
  Eye,
  RefreshCw,
  Search,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord } from '../../types/roles';

interface AdminDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const [kpis, setKpis] = useState<{
    totalEmployees: number;
    onlineEmployees: number;
    lateToday: number;
    idleEmployees: number;
    activeTasks: number;
    completedTasks: number;
    totalProjects: number;
    attendanceRate: number;
  } | null>(null);

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiData, empData] = await Promise.all([
        dataService.getAdminKpis(),
        dataService.getEmployees('admin'),
      ]);
      setKpis(kpiData);
      setEmployees(empData);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Real-time live auto-sync subscription
    const unsubscribe = dataService.subscribeToRealtime((payload) => {
      console.log('⚡ [AdminDashboard] Realtime event received, refreshing metrics:', payload.table);
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      emp.team_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      emp.manager_name.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesStatus =
      selectedStatus === 'all' || emp.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Control Center</h1>
          <p className="page-subtitle">
            Enterprise Workforce Telemetry &bull; Real-time Attendance &bull; Cross-Team Oversight
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData} title="Refresh Live Metrics">
            <RefreshCw size={15} />
            <span>Refresh Telemetry</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('/admin/monitoring/screenshots')}
          >
            <Eye size={15} />
            <span>Review Screenshots</span>
          </button>
        </div>
      </div>

      {/* 8 Real Admin KPI Cards */}
      {loading || !kpis ? (
        <div className="metrics-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
              <div className="stat-header">Loading metric...</div>
              <div className="stat-value">--</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="metrics-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span>Total Employees</span>
              <Users size={15} color="var(--primary)" />
            </div>
            <div className="stat-value">{kpis.totalEmployees}</div>
            <div className="stat-footer">Across all registered devices</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Online Now</span>
              <span className="status-indicator-dot" />
            </div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {kpis.onlineEmployees}
            </div>
            <div className="stat-footer">Active, Idle & On-Break sessions</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Late Today</span>
              <Clock size={15} color="var(--warning)" />
            </div>
            <div className="stat-value" style={{ color: kpis.lateToday > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {kpis.lateToday}
            </div>
            <div className="stat-footer">Grace period exceeded</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Currently Idle</span>
              <AlertTriangle size={15} color={kpis.idleEmployees > 0 ? 'var(--warning)' : 'var(--text-muted)'} />
            </div>
            <div className="stat-value">{kpis.idleEmployees}</div>
            <div className="stat-footer">Inactivity &gt; 3 mins threshold</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Active Tasks</span>
              <Play size={15} color="var(--primary)" />
            </div>
            <div className="stat-value">{kpis.activeTasks}</div>
            <div className="stat-footer">In progress across teams</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Completed Tasks</span>
              <CheckCircle2 size={15} color="var(--success)" />
            </div>
            <div className="stat-value">{kpis.completedTasks}</div>
            <div className="stat-footer">Verified delivery</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Total Projects</span>
              <FolderKanban size={15} color="var(--primary)" />
            </div>
            <div className="stat-value">{kpis.totalProjects}</div>
            <div className="stat-footer">Managed across 3 departments</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Attendance Rate</span>
              <Percent size={15} color="var(--success)" />
            </div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {kpis.attendanceRate}%
            </div>
            <div className="stat-footer">Today's present ratio</div>
          </div>
        </div>
      )}

      {/* Live Employee Status Table Section */}
      <div className="content-card">
        <div className="content-card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Live Organization Employee Roster</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ({filteredEmployees.length} of {employees.length} employees)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="search-box" style={{ width: 220, padding: '4px 10px' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Filter by name, team..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>

            <select
              className="form-input"
              style={{ width: 130, padding: '4px 8px', fontSize: 12 }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="idle">Idle Only</option>
              <option value="on_break">On Break</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
            No employees matching filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Team & Department</th>
                  <th>Manager</th>
                  <th>Agent Status</th>
                  <th>Attendance</th>
                  <th>First Activity</th>
                  <th>Active Time</th>
                  <th>Idle Time</th>
                  <th>Last Screenshot</th>
                  <th>Current Task</th>
                  <th>Stars</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const activeHours = (emp.active_seconds / 3600).toFixed(1);
                  const idleHours = (emp.idle_seconds / 3600).toFixed(1);

                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                      </td>
                      <td>
                        <div>{emp.team_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.department}</div>
                      </td>
                      <td>{emp.manager_name}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor:
                              emp.status === 'active'
                                ? 'var(--success-bg)'
                                : emp.status === 'idle'
                                ? 'var(--warning-bg)'
                                : emp.status === 'on_break'
                                ? 'rgba(59, 130, 246, 0.12)'
                                : 'rgba(100, 116, 139, 0.12)',
                            color:
                              emp.status === 'active'
                                ? 'var(--success)'
                                : emp.status === 'idle'
                                ? 'var(--warning)'
                                : emp.status === 'on_break'
                                ? 'var(--primary)'
                                : 'var(--text-muted)',
                          }}
                        >
                          <span
                            className={`status-indicator-dot ${emp.status === 'offline' ? 'offline' : ''}`}
                            style={{
                              backgroundColor:
                                emp.status === 'idle'
                                  ? 'var(--warning)'
                                  : emp.status === 'on_break'
                                  ? 'var(--primary)'
                                  : undefined,
                            }}
                          />
                          {emp.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor:
                              emp.attendance_status === 'on_time'
                                ? 'var(--success-bg)'
                                : emp.attendance_status === 'late'
                                ? 'var(--warning-bg)'
                                : 'var(--danger-bg)',
                            color:
                              emp.attendance_status === 'on_time'
                                ? 'var(--success)'
                                : emp.attendance_status === 'late'
                                ? 'var(--warning)'
                                : 'var(--danger)',
                          }}
                        >
                          {emp.attendance_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{emp.first_activity}</td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{activeHours}h</td>
                      <td style={{ color: emp.idle_seconds > 3600 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {idleHours}h
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.last_screenshot}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {emp.current_task || <span style={{ color: 'var(--text-muted)' }}>No task active</span>}
                      </td>
                      <td style={{ fontWeight: 700, color: '#f59e0b' }}>⭐ {emp.stars}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => onNavigate('/admin/monitoring/screenshots')}
                          title="Inspect Activity & Screenshots"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
