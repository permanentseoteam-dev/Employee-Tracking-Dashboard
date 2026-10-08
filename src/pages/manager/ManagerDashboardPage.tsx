import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  AlertTriangle,
  Coffee,
  Play,
  CheckCircle2,
  Percent,
  RefreshCw,
  Eye,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord } from '../../types/roles';

interface ManagerDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const ManagerDashboardPage: React.FC<ManagerDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<{
    totalEmployees: number;
    online: number;
    late: number;
    idle: number;
    onBreak: number;
    tasksInProgress: number;
    tasksCompleted: number;
    teamAttendanceRate: number;
  } | null>(null);

  const [teamEmployees, setTeamEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiData, empData] = await Promise.all([
        dataService.getManagerKpis(user.id),
        dataService.getEmployees('manager', user.id),
      ]);
      setKpis(kpiData);
      setTeamEmployees(empData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Operations Center</h1>
          <p className="page-subtitle">
            Lead: {user.name} &bull; {user.team_name || 'Assigned Team'} &bull; Real-time Team Telemetry
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh Team</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('/manager/screenshots')}
          >
            <Camera size={14} />
            <span>Team Screenshots</span>
          </button>
        </div>
      </div>

      {/* 8 Team KPI Cards */}
      {loading || !kpis ? (
        <div className="metrics-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
              <div className="stat-header">Loading team metric...</div>
              <div className="stat-value">--</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="metrics-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span>My Team Members</span>
              <Users size={15} color="var(--success)" />
            </div>
            <div className="stat-value">{kpis.totalEmployees}</div>
            <div className="stat-footer">Assigned directly to you</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Online Now</span>
              <span className="status-indicator-dot" />
            </div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{kpis.online}</div>
            <div className="stat-footer">Active, Idle or On Break</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Late Today</span>
              <Clock size={15} color="var(--warning)" />
            </div>
            <div className="stat-value" style={{ color: kpis.late > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {kpis.late}
            </div>
            <div className="stat-footer">Arrived past grace period</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Currently Idle</span>
              <AlertTriangle size={15} color={kpis.idle > 0 ? 'var(--warning)' : 'var(--text-muted)'} />
            </div>
            <div className="stat-value">{kpis.idle}</div>
            <div className="stat-footer">Inactivity detected</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>On Break</span>
              <Coffee size={15} color="var(--primary)" />
            </div>
            <div className="stat-value">{kpis.onBreak}</div>
            <div className="stat-footer">Namaz or General break</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Tasks In Progress</span>
              <Play size={15} color="var(--primary)" />
            </div>
            <div className="stat-value">{kpis.tasksInProgress}</div>
            <div className="stat-footer">Active team work</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Tasks Completed</span>
              <CheckCircle2 size={15} color="var(--success)" />
            </div>
            <div className="stat-value">{kpis.tasksCompleted}</div>
            <div className="stat-footer">Delivered this sprint</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Team Attendance</span>
              <Percent size={15} color="var(--success)" />
            </div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {kpis.teamAttendanceRate}%
            </div>
            <div className="stat-footer">Team punctuality ratio</div>
          </div>
        </div>
      )}

      {/* Real-time Team Status Table */}
      <div className="content-card">
        <div className="content-card-title">
          <span>Assigned Team Roster ({teamEmployees.length} members)</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scoped strictly to your team</span>
        </div>

        {teamEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
            No employees assigned to your management scope.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Attendance</th>
                  <th>Active Time</th>
                  <th>Idle Time</th>
                  <th>Current Task</th>
                  <th>Last Screenshot</th>
                  <th>Stars</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {teamEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div>{emp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor:
                            emp.status === 'active'
                              ? 'var(--success-bg)'
                              : emp.status === 'idle'
                              ? 'var(--warning-bg)'
                              : emp.status === 'on_break'
                              ? 'rgba(59,130,246,0.12)'
                              : 'rgba(100,116,139,0.12)',
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
                              : 'var(--warning-bg)',
                          color:
                            emp.attendance_status === 'on_time'
                              ? 'var(--success)'
                              : 'var(--warning)',
                        }}
                      >
                        {emp.attendance_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{(emp.active_seconds / 3600).toFixed(1)}h</td>
                    <td style={{ color: emp.idle_seconds > 3600 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {(emp.idle_seconds / 3600).toFixed(1)}h
                    </td>
                    <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.current_task || <span style={{ color: 'var(--text-muted)' }}>None active</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.last_screenshot}</td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>⭐ {emp.stars}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => onNavigate('/manager/screenshots')}
                        title="Inspect Team Member Screenshots"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
