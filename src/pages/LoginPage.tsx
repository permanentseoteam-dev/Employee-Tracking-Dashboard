import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { signIn, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isConfigured) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Sign in failed';
      const lower = raw.toLowerCase();
      if (lower.includes('email not confirmed')) {
        setError(
          'Email not confirmed yet. In Supabase → Authentication → Users, open this account and confirm the email, then try again.'
        );
      } else if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
        setError('Wrong email or password. Use shahroz@company.com / the password you set.');
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background:
          'radial-gradient(ellipse at 20% 20%, var(--ambient-orb-1), transparent 50%), radial-gradient(ellipse at 80% 0%, var(--ambient-orb-2), transparent 45%), var(--bg-app)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: '100%',
          maxWidth: 400,
          padding: '2rem',
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface-frosted-elevated)',
          border: '1px solid var(--surface-border-subtle)',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            Employee Tracking
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Sign in with your work account to continue.
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '0.7rem 0.85rem',
              borderRadius: 12,
              border: '1px solid var(--surface-border-subtle)',
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: '0.7rem 0.85rem',
              borderRadius: 12,
              border: '1px solid var(--surface-border-subtle)',
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
        </label>

        {error && (
          <div
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              background: 'var(--status-error-bg)',
              color: 'var(--status-error)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: '0.25rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontWeight: 700,
            fontSize: 14,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};
