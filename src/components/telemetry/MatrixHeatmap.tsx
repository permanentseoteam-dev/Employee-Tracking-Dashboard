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
} from 'lucide-react';
import { dataService } from '../../services/dataService';

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

// 8 Employees (replaces BERT, LSTM, Attn, GloVe, ELMo, ERNIE, RoBERTa, T5)
const DEFAULT_EMPLOYEES = [
  'Arsal',
  'Alex Vance',
  'Elena Vance',
  'Marcus Bell',
  'Sarah Chen',
  'David Kim',
  'Jessica Lee',
  'Michael Torres',
];

// 8 Time slots (replaces CoLA, MNLI, MRPC, QNLI, QQP, RTE, SST-2, STS-B)
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

// Preset 1: Hourly Employee Activity Matrix (Exact replica with Employee Names & Time)
export const HOURLY_EMPLOYEE_ACTIVITY_PRESET: HeatmapMatrixDataset = {
  id: 'hourly-employee-activity',
  title: 'Employee Activity Heatmap',
  subtitle: 'Real-time telemetry and workstation activity intensity (%) per employee across shift hours',
  xAxisLabel: 'TIME',
  yAxisLabel: 'EMPLOYEE',
  xLabels: DEFAULT_TIME_SLOTS,
  yLabels: DEFAULT_EMPLOYEES,
  data: [
    [60.5, 86.7, 89.3, 92.7, 72.1, 70.1, 94.9, 87.6], // Arsal
    [11.6, 65.6, 81.8, 74.6, 62.5, 57.4, 82.8, 70.3], // Alex Vance
    [18.6, 67.6, 83.9, 74.3, 60.1, 58.4, 83.0, 72.8], // Elena Vance
    [18.5, 65.4, 78.7, 70.8, 60.6, 52.7, 81.9, 64.4], // Marcus Bell
    [32.1, 67.2, 84.7, 75.5, 61.1, 57.4, 89.3, 70.3], // Sarah Chen
    [75.5, 92.3, 93.9, 97.3, 75.2, 92.6, 97.8, 93.0], // David Kim
    [67.8, 90.8, 92.3, 95.4, 74.3, 88.2, 96.7, 92.2], // Jessica Lee
    [71.6, 92.2, 92.8, 96.9, 75.1, 92.8, 97.5, 93.1], // Michael Torres
  ],
  minValue: 10,
  maxValue: 100,
  unit: '%',
};

// Preset 2: Weekly Employee Productivity Matrix
export const WEEKLY_EMPLOYEE_CADENCE_PRESET: HeatmapMatrixDataset = {
  id: 'weekly-employee-cadence',
  title: 'Weekly Employee Productivity & Engagement Matrix',
  subtitle: 'Aggregated daily active hours and task delivery throughput over the sprint week',
  xAxisLabel: 'DAY',
  yAxisLabel: 'EMPLOYEE',
  xLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Avg'],
  yLabels: DEFAULT_EMPLOYEES,
  data: [
    [94.2, 91.8, 96.5, 92.0, 88.7, 45.0, 15.0, 88.6],
    [92.0, 88.5, 82.3, 86.4, 95.0, 30.0, 10.0, 84.2],
    [95.0, 91.0, 89.4, 88.0, 94.2, 40.0, 12.0, 87.5],
    [62.4, 58.0, 54.2, 61.0, 68.5, 20.0,  5.0, 56.4],
    [99.0, 96.5, 95.2, 98.0, 98.5, 50.0, 20.0, 94.8],
    [88.4, 82.0, 79.5, 84.2, 86.0, 35.0, 10.0, 80.2],
    [96.2, 93.0, 91.8, 94.5, 95.0, 42.0, 18.0, 91.4],
    [74.0, 71.5, 68.2, 70.0, 76.0, 25.0,  8.0, 68.5],
  ],
  minValue: 0,
  maxValue: 100,
  unit: '%',
};

// Magma Colormap matching reference visual:
// Deep dark purple/black -> Wine Magenta -> Vivid Coral/Red -> Warm Orange -> Apricot Cream
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
}

export const MatrixHeatmap: React.FC<MatrixHeatmapProps> = ({
  initialPreset = 'hourly',
  selectedEmployeeName: _selectedEmployeeName,
}) => {
  const [activeMode, setActiveMode] = useState<'hourly' | 'weekly'>(initialPreset);
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
      if (emps && emps.length >= 8) {
        setEmployeesList(emps.slice(0, 8).map((e) => e.name));
      }
    });
  }, []);

  const baseDataset = activeMode === 'weekly' 
    ? WEEKLY_EMPLOYEE_CADENCE_PRESET 
    : HOURLY_EMPLOYEE_ACTIVITY_PRESET;

  const currentDataset: HeatmapMatrixDataset = {
    ...baseDataset,
    yLabels: employeesList,
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
                {currentDataset.xLabels.map((colLabel) => (
                  <div
                    key={colLabel}
                    style={{
                      width: 58,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      userSelect: 'none',
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

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-frosted-subdued)', borderRadius: 'var(--radius-card-sm)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Privacy Guarantee:</span>
                  <span style={{ color: 'var(--status-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Zero Keylogging &bull; Aggregate Telemetry Only
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
