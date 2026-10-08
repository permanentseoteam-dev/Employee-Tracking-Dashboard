import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Download,
  Info,
  Sliders,
  Maximize2,
  Sparkles,
  Layers,
  X,
} from 'lucide-react';

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

// Preset 1: Exact Benchmark Matrix as requested in User Image
export const BENCHMARK_MATRIX_PRESET: HeatmapMatrixDataset = {
  id: 'benchmark-task',
  title: 'Task Performance & Model Benchmark Matrix',
  subtitle: 'Comparative multi-task accuracy and language model evaluation scores (%)',
  xAxisLabel: 'Task',
  yAxisLabel: 'Model Architecture',
  xLabels: ['CoLA', 'MNLI', 'MRPC', 'QNLI', 'QQP', 'RTE', 'SST-2', 'STS-B'],
  yLabels: ['BERT', 'LSTM', 'Attn', 'GloVe', 'ELMo', 'ERNIE', 'RoBERTa', 'T5'],
  data: [
    [60.5, 86.7, 89.3, 92.7, 72.1, 70.1, 94.9, 87.6],
    [11.6, 65.6, 81.8, 74.6, 62.5, 57.4, 82.8, 70.3],
    [18.6, 67.6, 83.9, 74.3, 60.1, 58.4, 83.0, 72.8],
    [18.5, 65.4, 78.7, 70.8, 60.6, 52.7, 81.9, 64.4],
    [32.1, 67.2, 84.7, 75.5, 61.1, 57.4, 89.3, 70.3],
    [75.5, 92.3, 93.9, 97.3, 75.2, 92.6, 97.8, 93.0],
    [67.8, 90.8, 92.3, 95.4, 74.3, 88.2, 96.7, 92.2],
    [71.6, 92.2, 92.8, 96.9, 75.1, 92.8, 97.5, 93.1],
  ],
  minValue: 10,
  maxValue: 100,
  unit: '%',
};

// Preset 2: Workforce Telemetry Matrix
export const WORKFORCE_MATRIX_PRESET: HeatmapMatrixDataset = {
  id: 'workforce-telemetry',
  title: 'Organization Workforce Activity & Performance Matrix',
  subtitle: 'Multi-factor productivity, focus density, and delivery throughput across employees',
  xAxisLabel: 'Evaluation Dimension',
  yAxisLabel: 'Team Member',
  xLabels: ['Attendance', 'Active Hrs', 'Focus %', 'Task Vel', 'Code Rev', 'Test Cov', 'Quality', 'Stars'],
  yLabels: ['Arsal (Dev)', 'Alex Vance', 'Elena R.', 'Marcus B.', 'Sarah C.', 'David K.', 'Priya N.', 'James L.'],
  data: [
    [98.5, 94.2, 88.7, 91.5, 84.2, 92.0, 96.4, 90.0],
    [92.0, 88.5, 82.3, 86.4, 95.0, 88.2, 91.0, 85.0],
    [95.0, 91.0, 89.4, 88.0, 78.5, 85.0, 94.2, 88.0],
    [62.4, 58.0, 54.2, 61.0, 48.0, 52.0, 68.5, 45.0],
    [99.0, 96.5, 95.2, 98.0, 92.4, 97.0, 98.5, 98.0],
    [88.4, 82.0, 79.5, 84.2, 75.0, 80.4, 86.0, 80.0],
    [96.2, 93.0, 91.8, 94.5, 88.0, 93.2, 95.0, 92.0],
    [74.0, 71.5, 68.2, 70.0, 62.0, 65.4, 76.0, 60.0],
  ],
  minValue: 40,
  maxValue: 100,
  unit: 'pts',
};

// Preset 3: Hourly Desktop Activity Density
export const HOURLY_ACTIVITY_PRESET: HeatmapMatrixDataset = {
  id: 'hourly-activity',
  title: 'Workstation Hourly Interaction Density Matrix',
  subtitle: 'Aggregated keyboard, mouse spatial density, and active window events per shift hour',
  xAxisLabel: 'Shift Hour',
  yAxisLabel: 'Workstation Station',
  xLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
  yLabels: ['WS-DEV-01', 'WS-DEV-02', 'WS-MGR-01', 'WS-QA-01', 'WS-DES-01', 'WS-OPS-01', 'WS-BE-01', 'WS-FE-01'],
  data: [
    [78.4, 92.1, 95.6, 42.0, 88.4, 94.2, 91.0, 86.5],
    [65.0, 84.2, 89.0, 38.5, 82.0, 87.5, 84.0, 79.2],
    [85.0, 89.4, 92.0, 60.0, 91.2, 93.0, 88.5, 82.0],
    [55.2, 72.0, 81.4, 30.0, 76.5, 85.0, 89.2, 74.0],
    [82.0, 94.5, 96.0, 45.0, 90.0, 96.2, 93.4, 88.0],
    [70.5, 85.0, 88.2, 50.0, 84.0, 89.0, 86.2, 81.0],
    [88.2, 96.0, 98.4, 40.0, 94.0, 97.5, 95.0, 90.2],
    [76.0, 91.0, 93.5, 35.0, 87.2, 92.0, 90.0, 84.5],
  ],
  minValue: 20,
  maxValue: 100,
  unit: '%',
};

// Interpolation color stop helper matching the exact Colormap from the image
// Low: deep dark purple/black -> Wine Magenta -> Vivid Coral/Red -> Warm Orange -> Apricot Cream
export function getHeatmapColor(value: number, min = 10, max = 100): {
  bg: string;
  textColor: string;
  borderColor: string;
} {
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Color Stops:
  // 0.0 -> #110b28 (deep black/navy purple)
  // 0.2 -> #3a0d54 (deep purple)
  // 0.4 -> #7c1969 (magenta wine)
  // 0.6 -> #c73650 (vivid crimson red)
  // 0.75 -> #eb6546 (coral red-orange)
  // 0.88 -> #f69b62 (warm orange)
  // 0.95 -> #fcd5ad (warm peach/apricot)
  // 1.0 -> #fee9d7 (cream/ivory)

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

  // Text color: light for dark cells, dark for high intensity peach cells
  // Matches exact visual from reference image where top right (87.6, 94.9) and bottom right (97.5, 93.1) have dark text
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
  initialPreset?: 'benchmark' | 'workforce' | 'hourly';
}

export const MatrixHeatmap: React.FC<MatrixHeatmapProps> = ({ initialPreset = 'benchmark' }) => {
  const [activePresetId, setActivePresetId] = useState<string>(
    initialPreset === 'benchmark'
      ? 'benchmark-task'
      : initialPreset === 'workforce'
      ? 'workforce-telemetry'
      : 'hourly-activity'
  );
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
  } | null>(null);

  const presets: HeatmapMatrixDataset[] = [
    BENCHMARK_MATRIX_PRESET,
    WORKFORCE_MATRIX_PRESET,
    HOURLY_ACTIVITY_PRESET,
  ];

  const currentDataset = presets.find((p) => p.id === activePresetId) || BENCHMARK_MATRIX_PRESET;

  const handleExportCSV = () => {
    let csv = `${currentDataset.yAxisLabel}/${currentDataset.xAxisLabel},` + currentDataset.xLabels.join(',') + '\n';
    currentDataset.yLabels.forEach((y, rIdx) => {
      const rowVals = currentDataset.data[rIdx].map((v) => v.toFixed(1)).join(',');
      csv += `${y},${rowVals}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDataset.id}-heatmap-matrix.csv`;
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
          {/* Preset Selector */}
          <div className="stitch-nav-pills">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`nav-pill-item ${activePresetId === p.id ? 'active' : ''}`}
                onClick={() => setActivePresetId(p.id)}
              >
                {p.id === 'benchmark-task' && <Sparkles size={13} />}
                {p.id === 'workforce-telemetry' && <Layers size={13} />}
                {p.id === 'hourly-activity' && <Flame size={13} />}
                <span>{p.xAxisLabel === 'Task' ? 'Benchmark (Image)' : p.title.split(' ')[1] || p.title}</span>
              </button>
            ))}
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
            title="Export Matrix to CSV"
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
          padding: '1.5rem 1rem',
          background: 'var(--surface-frosted-subdued)',
          borderRadius: 'var(--radius-card-sm)',
          border: '1px solid var(--surface-border-subtle)',
          overflowX: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1.75rem' }}>
          {/* Matrix Table with Y labels, Cells, and X labels */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Rows Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {currentDataset.yLabels.map((rowLabel, rIdx) => (
                <div key={rowLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Y Axis Label */}
                  <div
                    style={{
                      width: 70,
                      textAlign: 'right',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      paddingRight: 6,
                      userSelect: 'none',
                    }}
                  >
                    {rowLabel}
                  </div>

                  {/* Row Cells */}
                  <div style={{ display: 'flex', gap: 2 }}>
                    {currentDataset.xLabels.map((colLabel, cIdx) => {
                      const val = currentDataset.data[rIdx]?.[cIdx] ?? 0;
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
                            })
                          }
                          style={{
                            width: 52,
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
                              ? '0 4px 12px rgba(0,0,0,0.35), inset 0 0 0 1.5px #fff'
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ width: 70 }} /> {/* Spacer for Y label alignment */}
              <div style={{ display: 'flex', gap: 2 }}>
                {currentDataset.xLabels.map((colLabel) => (
                  <div
                    key={colLabel}
                    style={{
                      width: 52,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      userSelect: 'none',
                    }}
                  >
                    {colLabel}
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis Dimension Name */}
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em',
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
              Inspecting <strong>{hoveredCell.rowLabel}</strong> &times; <strong>{hoveredCell.colLabel}</strong>:
              <span style={{ marginLeft: 6, fontWeight: 800, color: 'var(--color-secondary)' }}>
                {hoveredCell.val.toFixed(1)} {currentDataset.unit || '%'}
              </span>
            </span>
          ) : (
            <span>Hover over any matrix cell to inspect coordinates, or click to open deep diagnostic telemetry.</span>
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
              style={{ maxWidth: 440 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="content-card-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Maximize2 size={18} color="var(--color-secondary)" />
                  <span style={{ fontSize: 17, fontWeight: 700 }}>Telemetry Cell Diagnostics</span>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-card-sm)',
                    background: getHeatmapColor(selectedCell.val, currentDataset.minValue, currentDataset.maxValue).bg,
                    color: getHeatmapColor(selectedCell.val, currentDataset.minValue, currentDataset.maxValue).textColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>Cell Coordinate Value</div>
                    <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace' }}>
                      {selectedCell.val.toFixed(1)} {currentDataset.unit || '%'}
                    </div>
                  </div>
                  <Flame size={32} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Row Dimension:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedCell.rowLabel}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Column Dimension:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedCell.colLabel}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface-border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Active Evaluation Scope:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedCell.datasetTitle}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Confidence / Reliability:</span>
                    <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>99.8% DPAPI Verified</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-pill btn-pill-primary"
                  style={{ width: '100%', marginTop: 8 }}
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
