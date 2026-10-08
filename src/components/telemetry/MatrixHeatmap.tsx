import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Download,
  Info,
  Sliders,
  Maximize2,
  Users,
  Calendar,
  Activity,
  User,
  X,
  Keyboard,
  MousePointer,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { EmployeeRecord } from '../../types/roles';

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

// Default Seeded Employees
const DEFAULT_EMPLOYEES = [
  'Arsal (Dev)',
  'Alex Vance',
  'Elena Vance',
  'Marcus Bell',
  'Sarah Chen',
  'David Kim',
  'Jessica Lee',
  'Michael Torres',
];

// Preset 1: Hourly Employee Activity Matrix (Tracking every employee by shift hour)
export const HOURLY_EMPLOYEE_ACTIVITY_PRESET: HeatmapMatrixDataset = {
  id: 'hourly-employee-activity',
  title: 'Hourly Employee Activity Telemetry Matrix',
  subtitle: 'Real-time workstation activity intensity (%) across every team member per shift hour',
  xAxisLabel: 'Shift Hour',
  yAxisLabel: 'Employee',
  xLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
  yLabels: DEFAULT_EMPLOYEES,
  data: [
    [86.7, 92.4, 94.9, 32.1, 88.5, 96.7, 92.2, 70.3], // Arsal (Dev)
    [65.6, 81.8, 88.5, 25.0, 82.8, 91.0, 85.0, 68.2], // Alex Vance
    [75.5, 92.3, 93.9, 45.0, 92.6, 97.8, 93.0, 78.5], // Elena Vance
    [60.5, 72.1, 70.1, 18.5, 65.4, 78.7, 60.6, 52.7], // Marcus Bell
    [90.8, 95.4, 96.9, 55.0, 92.8, 98.5, 96.4, 88.0], // Sarah Chen
    [67.6, 83.9, 74.3, 22.0, 75.0, 83.0, 72.8, 64.0], // David Kim
    [88.2, 94.5, 96.0, 38.0, 90.0, 95.2, 93.4, 82.0], // Jessica Lee
    [71.6, 86.0, 89.2, 30.0, 84.0, 92.0, 88.5, 74.0], // Michael Torres
  ],
  minValue: 10,
  maxValue: 100,
  unit: '%',
};

// Preset 2: Weekly Employee Productivity & Cadence Matrix
export const WEEKLY_EMPLOYEE_CADENCE_PRESET: HeatmapMatrixDataset = {
  id: 'weekly-employee-cadence',
  title: 'Weekly Employee Productivity & Engagement Matrix',
  subtitle: 'Aggregated daily active hours and task delivery throughput over the sprint week',
  xAxisLabel: 'Sprint Day',
  yAxisLabel: 'Employee',
  xLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Sprint Avg'],
  yLabels: DEFAULT_EMPLOYEES,
  data: [
    [94.2, 91.8, 96.5, 92.0, 88.7, 45.0, 15.0, 88.6], // Arsal
    [92.0, 88.5, 82.3, 86.4, 95.0, 30.0, 10.0, 84.2], // Alex
    [95.0, 91.0, 89.4, 88.0, 94.2, 40.0, 12.0, 87.5], // Elena
    [62.4, 58.0, 54.2, 61.0, 68.5, 20.0,  5.0, 56.4], // Marcus
    [99.0, 96.5, 95.2, 98.0, 98.5, 50.0, 20.0, 94.8], // Sarah
    [88.4, 82.0, 79.5, 84.2, 86.0, 35.0, 10.0, 80.2], // David
    [96.2, 93.0, 91.8, 94.5, 95.0, 42.0, 18.0, 91.4], // Jessica
    [74.0, 71.5, 68.2, 70.0, 76.0, 25.0,  8.0, 68.5], // Michael
  ],
  minValue: 0,
  maxValue: 100,
  unit: '%',
};

// Preset 3: Multi-Factor Telemetry Metrics by Employee
export const EMPLOYEE_TELEMETRY_METRICS_PRESET: HeatmapMatrixDataset = {
  id: 'employee-telemetry-metrics',
  title: 'Employee Multi-Factor Telemetry & Quality Matrix',
  subtitle: 'Granular tracking of keyboard intensity, mouse interaction, focus ratio, punctuality, and star output',
  xAxisLabel: 'Telemetry Metric',
  yAxisLabel: 'Employee',
  xLabels: ['Keyboard', 'Mouse Moves', 'Mouse Clicks', 'Active Time', 'Focus %', 'Task Vel', 'Punctuality', 'Stars'],
  yLabels: DEFAULT_EMPLOYEES,
  data: [
    [96.4, 92.5, 89.0, 95.2, 91.0, 94.5, 98.0, 90.0], // Arsal
    [88.2, 85.0, 82.0, 88.5, 85.4, 86.0, 95.0, 85.0], // Alex
    [92.6, 94.0, 88.5, 92.0, 89.5, 91.0, 96.0, 88.0], // Elena
    [65.4, 58.0, 52.0, 62.0, 55.0, 60.0, 70.0, 45.0], // Marcus
    [98.5, 97.0, 96.0, 98.0, 96.5, 97.5, 99.0, 98.0], // Sarah
    [83.0, 80.0, 76.0, 82.0, 79.0, 84.0, 88.0, 80.0], // David
    [95.0, 93.0, 91.0, 94.0, 92.0, 93.0, 96.0, 92.0], // Jessica
    [84.0, 81.0, 78.0, 80.0, 76.0, 79.0, 85.0, 60.0], // Michael
  ],
  minValue: 30,
  maxValue: 100,
  unit: 'pts',
};

// Preset 4: Single Employee Day-by-Hour Activity Matrix
export function generateEmployeeDayHourPreset(employeeName: string): HeatmapMatrixDataset {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  
  // Seed realistic workday pattern
  const data: number[][] = [
    [84.5, 91.2, 95.0, 35.0, 88.2, 94.0, 92.5, 78.0], // Mon
    [88.0, 94.5, 96.2, 40.0, 91.0, 96.5, 95.0, 84.0], // Tue
    [92.5, 96.0, 97.8, 42.0, 93.5, 98.0, 96.2, 88.5], // Wed
    [86.0, 93.0, 94.5, 38.0, 89.0, 95.0, 91.0, 80.0], // Thu
    [82.0, 89.5, 92.0, 30.0, 85.0, 90.5, 87.0, 72.0], // Fri
    [25.0, 40.0, 45.0, 10.0, 20.0, 35.0, 30.0, 15.0], // Sat
    [10.0, 15.0, 20.0,  5.0, 10.0, 18.0, 12.0,  8.0], // Sun
  ];

  return {
    id: `employee-day-hour-${employeeName.toLowerCase().replace(/\s+/g, '-')}`,
    title: `${employeeName} — Hourly Activity Heatmap`,
    subtitle: `Detailed hour-by-hour telemetry and interaction intensity across the entire week`,
    xAxisLabel: 'Shift Hour',
    yAxisLabel: 'Workday',
    xLabels: hours,
    yLabels: days,
    data,
    minValue: 0,
    maxValue: 100,
    unit: '%',
  };
}

// Magma Colormap matching reference visual
// Low: deep dark purple/black -> Wine Magenta -> Vivid Coral/Red -> Warm Orange -> Peach Cream
export function getHeatmapColor(value: number, min = 10, max = 100): {
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
  const isLight = norm > 0.68;
  const textColor = isLight ? '#2a1708' : '#ffffff';
  const borderColor = `rgba(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)}, 0.4)`;

  return {
    bg: `rgb(${r}, ${g}, ${b})`,
    textColor,
    borderColor,
  };
}

interface MatrixHeatmapProps {
  initialPreset?: 'hourly' | 'weekly' | 'metrics';
  selectedEmployeeName?: string;
}

export const MatrixHeatmap: React.FC<MatrixHeatmapProps> = ({
  initialPreset = 'hourly',
  selectedEmployeeName,
}) => {
  const [activeMode, setActiveMode] = useState<'hourly' | 'weekly' | 'metrics' | 'individual'>(
    selectedEmployeeName ? 'individual' : initialPreset
  );
  const [selectedEmp, setSelectedEmp] = useState<string>(selectedEmployeeName || 'Arsal (Dev)');
  const [employeesList, setEmployeesList] = useState<string[]>(DEFAULT_EMPLOYEES);
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

  useEffect(() => {
    dataService.getEmployees('admin').then((emps) => {
      if (emps && emps.length > 0) {
        const names = emps.map((e) => e.name);
        setEmployeesList(names);
        if (!selectedEmp && names.length > 0) {
          setSelectedEmp(names[0]);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (selectedEmployeeName) {
      setSelectedEmp(selectedEmployeeName);
      setActiveMode('individual');
    }
  }, [selectedEmployeeName]);

  // Determine current active dataset based on mode
  let currentDataset: HeatmapMatrixDataset;
  if (activeMode === 'individual') {
    currentDataset = generateEmployeeDayHourPreset(selectedEmp);
  } else if (activeMode === 'weekly') {
    currentDataset = {
      ...WEEKLY_EMPLOYEE_CADENCE_PRESET,
      yLabels: employeesList.length === 8 ? employeesList : DEFAULT_EMPLOYEES,
    };
  } else if (activeMode === 'metrics') {
    currentDataset = {
      ...EMPLOYEE_TELEMETRY_METRICS_PRESET,
      yLabels: employeesList.length === 8 ? employeesList : DEFAULT_EMPLOYEES,
    };
  } else {
    currentDataset = {
      ...HOURLY_EMPLOYEE_ACTIVITY_PRESET,
      yLabels: employeesList.length === 8 ? employeesList : DEFAULT_EMPLOYEES,
    };
  }

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
    a.download = `${currentDataset.id}-activity-heatmap.csv`;
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
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {currentDataset.title}
            </h3>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
            {currentDataset.subtitle}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Preset Mode Switcher */}
          <div className="stitch-nav-pills">
            <button
              type="button"
              className={`nav-pill-item ${activeMode === 'hourly' ? 'active' : ''}`}
              onClick={() => setActiveMode('hourly')}
              title="Track every employee activity by shift hour"
            >
              <Activity size={13} />
              <span>Hourly Activity</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeMode === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveMode('weekly')}
              title="Weekly employee productivity matrix"
            >
              <Calendar size={13} />
              <span>Weekly Cadence</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeMode === 'metrics' ? 'active' : ''}`}
              onClick={() => setActiveMode('metrics')}
              title="Multi-factor employee telemetry"
            >
              <Users size={13} />
              <span>Telemetry Metrics</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${activeMode === 'individual' ? 'active' : ''}`}
              onClick={() => setActiveMode('individual')}
              title="Deep-dive single employee activity matrix"
            >
              <User size={13} />
              <span>Single Employee</span>
            </button>
          </div>

          {/* Employee Selector (when in individual mode) */}
          {activeMode === 'individual' && (
            <select
              className="stitch-select"
              style={{ width: 170, padding: '5px 10px', fontSize: 12 }}
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
            >
              {employeesList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

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

      {/* Main Matrix and Colorbar Container */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1.75rem 1rem',
          background: 'var(--surface-frosted-subdued)',
          borderRadius: 'var(--radius-card-sm)',
          border: '1px solid var(--surface-border-subtle)',
          overflowX: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2rem' }}>
          {/* Matrix Table with Y labels (Employees), Cells, and X labels */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Rows Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {currentDataset.yLabels.map((rowLabel, rIdx) => (
                <div key={rowLabel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Y Axis Label (Employee or Day) */}
                  <div
                    style={{
                      width: 120,
                      textAlign: 'right',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      paddingRight: 6,
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={rowLabel}
                  >
                    {rowLabel}
                  </div>

                  {/* Row Cells */}
                  <div style={{ display: 'flex', gap: 2 }}>
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
                          whileHover={{ scale: 1.08, zIndex: 10 }}
                          transition={{ duration: 0.12 }}
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
                            width: 54,
                            height: 44,
                            backgroundColor: bg,
                            color: textColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12.5,
                            fontWeight: 700,
                            fontFamily: 'Roboto, system-ui, monospace',
                            letterSpacing: '-0.02em',
                            cursor: 'pointer',
                            userSelect: 'none',
                            position: 'relative',
                            boxShadow: isHovered
                              ? '0 4px 14px rgba(0,0,0,0.35), inset 0 0 0 1.5px #ffffff'
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

            {/* X Axis Column Labels */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <div style={{ width: 120 }} /> {/* Spacer for Y label alignment */}
              <div style={{ display: 'flex', gap: 2 }}>
                {currentDataset.xLabels.map((colLabel) => (
                  <div
                    key={colLabel}
                    style={{
                      width: 54,
                      textAlign: 'center',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={colLabel}
                  >
                    {colLabel}
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis Dimension Name */}
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--text-secondary)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {currentDataset.xAxisLabel}
            </div>
          </div>

          {/* Colorbar Scale Legend (Exact visual replica of reference colorbar) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Color Gradient Strip */}
            <div
              style={{
                width: 18,
                height: 350,
                borderRadius: 2,
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
                height: 350,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 700,
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
              Employee Activity: <strong>{hoveredCell.rowLabel}</strong> at <strong>{hoveredCell.colLabel}</strong> =
              <span style={{ marginLeft: 6, fontWeight: 800, color: 'var(--color-secondary)' }}>
                {hoveredCell.val.toFixed(1)} {currentDataset.unit || '%'} Intensity
              </span>
            </span>
          ) : (
            <span>Hover over any employee cell to inspect activity score, or click to open full workstation diagnostic telemetry.</span>
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
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Employee Telemetry Diagnostics</span>
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
                    <div style={{ fontSize: 30, fontWeight: 900, fontFamily: 'monospace' }}>
                      {selectedCell.val.toFixed(1)} {selectedCell.unit}
                    </div>
                  </div>
                  <Flame size={36} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <User size={13} />
                      <span>Employee</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{selectedCell.rowLabel}</div>
                  </div>

                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <Clock size={13} />
                      <span>Interval / Slot</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{selectedCell.colLabel}</div>
                  </div>

                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <Keyboard size={13} />
                      <span>Est. Keypresses</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                      {Math.round(selectedCell.val * 34)} keys
                    </div>
                  </div>

                  <div className="frosted-card frosted-card-sm" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <MousePointer size={13} />
                      <span>Mouse Events</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                      {Math.round(selectedCell.val * 88)} actions
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Compliance Guarantee:</span>
                  <span style={{ color: 'var(--status-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Zero Keylogging &bull; Aggregates Only
                  </span>
                </div>

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
