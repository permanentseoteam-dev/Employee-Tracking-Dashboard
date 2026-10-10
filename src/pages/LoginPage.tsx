import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/roles';
import {
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, isConfigured } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Sign In state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign Up state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('employee');
  const [signupDept, setSignupDept] = useState('Engineering');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isConfigured) {
      setError('Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
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
          'Email not confirmed yet. If confirmation is required on your Supabase project, please confirm your email in Supabase Authentication -> Users before logging in.'
        );
      } else if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
        setError('Invalid email or password. Please verify your credentials.');
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isConfigured) {
      setError('Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
      return;
    }

    if (!signupName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setError('A valid email address is required.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      await signUp(signupEmail.trim(), signupPassword, signupName.trim(), signupRole, signupDept.trim());
      setSuccess(
        `Account successfully created for ${signupName}! If your session did not automatically start, check your email or Supabase project to confirm, then sign in.`
      );
      setEmail(signupEmail.trim());
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Registration failed';
      setError(raw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem 1rem',
        background:
          'radial-gradient(circle at 15% 20%, rgba(76, 107, 255, 0.15), transparent 45%), radial-gradient(circle at 85% 15%, rgba(16, 185, 129, 0.12), transparent 45%), radial-gradient(circle at 50% 85%, rgba(139, 92, 246, 0.1), transparent 50%), var(--bg-app)',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 24,
          background: 'var(--surface-frosted-elevated)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--surface-border-subtle)',
          boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '2rem 2rem 1.25rem',
            textAlign: 'center',
            borderBottom: '1px solid var(--surface-border-subtle)',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #4c6bff, #7c3aed)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 10px 24px -6px rgba(76, 107, 255, 0.45)',
              marginBottom: '1rem',
            }}
          >
            <Sparkles size={26} />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.65rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            Employee Tracking
          </h1>
          <p
            style={{
              margin: '0.4rem 0 0',
              color: 'var(--text-secondary)',
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            Unified Telemetry, Presence & Workstation Management
          </p>

          {/* Mode Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-card)',
              borderRadius: 14,
              padding: 4,
              marginTop: '1.25rem',
              border: '1px solid var(--surface-border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccess(null);
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: mode === 'signin' ? 'var(--color-primary)' : 'transparent',
                color: mode === 'signin' ? 'var(--color-on-primary)' : 'var(--text-secondary)',
                boxShadow: mode === 'signin' ? '0 2px 8px rgba(76, 107, 255, 0.35)' : 'none',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccess(null);
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: mode === 'signup' ? 'var(--color-primary)' : 'transparent',
                color: mode === 'signup' ? 'var(--color-on-primary)' : 'var(--text-secondary)',
                boxShadow: mode === 'signup' ? '0 2px 8px rgba(76, 107, 255, 0.35)' : 'none',
              }}
            >
              Register Account
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.75rem 2rem 2rem' }}>
          {/* Status Banners */}
          {error && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.8rem 1rem',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                fontSize: 13,
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.8rem 1rem',
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                fontSize: 13,
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{success}</div>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'signin' ? (
            <form onSubmit={onSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                      borderRadius: 12,
                      border: '1px solid var(--surface-border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                      borderRadius: 12,
                      border: '1px solid var(--surface-border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-pill)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{busy ? 'Authenticating…' : 'Sign In to Dashboard'}</span>
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>
          ) : (
            /* SIGN UP FORM */
            <form onSubmit={onSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                      borderRadius: 12,
                      border: '1px solid var(--surface-border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Work Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="email"
                    required
                    placeholder="john.doe@company.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                      borderRadius: 12,
                      border: '1px solid var(--surface-border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Account Role
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as UserRole)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem',
                      borderRadius: 12,
                      border: '1px solid var(--surface-border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="employee">Employee — Track Workstation & Tasks</option>
                    <option value="manager">Manager — Team Telemetry & Oversight</option>
                    <option value="project_manager">Project Manager — Projects & Allocations</option>
                    <option value="admin">Admin — Full Organization Control</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Department
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engineering, Delivery, Management"
                    value={signupDept}
                    onChange={(e) => setSignupDept(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                      borderRadius: 12,
                      border: '1px solid var(--surface-border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Password (min 6 characters)
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                      borderRadius: 12,
                      border: '1px solid var(--surface-border-subtle)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-pill)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{busy ? 'Registering Account…' : 'Register Account in Supabase'}</span>
                {!busy && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          <div
            style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            Connected to Supabase Project:{' '}
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              isywkcymfzpgjerfuors
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
