/** How to show a person's name in the UI. */
export type DisplayNamePref = 'first' | 'last' | 'full';

export function parseNameParts(fullName?: string | null): { first: string; last: string; full: string } {
  const full = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!full) return { first: '', last: '', full: '' };
  const parts = full.split(' ');
  if (parts.length === 1) return { first: parts[0], last: '', full };
  return {
    first: parts[0],
    last: parts[parts.length - 1],
    full,
  };
}

/** Default: first name. Falls back sensibly when only one token exists. */
export function formatDisplayName(
  fullName?: string | null,
  pref: DisplayNamePref | string | null | undefined = 'first',
  fallback = 'Employee'
): string {
  const { first, last, full } = parseNameParts(fullName);
  if (!full) return fallback;
  const mode = (pref === 'last' || pref === 'full' ? pref : 'first') as DisplayNamePref;
  if (mode === 'full') return full;
  if (mode === 'last') return last || first || full;
  return first || full;
}

export function normalizeDisplayNamePref(raw?: string | null): DisplayNamePref {
  if (raw === 'last' || raw === 'full') return raw;
  return 'first';
}
