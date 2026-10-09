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
  Clock,
  Database,
  Coffee,
  Moon,
  Play,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { BreakTelemetrySnapshot, BreakType } from '../../types/roles';

interface KeyboardActivityViewProps {
  selectedEmployeeName?: string;
  showBreakSchedule?: boolean;
  role?: 'admin' | 'manager' | 'employee';
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
  showBreakSchedule,
  role = 'admin',
}) => {
  const showBreaks = showBreakSchedule !== undefined ? showBreakSchedule : role !== 'admin';
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

  const [breakSnapshot, setBreakSnapshot] = useState<BreakTelemetrySnapshot | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    dataService.getEmployees('admin').then((emps) => {
      if (emps && emps.length >= 8) {
        setEmployeesList(emps.slice(0, 8).map((e) => e.name));
      }
    });

    dataService.getLatestBreakTelemetry().then((snap) => {
      if (snap) setBreakSnapshot(snap);
    });

    const unsubscribe = dataService.subscribeToBreakTelemetry((snap, action) => {
      setBreakSnapshot(snap);
      if (action === 'saved') {
        setSyncFeedback(
          `💾 Keystroke state saved to Supabase (Bucket: screenshots, Table: activity_events). Preserved at ${snap?.current_time_slot}.`
        );
        setTimeout(() => setSyncFeedback(null), 6000);
      } else if (action === 'resumed') {
        setSyncFeedback(
          `⚡ Resumed work! Keystrokes continuing at ${snap?.current_time_slot} on top of preserved state.`
        );
        setTimeout(() => setSyncFeedback(null), 6000);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleTriggerBreak = async (type: BreakType) => {
    try {
      const snap = await dataService.saveBreakTelemetrySnapshot({
        breakType: type,
        employeeName: selectedEmployeeName || 'Arsal',
        timeSlot: type === 'coffee' ? '11:00' : '13:00',
      });
      setBreakSnapshot(snap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeBreak = async () => {
    try {
      const resumed = await dataService.resumeBreakTelemetry({
        employeeName: selectedEmployeeName || 'Arsal',
        breakSeconds: 1800,
      });
      setBreakSnapshot(resumed);
    } catch (e) {
      console.error(e);
    }
  };

  // Filter rows if an employee name is selected
  const activeEmployees = selectedEmployeeName && selectedEmployeeName !== 'all'
    ? employeesList.filter((e) => e.toLowerCase().includes(selectedEmployeeName.toLowerCase()))
    : employeesList;

  // Keystrokes matrix adjusted for break continuation
  const activeMatrixData = activeEmployees.map((emp) => {
    const origIdx = employeesList.indexOf(emp);
    const row = origIdx >= 0 && BASE_KEYPRESS_DATA[origIdx] ? [...BASE_KEYPRESS_DATA[origIdx]] : [...BASE_KEYPRESS_DATA[0]];

    if (
      showBreaks &&
      breakSnapshot &&
      (emp.toLowerCase().includes('arsal') ||
        (selectedEmployeeName && emp.toLowerCase().includes(selectedEmployeeName.toLowerCase())))
    ) {
      const sIdx = breakSnapshot.time_slot_index;
      if (sIdx >= 0 && sIdx < row.length) {
        if (breakSnapshot.status === 'active_break') {
          row[sIdx] = breakSnapshot.hourly_state.pre_break_keys;
        } else if (breakSnapshot.status === 'resumed') {
          row[sIdx] = breakSnapshot.hourly_state.adjusted_total_keys || row[sIdx];
        }
      }
    }
    return row;
  });

  // Calculate totals
  const totalKeysOverall = activeMatrixData.flat().reduce((a, b) => a + b, 0);
  const avgKeysPerHour = Math.round(totalKeysOverall / (activeMatrixData.length * TIME_SLOTS.length));

  // Hourly sums across team
  const hourlyTotals = TIME_SLOTS.map((_, colIdx) =>
    activeMatrixData.reduce((sum, row) => sum + (row[colIdx] || 0), 0)
  );
  const peakHourIdx = hourlyTotals.indexOf(Math.max(...hourlyTotals));
  const peakHourName = TIME_SLOTS[peakHourIdx];

  const handleExportCSV = () => {
    let csv = `EMPLOYEE,` + TIME_SLOTS.join(',') + `,TOTAL_KEYS\n`;
    activeEmployees.forEach((emp, rIdx) => {
      const row = activeMatrixData[rIdx] || activeMatrixData[0];
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

        {/* Authorized Breaks Card (Manager & Employee Only) */}
        {showBreaks && (
          <div className="frosted-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Authorized Breaks</span>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                <Clock size={15} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              1h 30m <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>total</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
              ☕ 11:00 AM (30m) &bull; 🕌 01:00 PM (60m)
            </span>
          </div>
        )}
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

        {/* Coffee & Namaz Break Schedule Banner (Manager & Employee Only) */}
        {showBreaks && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 'var(--radius-card-sm)',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.22)',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: 'var(--color-primary)' }}>
                <Clock size={14} />
                <span>OFFICIAL RECESS & BREAK WINDOWS:</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(245, 158, 11, 0.14)',
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <span>☕</span>
                <span>Coffee Break: 11:00 AM – 11:30 AM</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <span>🕌</span>
                <span>Zuhr Namaz & Lunch: 01:00 PM – 02:00 PM</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(139, 92, 246, 0.14)',
                  color: '#7c3aed',
                  border: '1px solid rgba(139, 92, 246, 0.28)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <span>🕌</span>
                <span>Asr Prayer: 04:30 PM – 04:45 PM</span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Excused from typing minimums
            </span>
          </div>
        )}

        {/* Break State & Supabase Continuation Controls (Employee & Manager Roles Only) */}
        {showBreaks && (
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
                    {breakSnapshot.break_title} Active — Keystrokes Locked in Bucket &bull; Resumes from {breakSnapshot.current_time_slot} ({breakSnapshot.hourly_state.pre_break_keys.toLocaleString()} keys)
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} color="#10b981" />
                  <span style={{ fontWeight: 700, color: '#059669', fontSize: 12 }}>
                    {breakSnapshot?.status === 'resumed'
                      ? `Keystrokes Continuing from Last State (${breakSnapshot.current_time_slot}: Pre-break ${breakSnapshot.hourly_state.pre_break_keys} + Resumed ${breakSnapshot.hourly_state.post_break_keys} = ${breakSnapshot.hourly_state.adjusted_total_keys?.toLocaleString()} keys total)`
                      : 'Cloud Snapshot Ready &bull; Preserves keystrokes in Supabase bucket & table across Namaz and Coffee breaks'}
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
                  title="End break and resume typing tracking from last state"
                >
                  <Play size={13} />
                  <span>Resume Work & Continue Keystrokes</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    style={{ padding: '5px 12px', fontSize: 11 }}
                    onClick={() => handleTriggerBreak('coffee')}
                    title="Save keyboard state to Supabase for 11:00 AM Coffee Break"
                  >
                    <Coffee size={13} />
                    <span>Coffee Break (11:00 AM)</span>
                  </button>
                  <button
                    type="button"
                    className="btn-pill btn-pill-secondary"
                    style={{ padding: '5px 12px', fontSize: 11 }}
                    onClick={() => handleTriggerBreak('namaz')}
                    title="Save keyboard state to Supabase for 01:00 PM Zuhr Namaz"
                  >
                    <Moon size={13} />
                    <span>Namaz Break (01:00 PM)</span>
                  </button>
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
              {TIME_SLOTS.map((slot) => {
                const isCoffeeSlot = showBreaks && slot === '11:00';
                const isNamazSlot = showBreaks && slot === '13:00';

                return (
                  <div
                    key={slot}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: isCoffeeSlot ? '#d97706' : isNamazSlot ? '#059669' : 'var(--text-secondary)',
                      letterSpacing: '-0.01em',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                    title={
                      isCoffeeSlot
                        ? '11:00 AM – 11:30 AM: Official Coffee Break'
                        : isNamazSlot
                        ? '01:00 PM – 02:00 PM: Official Zuhr Namaz & Lunch Break'
                        : slot
                    }
                  >
                    <span>{slot}</span>
                    {isCoffeeSlot && (
                      <span
                        style={{
                          fontSize: 8.5,
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
                          fontSize: 8.5,
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

              {showBreaks && selectedCell.timeSlot === '11:00' && (
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
                    <span>Official Coffee Break (11:00 AM – 11:30 AM) &bull; Supabase Keystrokes Sync</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Keystroke volume during this recess is excused from minimum activity expectations. Snapshot preserves typing count in Supabase and resumes without reset.
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
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pre-Break Keys:</span>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                        {(breakSnapshot?.hourly_state?.pre_break_keys || 1520).toLocaleString()} keys (Preserved)
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resumed Keys:</span>
                      <div style={{ fontWeight: 800, color: '#10b981' }}>
                        +{(breakSnapshot?.hourly_state?.post_break_keys || 1516).toLocaleString()} keys Added
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adjusted Hourly Total:</span>
                      <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                        {selectedCell.val.toLocaleString()} Combined Total
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cloud Storage:</span>
                      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 10 }}>
                        Bucket: screenshots &bull; activity_events
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showBreaks && selectedCell.timeSlot === '13:00' && (
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
                    <span>Official Zuhr Namaz & Lunch Break (01:00 PM – 02:00 PM)</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Designated prayer and meal recess. Keystroke pause is fully authorized with state persisted in Supabase bucket & table.
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
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pre-Break Baseline:</span>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                        2,451 keys Preserved
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
                        {selectedCell.val.toLocaleString()} Active Keys
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
