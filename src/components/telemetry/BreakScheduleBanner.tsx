import React from 'react';
import { Clock } from 'lucide-react';
import { useBreakSchedule } from '../../hooks/useBreakSchedule';
import { formatBreakChip } from '../../utils/breakSchedule';

interface BreakScheduleBannerProps {
  title?: string;
  footnote?: string;
}

export const BreakScheduleBanner: React.FC<BreakScheduleBannerProps> = ({
  title = 'OFFICIAL RECESS & BREAK WINDOWS:',
  footnote = 'Authorized recess • Zero penalty on activity scoring',
}) => {
  const { schedule } = useBreakSchedule();

  const chips: Array<{ key: string; text: string; bg: string; color: string; border: string; icon: string }> = [];
  if (schedule.coffee.enabled) {
    chips.push({
      key: 'coffee',
      text: formatBreakChip(schedule.coffee),
      bg: 'rgba(245, 158, 11, 0.14)',
      color: '#d97706',
      border: 'rgba(245, 158, 11, 0.28)',
      icon: '☕',
    });
  }
  if (schedule.zuhr.enabled) {
    chips.push({
      key: 'zuhr',
      text: formatBreakChip(schedule.zuhr),
      bg: 'rgba(16, 185, 129, 0.14)',
      color: '#059669',
      border: 'rgba(16, 185, 129, 0.28)',
      icon: '🕌',
    });
  }
  if (schedule.asr.enabled) {
    chips.push({
      key: 'asr',
      text: formatBreakChip(schedule.asr),
      bg: 'rgba(139, 92, 246, 0.14)',
      color: '#7c3aed',
      border: 'rgba(139, 92, 246, 0.28)',
      icon: '🕌',
    });
  }

  if (chips.length === 0) return null;

  return (
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
          <span>{title}</span>
        </div>
        {chips.map((c) => (
          <div
            key={c.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: c.bg,
              color: c.color,
              border: `1px solid ${c.border}`,
              padding: '3px 10px',
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            <span>{c.icon}</span>
            <span>{c.text}</span>
          </div>
        ))}
      </div>
      {footnote && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{footnote}</span>
      )}
    </div>
  );
};

export default BreakScheduleBanner;
