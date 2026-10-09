/** Parse DB timestamps (UTC ISO or postgres) into a valid Date. */
export function parseCaptureDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Prefer ISO; if space-separated UTC-ish stamp, treat as UTC.
  let normalized = raw;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    normalized = raw.replace(' ', 'T') + 'Z';
  }

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return d;
}

/** Local wall-clock time for screenshot cards. */
export function formatCaptureTime(value?: string | null): string {
  const d = parseCaptureDate(value);
  if (!d) return 'Unknown';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Local date + time for detail panels. */
export function formatCaptureDateTime(value?: string | null): string {
  const d = parseCaptureDate(value);
  if (!d) return 'Unknown';
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function isDummyMediaUrl(url?: string | null): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.includes('gtv-videos-bucket') ||
    u.includes('forbiggerblazes') ||
    u.includes('unsplash.com') ||
    u.includes('sample/') ||
    u.includes('placeholder')
  );
}
