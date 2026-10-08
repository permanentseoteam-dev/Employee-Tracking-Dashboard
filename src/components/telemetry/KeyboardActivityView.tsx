import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Download,
  User,
  X,
  CheckCircle2,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { dataService } from '../../services/dataService';

interface KeyboardActivityViewProps {
  selectedEmployeeName?: string;
}

// 8 Default Employees
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

// Shift hours
const TIME_SLOTS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
];

// Base keypress matrix per employee per hour (derived from activity metrics * 34 keys/min)
const BASE_KEYPRESS_DATA: number[][] = [
  [2057, 2948, 3036, 3152, 2451, 2383, 3226, 2978], // Arsal (total 22,231)
  [394,  2230, 2781, 2536, 2125, 1951, 2815, 2390], // Alex Vance (total 17,222)
  [632,  2298, 2852, 2526, 2043, 1985, 2822, 2475], // Elena Vance (total 17,633)
  [629,  2223, 2675, 2407, 2060, 1791, 2784, 2189], // Marcus Bell (total 16,758)
  [1091, 2284, 2879, 2567, 2077, 1951, 3036, 2390], // Sarah Chen (total 18,275)
  [2567, 3138, 3192, 3308, 2556, 3148, 3325, 3162], // David Kim (total 24,396)
  [2305, 3087, 3138, 3243, 2526, 2998, 3287, 3134], // Jessica Lee (total 23,718)
  [2434, 3134, 3155, 3294, 2553, 3155, 3315, 3165], // Michael Torres (total 24,205)
];

// Color mapping for keystrokes intensity (from dark indigo to bright peach/cream)
function getKeypressCellColor(val: number, min = 300, max = 3400) {
  const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));

  let bg = '#1e1b4b';
  let textColor = '#ffffff';

  if (norm < 0.25) {
    // 300 - 1000 keys: deep slate / indigo
    bg = '#1e293b';
    textColor = '#94a3b8';
  } else if (norm < 0.45) {
    // 1000 - 1700 keys: violet
    bg = '#3b0764';
    textColor = '#e9d5ff';
  } else if (norm < 0.65) {
    // 1700 - 2400 keys: deep purple/fuchsia
    bg = '#701a75';
    textColor = '#fdf4ff';
  } else if (norm < 0.8) {
    // 2400 - 2900 keys: vibrant magenta/ruby
    bg = '#9f1239';
    textColor = '#ffffff';
  } else if (norm < 0.92) {
    // 2900 - 3250 keys: warm coral / orange
    bg = '#ea580c';
    textColor = '#ffffff';
  } else {
    // 3250+ keys: peak peach/gold
    bg = '#fed7aa';
    textColor = '#1e1b4b';
  }

  return { bg, textColor };
}

export const KeyboardActivityView: React.FC<KeyboardActivityViewProps> = ({
  selectedEmployeeName,
}) => {
  const [employeesList, setEmployeesList] = useState<string[]>(DEFAULT_EMPLOYEES);
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
    val: number;
    empName: string;
    timeSlot: string;
  } | null>(null);

  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
    val: number;
    empName: string;
    timeSlot: string;
  } | null>(null);

  useEffect(() => {
    dataService.getEmployees('admin').then((emps) => {
      if (emps && emps.length >= 8) {
        setEmployeesList(emps.slice(0, 8).map((e) => e.name));
      }
    });
  }, []);

  // Filter rows if an employee name is selected
  const activeEmployees = selectedEmployeeName && selectedEmployeeName !== 'all'
    ? employeesList.filter((e) => e.toLowerCase().includes(selectedEmployeeName.toLowerCase()))
    : employeesList;

  // Calculate totals
  const totalKeysOverall = BASE_KEYPRESS_DATA.flat().reduce((a, b) => a + b, 0);
  const avgKeysPerHour = Math.round(totalKeysOverall / (BASE_KEYPRESS_DATA.length * TIME_SLOTS.length));

  // Hourly sums across team
  const hourlyTotals = TIME_SLOTS.map((_, colIdx) =>
    BASE_KEYPRESS_DATA.reduce((sum, row) => sum + (row[colIdx] || 0), 0)
  );
  const peakHourIdx = hourlyTotals.indexOf(Math.max(...hourlyTotals));
  const peakHourName = TIME_SLOTS[peakHourIdx];

  const handleExportCSV = () => {
    let csv = `EMPLOYEE,` + TIME_SLOTS.join(',') + `,TOTAL_KEYS\n`;
    activeEmployees.forEach((emp) => {
      const origIdx = employeesList.indexOf(emp);
      const row = origIdx >= 0 ? BASE_KEYPRESS_DATA[origIdx] : BASE_KEYPRESS_DATA[0];
      const rowTotal = row.reduce((a, b) => a + b, 0);
      csv += `"${emp}",` + row.join(',') + `,${rowTotal}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keyboard-activity-telemetry.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 1. Keyboard Telemetry High-Level KPI Summary Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Total Keys Pressed</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-success)' }}>
              <Keyboard size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {totalKeysOverall.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>keys</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
            Today's aggregate typing volume across shift
          </span>
        </div>

        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Avg Keys / Hour</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Activity size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {avgKeysPerHour.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>keys/hr</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
            ~{Math.round(avgKeysPerHour / 60)} keystrokes per minute pace
          </span>
        </div>

        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Peak Typing Window</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <TrendingUp size={15} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {peakHourName}:00
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
            {hourlyTotals[peakHourIdx]?.toLocaleString()} keys logged across team
          </span>
        </div>

        <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Top Active Typist</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
              <User size={15} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            David Kim
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
            24,396 keys logged (Engineering Team)
          </span>
        </div>
      </div>

      {/* 2. Main Keystroke Counts Heatmap Card */}
      <div className="frosted-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {/* Card Header & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6366f1',
                }}
              >
                <Keyboard size={17} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Hourly Keystroke Counts
              </h3>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
              Exact number of keys pressed per employee per hour. Hover or click any cell to inspect details.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Privacy verification chip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--status-success)',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={13} />
              <span>Zero Keylogging Guarantee</span>
            </div>

            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              onClick={handleExportCSV}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              <Download size={13} />
              <span>Export Keys CSV</span>
            </button>
          </div>
        </div>

        {/* 2D Matrix Table */}
        <div style={{ width: '100%', overflowX: 'auto', paddingBottom: 6 }}>
          <div style={{ minWidth: 720 }}>
            {/* Column Headers (Time Slots) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `160px repeat(${TIME_SLOTS.length}, 1fr) 90px`,
                gap: 5,
                marginBottom: 6,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', paddingLeft: 6 }}>
                EMPLOYEE
              </div>
              {TIME_SLOTS.map((slot) => (
                <div
                  key={slot}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {slot}
                </div>
              ))}
              <div style={{ fontSize: 11, fontWeight: 800, textAlign: 'center', color: 'var(--text-muted)' }}>
                TOTAL
              </div>
            </div>

            {/* Matrix Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {activeEmployees.map((empName, rIdx) => {
                const origIdx = employeesList.indexOf(empName);
                const rowData = origIdx >= 0 ? BASE_KEYPRESS_DATA[origIdx] : BASE_KEYPRESS_DATA[0];
                const rowTotal = rowData.reduce((a, b) => a + b, 0);

                return (
                  <div
                    key={empName}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `160px repeat(${TIME_SLOTS.length}, 1fr) 90px`,
                      gap: 5,
                      alignItems: 'center',
                    }}
                  >
                    {/* Employee Row Label */}
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        paddingLeft: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      title={empName}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#6366f1',
                          fontSize: 9,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {empName[0]}
                      </div>
                      <span>{empName}</span>
                    </div>

                    {/* Hourly Keypress Value Cells */}
                    {rowData.map((val, cIdx) => {
                      const timeSlot = TIME_SLOTS[cIdx];
                      const { bg, textColor } = getKeypressCellColor(val);
                      const isHovered = hoveredCell?.row === rIdx && hoveredCell?.col === cIdx;

                      return (
                        <div
                          key={cIdx}
                          onMouseEnter={() =>
                            setHoveredCell({ row: rIdx, col: cIdx, val, empName, timeSlot })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() =>
                            setSelectedCell({ row: rIdx, col: cIdx, val, empName, timeSlot })
                          }
                          style={{
                            background: bg,
                            color: textColor,
                            borderRadius: 6,
                            padding: '10px 4px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                            boxShadow: isHovered
                              ? '0 6px 18px rgba(0, 0, 0, 0.35)'
                              : '0 1px 3px rgba(0, 0, 0, 0.08)',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            zIndex: isHovered ? 10 : 1,
                            position: 'relative',
                            userSelect: 'none',
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                            {val.toLocaleString()}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              opacity: 0.8,
                              marginTop: 2,
                            }}
                          >
                            keys
                          </span>
                        </div>
                      );
                    })}

                    {/* Total Keys for this Employee */}
                    <div
                      style={{
                        padding: '8px 4px',
                        borderRadius: 6,
                        background: 'var(--surface-frosted-subdued, rgba(0, 0, 0, 0.04))',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {rowTotal.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>
                        keys
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--surface-border-subtle, rgba(0, 0, 0, 0.06))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 700 }}>Intensity Scale:</span>
            <span>&lt; 1,000 keys (Light)</span>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#1e293b' }} />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#3b0764' }} />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#701a75' }} />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#9f1239' }} />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#ea580c' }} />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#fed7aa' }} />
            <span>&gt; 3,200 keys (Intensive)</span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Showing telemetry for {activeEmployees.length} of {employeesList.length} employees
          </div>
        </div>
      </div>

      {/* 3. Detail Inspector Modal when a cell is clicked */}
      <AnimatePresence>
        {selectedCell && (
          <div
            className="stitch-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
            onClick={() => setSelectedCell(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="frosted-card"
              style={{
                width: 440,
                maxWidth: '92vw',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                background: 'var(--surface-card, #ffffff)',
                borderRadius: 16,
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    {selectedCell.empName[0]}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {selectedCell.empName}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Shift Interval: {selectedCell.timeSlot} - {parseInt(selectedCell.timeSlot) + 1}:00
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  background: 'var(--surface-frosted-subdued, rgba(0, 0, 0, 0.03))',
                  borderRadius: 12,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Total Keypress Count
                </span>
                <span style={{ fontSize: 38, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {selectedCell.val.toLocaleString()}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  ~{Math.round(selectedCell.val / 60)} keys / minute sustained typing
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface-frosted-subdued, rgba(0,0,0,0.03))' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Activity Level
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: selectedCell.val > 2500 ? 'var(--status-success)' : 'var(--text-primary)', marginTop: 2 }}>
                    {selectedCell.val > 2800 ? 'Peak Typing' : selectedCell.val > 1800 ? 'Active Workflow' : 'Light / Review'}
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface-frosted-subdued, rgba(0,0,0,0.03))' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Est. Word Count
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                    ~{Math.round(selectedCell.val / 5)} words
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--status-success)',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={14} />
                <span>Zero Keylogging Guarantee: Keystroke characters are never logged.</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KeyboardActivityView;
