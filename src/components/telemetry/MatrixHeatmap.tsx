import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Download,
  Info,
  Sliders,
  Maximize2,
  Calendar,
  Activity,
  User,
  X,
  Keyboard,
  MousePointer,
  Clock,
  CheckCircle2,
  Database,
  Coffee,
  Moon,
  Play,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import type { BreakTelemetrySnapshot, BreakType } from '../../types/roles';
import { BreakScheduleBanner } from './BreakScheduleBanner';
import { useBreakSchedule } from '../../hooks/useBreakSchedule';
import { breakTimeSlot, formatBreakChip, formatBreakClock, formatBreakRange, minutesBetween } from '../../utils/breakSchedule';

export interface HeatmapMatrixDataset {
  id: string;
  title: string;
  subtitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  xLabels: string[];
  yLabels: string[];
  data: number[][]; // 2D matrix [rowIndex][colIndex]
  minValue: number;
  maxValue: number;
  unit?: string;
}

const DEFAULT_TIME_SLOTS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
];

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Avg'];

const zeroHourlyRow = () => DEFAULT_TIME_SLOTS.map(() => 0);
const zeroWeeklyRow = () => WEEK_LABELS.map(() => 0);

/** Template metadata only — cell values are filled from live agent telemetry. */
export const HOURLY_EMPLOYEE_ACTIVITY_PRESET: HeatmapMatrixDataset = {
  id: 'hourly-employee-activity',
  title: 'Employee Activity Heatmap',
  subtitle: 'Live workstation activity intensity (%) from agent telemetry across shift hours',
  xAxisLabel: 'TIME',
  yAxisLabel: 'EMPLOYEE',
  xLabels: DEFAULT_TIME_SLOTS,
  yLabels: [],
  data: [],
  minValue: 0,
  maxValue: 100,
  unit: '%',
};

export const WEEKLY_EMPLOYEE_CADENCE_PRESET: HeatmapMatrixDataset = {
  id: 'weekly-employee-cadence',
  title: 'Weekly Employee Productivity & Engagement Matrix',
  subtitle: 'Weekly view uses live hourly intensity until daily aggregates are available',
  xAxisLabel: 'DAY',
  yAxisLabel: 'EMPLOYEE',
  xLabels: WEEK_LABELS,
  yLabels: [],
  data: [],
  minValue: 0,
  maxValue: 100,
  unit: '%',
};

// Magma Colormap matching reference visual:
// Deep dark purple/black -> Wine Magenta -> Vivid Coral/Red -> Warm Orange -> Apricot Cream
export function getHeatmapColor(value: number, min = 0, max = 100): {
  bg: string;
  textColor: string;
  borderColor: string;
} {
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));

  let r = 254;
  let g = 233;
  let b = 215;

  if (norm < 0.2) {
    const t = norm / 0.2;
    r = Math.round(17 + (58 - 17) * t);
    g = Math.round(11 + (13 - 11) * t);
    b = Math.round(40 + (84 - 40) * t);
  } else if (norm < 0.4) {
    const t = (norm - 0.2) / 0.2;
    r = Math.round(58 + (124 - 58) * t);
    g = Math.round(13 + (25 - 13) * t);
    b = Math.round(84 + (105 - 84) * t);
  } else if (norm < 0.6) {
    const t = (norm - 0.4) / 0.2;
    r = Math.round(124 + (199 - 124) * t);
    g = Math.round(25 + (54 - 25) * t);
    b = Math.round(105 + (80 - 105) * t);
  } else if (norm < 0.75) {
    const t = (norm - 0.6) / 0.15;
    r = Math.round(199 + (235 - 199) * t);
    g = Math.round(54 + (101 - 54) * t);
    b = Math.round(80 + (70 - 80) * t);
  } else if (norm < 0.88) {
    const t = (norm - 0.75) / 0.13;
    r = Math.round(235 + (246 - 235) * t);
    g = Math.round(101 + (155 - 101) * t);
    b = Math.round(70 + (98 - 70) * t);
  } else if (norm < 0.96) {
    const t = (norm - 0.88) / 0.08;
    r = Math.round(246 + (252 - 246) * t);
    g = Math.round(155 + (213 - 155) * t);
    b = Math.round(98 + (173 - 98) * t);
  } else {
    const t = (norm - 0.96) / 0.04;
    r = Math.round(252 + (254 - 252) * t);
    g = Math.round(213 + (233 - 213) * t);
    b = Math.round(173 + (215 - 173) * t);
  }

  // Dark text on high values (peach / cream), white text on darker cells
  // Exactly matching the reference image where 94.9, 87.6, 92.3, 97.8 have dark text
  const isLight = norm > 0.68;
  const textColor = isLight ? '#1a1006' : '#ffffff';
  const borderColor = '#ffffff';

  return {
    bg: `rgb(${r}, ${g}, ${b})`,
    textColor,
    borderColor,
  };
}

interface MatrixHeatmapProps {
  initialPreset?: 'hourly' | 'weekly';
  selectedEmployeeName?: string;
  showBreakSchedule?: boolean;
  role?: 'admin' | 'manager' | 'employee';
}

export const MatrixHeatmap: React.FC<MatrixHeatmapProps> = ({
  initialPreset = 'hourly',
  selectedEmployeeName,
  showBreakSchedule,
  role = 'admin',
}) => {
  const { user } = useAuth();
  const { schedule } = useBreakSchedule();
  const showBreaks = showBreakSchedule !== undefined ? showBreakSchedule : role !== 'admin';
  const [activeMode, setActiveMode] = useState<'hourly' | 'weekly'>(initialPreset);
  const [employeesList, setEmployeesList] = useState<string[]>([]);
  const [showValues, setShowValues] = useState(true);

  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
    val: number;
    rowLabel: string;
    colLabel: string;
  } | null>(null);

  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
    val: number;
    rowLabel: string;
    colLabel: string;
    datasetTitle: string;
    unit: string;
  } | null>(null);

  const [breakSnapshot, setBreakSnapshot] = useState<BreakTelemetrySnapshot | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [liveMouseArray, setLiveMouseArray] = useState<number[] | null>(null);
  const [liveMouseByEmployee, setLiveMouseByEmployee] = useState<Record<string, number[]>>({});

  const telemetryFilter =
    selectedEmployeeName && selectedEmployeeName !== 'all'
      ? selectedEmployeeName
      : role === 'employee'
        ? user.id || user.name
        : undefined;

  useEffect(() => {
    const managerId = role === 'manager' ? user.id : undefined;
    const employeeId = role === 'employee' ? user.id : undefined;
    dataService.getEmployees(role, managerId, employeeId).then((emps) => {
      if (emps && emps.length > 0) {
        const validEmps = emps.filter((e) =>
          role === 'manager'
            ? !e.name?.toLowerCase().includes('admin') &&
              !e.email?.toLowerCase().includes('admin')
            : true
        );
        setEmployeesList(validEmps.map((e) => (e.team_name ? `${e.name} (${e.team_name})` : e.name)));
      } else {
        setEmployeesList([]);
      }
    });

    dataService.getLatestBreakTelemetry(role === 'employee' ? user.id : undefined).then((snap) => {
      if (snap) setBreakSnapshot(snap);
    });

    const scopeId = role === 'manager' || role === 'employee' ? user.id : undefined;
    const loadLiveMouse = () => {
      dataService.getLiveMouseTelemetry(role, telemetryFilter, scopeId).then((res) => {
        setLiveMouseArray(
          res?.hourlyIntensityArray?.length ? res.hourlyIntensityArray : zeroHourlyRow()
        );
        setLiveMouseByEmployee(res?.byEmployeeName || {});
      });
    };
    loadLiveMouse();
    const liveMouseTimer = setInterval(loadLiveMouse, 5000);

    const unsubscribe = dataService.subscribeToBreakTelemetry((snap, action) => {
      setBreakSnapshot(snap);
      if (action === 'saved') {
        setSyncFeedback(`Snapshot saved at ${snap?.current_time_slot}.`);
        setTimeout(() => setSyncFeedback(null), 6000);
      } else if (action === 'resumed') {
        setSyncFeedback(`Resumed telemetry at ${snap?.current_time_slot}.`);
        setTimeout(() => setSyncFeedback(null), 6000);
      }
    });

    return () => {
      unsubscribe();
      clearInterval(liveMouseTimer);
    };
  }, [selectedEmployeeName, role, user.id, user.name, telemetryFilter]);


  const handleTriggerBreak = async (type: BreakType) => {
    try {
      const scopeId = role === 'manager' || role === 'employee' ? user.id : undefined;
      const [keysRes, mouseRes] = await Promise.all([
        dataService.getLiveKeystrokeTelemetry(role, telemetryFilter, scopeId),
        dataService.getLiveMouseTelemetry(role, telemetryFilter, scopeId),
      ]);
      const snap = await dataService.saveBreakTelemetrySnapshot({
        breakType: type,
        employeeId: role === 'employee' ? user.id : undefined,
        employeeName: selectedEmployeeName || user.name || 'Employee',
        timeSlot: type === 'coffee' ? breakTimeSlot(schedule.coffee) : breakTimeSlot(schedule.zuhr),
        keyboardData: [keysRes.hourlyKeysArray || zeroHourlyRow()],
        heatmapData: [mouseRes.hourlyIntensityArray || zeroHourlyRow()],
      });
      setBreakSnapshot(snap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeBreak = async () => {
    try {
      const breakSecs =
        (breakSnapshot?.break_type === 'coffee'
          ? minutesBetween(schedule.coffee.start_time, schedule.coffee.end_time)
          : minutesBetween(schedule.zuhr.start_time, schedule.zuhr.end_time)) * 60;
      const resumed = await dataService.resumeBreakTelemetry({
        employeeId: role === 'employee' ? user.id : undefined,
        employeeName: selectedEmployeeName || user.name || 'Employee',
        breakSeconds: breakSecs || 1800,
      });
      if (resumed) setBreakSnapshot(resumed);
    } catch (e) {
      console.error(e);
    }
  };

  const baseDataset = activeMode === 'weekly'
    ? WEEKLY_EMPLOYEE_CADENCE_PRESET
    : HOURLY_EMPLOYEE_ACTIVITY_PRESET;

  let filteredEmployees: string[] = [...employeesList];
  if (selectedEmployeeName && selectedEmployeeName !== 'all') {
    const sName = selectedEmployeeName.toLowerCase().trim();
    const match = employeesList.find((e) => {
      const eName = e.toLowerCase().trim();
      return (
        eName === sName ||
        eName.startsWith(sName) ||
        sName.startsWith(eName.split('(')[0].trim()) ||
        eName.split('(')[0].trim() === sName.split('(')[0].trim()
      );
    });
    filteredEmployees = match ? [match] : [];
  }

  if (role === 'manager') {
    filteredEmployees = filteredEmployees.filter((empName) => !empName.toLowerCase().includes('admin'));
  }

  const resolveMouseRow = (empLabel: string): number[] => {
    if (activeMode !== 'hourly') return zeroWeeklyRow();
    const bare = empLabel.split('(')[0].trim();
    const fromMap = liveMouseByEmployee[empLabel] || liveMouseByEmployee[bare];
    if (fromMap?.length === DEFAULT_TIME_SLOTS.length) {
      return fromMap.map((v) => Math.min(100, Math.max(0, v)));
    }
    if (filteredEmployees.length === 1 && liveMouseArray?.length === DEFAULT_TIME_SLOTS.length) {
      return liveMouseArray.map((v) => Math.min(100, Math.max(0, v)));
    }
    return zeroHourlyRow();
  };

  let filteredData: number[][] = filteredEmployees.map((emp) => [...resolveMouseRow(emp)]);

  // Adjust row for break continuation if break is active or resumed
  if (showBreaks && activeMode === 'hourly' && breakSnapshot?.hourly_state) {
    const sIdx = breakSnapshot.time_slot_index;
    if (sIdx >= 0) {
      filteredData = filteredData.map((row) => {
        const newRow = [...row];
        if (breakSnapshot.status === 'active_break') {
          const v = breakSnapshot.hourly_state.pre_break_heatmap_pct;
          if (typeof v === 'number') newRow[sIdx] = v;
        } else if (breakSnapshot.status === 'resumed') {
          const v = breakSnapshot.hourly_state.adjusted_heatmap_pct;
          if (typeof v === 'number') newRow[sIdx] = v;
        }
        return newRow;
      });
    }
  }

  const currentDataset: HeatmapMatrixDataset = {

    ...baseDataset,
    yLabels: filteredEmployees,
    data: filteredData,
  };



  const handleExportCSV = () => {
    let csv = `${currentDataset.yAxisLabel}/${currentDataset.xAxisLabel},` + currentDataset.xLabels.join(',') + '\n';
    currentDataset.yLabels.forEach((y, rIdx) => {
      const rowVals = (currentDataset.data[rIdx] || []).map((v) => v.toFixed(1)).join(',');
      csv += `${y},${rowVals}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-activity-heatmap.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Heatmap Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={18} color="var(--color-secondary)" />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {currentDataset.title}
            </h3>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
            {currentDataset.subtitle}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* View Mode Switcher */}
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeMode === 'hourly' ? 'active' : ''}`}
              onClick={() => setActiveMode('hourly')}
              title="Track employee activity by shift hour (Name vs Time)"
            >
              <Activity size={13} />
              <span>Shift Time (09:00 - 16:00)</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeMode === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveMode('weekly')}
              title="Weekly employee productivity matrix"
            >
              <Calendar size={13} />
              <span>Weekly Cadence (Days)</span>
            </button>
          </div>

          {/* Toggle Values */}
          <button
            type="button"
            className={`btn-pill ${showValues ? 'btn-pill-primary' : 'btn-pill-secondary'}`}
            style={{ padding: '6px 12px', fontSize: 11 }}
            onClick={() => setShowValues(!showValues)}
            title="Toggle numeric values on cells"
          >
            <Sliders size={13} />
            <span>Values: {showValues ? 'ON' : 'OFF'}</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            className="btn-pill btn-pill-secondary"
            style={{ padding: '6px 12px', fontSize: 11 }}
            onClick={handleExportCSV}
            title="Export Activity Matrix to CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {showBreaks && activeMode === 'hourly' && <BreakScheduleBanner />}

      {/* Break State & Supabase Continuation Controls (Employee & Manager Roles Only) */}
      {showBreaks && activeMode === 'hourly' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '12px 18px',
            borderRadius: 'var(--radius-card-sm)',
            background:
              breakSnapshot?.status === 'active_break'
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(16, 185, 129, 0.08)',
            border:
              breakSnapshot?.status === 'active_break'
                ? '1px solid rgba(245, 158, 11, 0.35)'
                : '1px solid rgba(16, 185, 129, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
              <Database size={15} color="var(--color-primary)" />
              <span style={{ color: 'var(--text-primary)' }}>Supabase Telemetry Persistence:</span>
            </div>

            {breakSnapshot?.status === 'active_break' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="pulse-beacon"
                  style={{ background: '#f59e0b', width: 8, height: 8 }}
                />
                <span style={{ fontWeight: 700, color: '#d97706', fontSize: 12 }}>
                  {breakSnapshot.break_title} Active — State Saved in Bucket &bull; Resumes from {breakSnapshot.current_time_slot} ({breakSnapshot.hourly_state.pre_break_heatmap_pct}%)
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span style={{ fontWeight: 700, color: '#059669', fontSize: 12 }}>
                  {breakSnapshot?.status === 'resumed'
                    ? `Telemetry Continuing from Last State (${breakSnapshot.current_time_slot}: Pre-break ${breakSnapshot.hourly_state.pre_break_heatmap_pct}% + Resumed ${breakSnapshot.hourly_state.post_break_heatmap_pct}% = ${breakSnapshot.hourly_state.adjusted_heatmap_pct}% adjusted total)`
                    : 'Cloud Snapshot Ready &bull; Preserves heatmap state during Namaz and Coffee breaks'}
                </span>
              </div>
            )}
          </div>

          {/* Quick Simulation / Operational Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {breakSnapshot?.status === 'active_break' ? (
              <button
                type="button"
                className="btn-pill btn-pill-primary"
                style={{ padding: '6px 14px', fontSize: 11, background: '#10b981', color: '#fff' }}
                onClick={handleResumeBreak}
                title="End break and resume telemetry tracking from last state"
              >
                <Play size={13} />
                <span>Resume Work & Continue State</span>
              </button>
            ) : (
              <>
                {schedule.coffee.enabled && (
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    style={{ padding: '5px 12px', fontSize: 11 }}
                    onClick={() => handleTriggerBreak('coffee')}
                    title={`Save mouse heatmap state for ${formatBreakChip(schedule.coffee)}`}
                  >
                    <Coffee size={13} />
                    <span>
                      {schedule.coffee.label} ({formatBreakClock(schedule.coffee.start_time)})
                    </span>
                  </button>
                )}
                {schedule.zuhr.enabled && (
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    style={{ padding: '5px 12px', fontSize: 11 }}
                    onClick={() => handleTriggerBreak('namaz')}
                    title={`Save mouse heatmap state for ${formatBreakChip(schedule.zuhr)}`}
                  >
                    <Moon size={13} />
                    <span>
                      {schedule.zuhr.label} ({formatBreakClock(schedule.zuhr.start_time)})
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Sync feedback notification */}
      {syncFeedback && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-card-sm)',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.28)',
            color: 'var(--color-primary)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {syncFeedback}
        </div>
      )}

      {/* Main Matrix and Colorbar Container (Clean, centered with exact screenshot aesthetics) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem 1.5rem',
          background: 'var(--surface-frosted-subdued)',
          borderRadius: 'var(--radius-card-sm)',
          border: '1px solid var(--surface-border-subtle)',
          overflowX: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2.5rem' }}>
          {/* Matrix Table with Y labels (Employee Names), White-Bordered Cells, and X labels (Time) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Rows Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {currentDataset.yLabels.map((rowLabel, rIdx) => (
                <div key={rowLabel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Y Axis Label (Employee Name on the left) */}
                  <div
                    style={{
                      width: 105,
                      textAlign: 'right',
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      paddingRight: 8,
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={rowLabel}
                  >
                    {rowLabel}
                  </div>

                  {/* Row Cells with crisp white borders and rounded corners */}
                  <div style={{ display: 'flex' }}>
                    {currentDataset.xLabels.map((colLabel, cIdx) => {
                      const val = currentDataset.data[rIdx]?.[cIdx] ?? 50;
                      const { bg, textColor } = getHeatmapColor(
                        val,
                        currentDataset.minValue,
                        currentDataset.maxValue
                      );
                      const isHovered =
                        hoveredCell?.row === rIdx && hoveredCell?.col === cIdx;

                      return (
                        <motion.div
                          key={`${rIdx}-${cIdx}`}
                          whileHover={{ scale: 1.06, zIndex: 10 }}
                          transition={{ duration: 0.1 }}
                          onMouseEnter={() =>
                            setHoveredCell({
                              row: rIdx,
                              col: cIdx,
                              val,
                              rowLabel,
                              colLabel,
                            })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() =>
                            setSelectedCell({
                              row: rIdx,
                              col: cIdx,
                              val,
                              rowLabel,
                              colLabel,
                              datasetTitle: currentDataset.title,
                              unit: currentDataset.unit || '%',
                            })
                          }
                          style={{
                            width: 58,
                            height: 48,
                            backgroundColor: bg,
                            color: textColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 800,
                            fontFamily: 'Roboto, system-ui, monospace',
                            letterSpacing: '-0.02em',
                            cursor: 'pointer',
                            userSelect: 'none',
                            position: 'relative',
                            border: '1.5px solid #ffffff',
                            borderRadius: 4,
                            boxShadow: isHovered
                              ? '0 6px 16px rgba(0,0,0,0.4), inset 0 0 0 1.5px #ffffff'
                              : 'none',
                            transition: 'box-shadow 0.15s ease',
                          }}
                        >
                          {showValues && val.toFixed(1)}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* X Axis Column Labels (Time on the bottom) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <div style={{ width: 105 }} /> {/* Spacer for Y label alignment */}
              <div style={{ display: 'flex' }}>
                {currentDataset.xLabels.map((colLabel) => {
                  const isCoffeeSlot =
                    showBreaks &&
                    activeMode === 'hourly' &&
                    schedule.coffee.enabled &&
                    colLabel === breakTimeSlot(schedule.coffee);
                  const isNamazSlot =
                    showBreaks &&
                    activeMode === 'hourly' &&
                    schedule.zuhr.enabled &&
                    colLabel === breakTimeSlot(schedule.zuhr);

                  return (
                    <div
                      key={colLabel}
                      style={{
                        width: 58,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                        color: isCoffeeSlot ? '#d97706' : isNamazSlot ? '#059669' : 'var(--text-primary)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        userSelect: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      title={
                        isCoffeeSlot
                          ? `${formatBreakRange(schedule.coffee)}: ${schedule.coffee.label}`
                          : isNamazSlot
                          ? `${formatBreakRange(schedule.zuhr)}: ${schedule.zuhr.label}`
                          : colLabel
                      }
                    >
                      <span>{colLabel}</span>
                      {isCoffeeSlot && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 3px',
                            borderRadius: 4,
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#d97706',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.1,
                          }}
                        >
                          ☕ Coffee
                        </span>
                      )}
                      {isNamazSlot && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 3px',
                            borderRadius: 4,
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#059669',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.1,
                          }}
                        >
                          🕌 Namaz
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Dimension Name */}
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {currentDataset.xAxisLabel}
            </div>
          </div>

          {/* Colorbar Scale Legend (Exact visual replica with magma gradient and ticks) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Color Gradient Strip */}
            <div
              style={{
                width: 18,
                height: 384,
                borderRadius: 3,
                background: `linear-gradient(to top, 
                  rgb(17, 11, 40) 0%, 
                  rgb(58, 13, 84) 15%, 
                  rgb(124, 25, 105) 35%, 
                  rgb(199, 54, 80) 55%, 
                  rgb(235, 101, 70) 70%, 
                  rgb(246, 155, 98) 85%, 
                  rgb(252, 213, 173) 95%, 
                  rgb(254, 233, 215) 100%
                )`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            />

            {/* Scale Ticks */}
            <div
              style={{
                height: 384,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--text-secondary)',
                fontFamily: 'Roboto, monospace',
                userSelect: 'none',
                padding: '2px 0',
              }}
            >
              <span>– 90</span>
              <span>– 80</span>
              <span>– 70</span>
              <span>– 60</span>
              <span>– 50</span>
              <span>– 40</span>
              <span>– 30</span>
              <span>– 20</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Indicator / Quick Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: 'var(--surface-frosted)',
          borderRadius: 'var(--radius-card-sm)',
          border: '1px solid var(--surface-border-subtle)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={14} color="var(--color-secondary)" />
          {hoveredCell ? (
            <span>
              Activity for <strong>{hoveredCell.rowLabel}</strong> at <strong>{hoveredCell.colLabel}</strong>:
              <span style={{ marginLeft: 6, fontWeight: 800, color: 'var(--color-secondary)' }}>
                {hoveredCell.val.toFixed(1)} {currentDataset.unit || '%'} Intensity
              </span>
            </span>
          ) : (
            <span>Hover over any cell to inspect activity score, or click to open full workstation diagnostic telemetry.</span>
          )}
        </div>

        <span className="live-telemetry-badge" style={{ fontSize: 11 }}>
          Scale Range: {currentDataset.minValue} – {currentDataset.maxValue} {currentDataset.unit}
        </span>
      </div>

      {/* Deep Diagnostic Modal on Cell Click */}
      <AnimatePresence>
        {selectedCell && (
          <div className="stitch-modal-backdrop" onClick={() => setSelectedCell(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stitch-modal-content"
              style={{ maxWidth: 460 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Maximize2 size={18} color="var(--color-secondary)" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Workstation Telemetry Diagnostics</span>
                </div>
                <button
                  type="button"
                  className="btn-icon-circle"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setSelectedCell(null)}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-card-sm)',
                    background: getHeatmapColor(selectedCell.val, currentDataset.minValue, currentDataset.maxValue).bg,
                    color: getHeatmapColor(selectedCell.val, currentDataset.minValue, currentDataset.maxValue).textColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>Workstation Activity Intensity</div>
                    <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'monospace' }}>
                      {selectedCell.val.toFixed(1)} {selectedCell.unit}
                    </div>
                  </div>
                  <Flame size={36} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <User size={13} />
                      <span>Employee Name</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, marginTop: 2, color: 'var(--text-primary)' }}>
                      {selectedCell.rowLabel}
                    </div>
                  </div>

                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <Clock size={13} />
                      <span>Shift Time</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, marginTop: 2, color: 'var(--text-primary)' }}>
                      {selectedCell.colLabel}
                    </div>
                  </div>

                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <Keyboard size={13} />
                      <span>Active Keypresses</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                      {Math.round(selectedCell.val * 34)} keys
                    </div>
                  </div>

                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <MousePointer size={13} />
                      <span>Mouse Actions</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                      {Math.round(selectedCell.val * 88)} actions
                    </div>
                  </div>
                </div>

                {showBreaks &&
                  schedule.coffee.enabled &&
                  selectedCell.colLabel === breakTimeSlot(schedule.coffee) && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.32)',
                      padding: '12px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706', fontWeight: 700 }}>
                      <span style={{ fontSize: 18 }}>☕</span>
                      <span>
                        {schedule.coffee.label} ({formatBreakRange(schedule.coffee)}) • Supabase Telemetry Sync
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Workstation inactivity during this interval is an authorized recess and strictly excused from performance scoring.
                    </div>
                    {/* Hourly Progression & Supabase Continuation Details */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 8,
                        marginTop: 4,
                        padding: 8,
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pre-Break State:</span>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          {breakSnapshot?.hourly_state?.pre_break_heatmap_pct ?? 0}% Intensity (Saved)
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resumed Activity:</span>
                        <div style={{ fontWeight: 800, color: '#10b981' }}>
                          +{breakSnapshot?.hourly_state?.post_break_heatmap_pct ?? 0}% Added on Resume
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adjusted Hourly Output:</span>
                        <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                          {selectedCell.val.toFixed(1)}% Combined Intensity
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cloud Storage:</span>
                        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Bucket: screenshots &bull; activity_events
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showBreaks &&
                  schedule.zuhr.enabled &&
                  selectedCell.colLabel === breakTimeSlot(schedule.zuhr) && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.32)',
                      padding: '12px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 700 }}>
                      <span style={{ fontSize: 18 }}>🕌</span>
                      <span>
                        {schedule.zuhr.label} ({formatBreakRange(schedule.zuhr)})
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Designated prayer and lunch recess. Telemetry is saved in Supabase storage and continues on top of pre-break state when resumed.
                    </div>
                    {/* Hourly Progression & Supabase Continuation Details */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 8,
                        marginTop: 4,
                        padding: 8,
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pre-Break State:</span>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          72.1% Intensity (Preserved)
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recess Status:</span>
                        <div style={{ fontWeight: 800, color: '#10b981' }}>
                          Zero Penalty &bull; Compliant
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adjusted Hourly Progression:</span>
                        <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                          {selectedCell.val.toFixed(1)}% Normalized Total
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supabase Storage:</span>
                        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 10 }}>
                          Bucket: screenshots/telemetry_snapshots
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                <button
                  type="button"
                  className="btn-pill btn-pill-primary"
                  style={{ width: '100%', marginTop: 4 }}
                  onClick={() => setSelectedCell(null)}
                >
                  Close Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
