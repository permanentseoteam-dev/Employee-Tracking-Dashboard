import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types/roles';
import {
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
  Shield,
  Briefcase,
  Users,
  Eye,
  EyeOff,
  Sun,
  Moon,
  LogIn,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, resendConfirmationEmail, isConfigured } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Sign In state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupRole, setSignupRole] = useState<UserRole>('employee');
  const [signupDept, setSignupDept] = useState('Engineering');

  const [error, setError] = useState<string | null>(null);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsEmailUnconfirmed(false);
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
        setIsEmailUnconfirmed(true);
        setError(
          'Email not confirmed yet. Supabase requires email verification before sign-in.'
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
    setIsEmailUnconfirmed(false);
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
      // Populate Sign In form with exact credentials used during registration
      setEmail(signupEmail.trim());
      setPassword(signupPassword);
      setMode('signin');
      setSuccess(
        `Account created for ${signupName}! You can now sign in with your credentials.`
      );
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Registration failed';
      setError(raw);
    } finally {
      setBusy(false);
    }
  };

  const roleDescriptions: Record<UserRole, { label: string; desc: string; icon: React.ReactNode }> = {
    employee: {
      label: 'Employee',
      desc: 'Workstation telemetry, time & activity tracking',
      icon: <User size={15} color="#06b6d4" />,
    },
    manager: {
      label: 'Manager',
      desc: 'Team overview, attendance & live monitoring',
      icon: <Users size={15} color="#10b981" />,
    },
    project_manager: {
      label: 'Project Manager',
      desc: 'Sprint milestones, workloads & task allocations',
      icon: <Briefcase size={15} color="#8b5cf6" />,
    },
    admin: {
      label: 'Admin',
      desc: 'Full organization control, security & settings',
      icon: <Shield size={15} color="#4c6bff" />,
    },
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.25rem',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Luminous Atmospheric Background Layer from Design System */}
      <div className="stitch-ambient-canvas" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Top Floating Controls Bar */}
      <header
        style={{
          position: 'fixed',
          top: 20,
          right: 24,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div className="live-telemetry-badge" title="Supabase Database Ready">
          <span className="pulse-beacon" />
          <span>Supabase Connected</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-frosted-elevated)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--surface-border)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-pill)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle visual theme"
        >
          {theme === 'dark' ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="var(--text-primary)" />}
        </button>
      </header>

      {/* Main Frosted Authentication Card */}
      <main
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface-frosted-elevated)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
          transition: 'all 0.3s ease',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '2.25rem 2.25rem 1.5rem',
            textAlign: 'center',
            borderBottom: '1px solid var(--surface-border-subtle)',
            background: 'linear-gradient(180deg, var(--surface-frosted), transparent)',
          }}
        >
          {/* Official Stitch Brand Layout */}
          <div
            className="stitch-brand"
            style={{
              justifyContent: 'center',
              cursor: 'default',
              marginBottom: '1rem',
            }}
          >
            <div
              className="stitch-brand-icon"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                boxShadow: 'var(--shadow-pill)',
              }}
            >
              <img src="/app-icon-192.png" alt="Employee Tracking App Logo" width={44} height={44} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span className="stitch-brand-title" style={{ fontSize: 15, letterSpacing: '0.04em' }}>
                Employee Tracking App
              </span>
              <span className="stitch-brand-sub" style={{ fontSize: 12 }}>
                Workforce Telemetry Desktop
              </span>
            </div>
          </div>

          <h1
            style={{
              margin: '0.5rem 0 0',
              fontSize: '1.45rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            {mode === 'signin' ? 'Sign In to Your Workspace' : 'Create Workforce Account'}
          </h1>
          <p
            style={{
              margin: '0.35rem 0 0',
              color: 'var(--text-secondary)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {mode === 'signin'
              ? 'Enter your credentials to access telemetry and tools'
              : 'Register an account connected directly to Supabase'}
          </p>

          {/* Segmented Mode Navigation Pills */}
          <div className="stitch-nav-pills" style={{ width: '100%', marginTop: '1.25rem' }}>
            <button
              type="button"
              className={`nav-pill-item ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccess(null);
              }}
              style={{ flex: 1, justifyContent: 'center', padding: '8px 16px', fontSize: 13 }}
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`nav-pill-item ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccess(null);
              }}
              style={{ flex: 1, justifyContent: 'center', padding: '8px 16px', fontSize: 13 }}
            >
              <UserPlus size={15} />
              <span>Register</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.75rem 2.25rem 2.25rem' }}>
          {/* Status Banners */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              style={{
                marginBottom: '1.25rem',
                padding: '0.95rem 1.1rem',
                borderRadius: 'var(--radius-card-sm)',
                background: 'var(--status-error-bg)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                color: 'var(--status-error)',
                fontSize: 13,
                lineHeight: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontWeight: 600 }}>{error}</div>
              </div>

              {isEmailUnconfirmed && (
                <div
                  style={{
                    paddingTop: 8,
                    borderTop: '1px solid rgba(220, 38, 38, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                  }}
                >
                  <p style={{ margin: 0 }}>
                    Supabase blocks sign in when <strong>&quot;Confirm email&quot;</strong> is enabled in your project settings.
                  </p>
                  <ul style={{ margin: '0 0 0 1.25rem', padding: 0, lineHeight: 1.6 }}>
                    <li>
                      <strong>Option 1 (Instant):</strong> Open{' '}
                      <a
                        href="https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/auth/providers"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Auth &rarr; Providers &rarr; Email
                      </a>{' '}
                      and toggle <strong>OFF &quot;Confirm email&quot;</strong>, then Save.
                    </li>
                    <li>
                      <strong>Option 2 (SQL):</strong> Open{' '}
                      <a
                        href="https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        SQL Editor
                      </a>{' '}
                      and run{' '}
                      <code style={{ background: 'var(--surface-frosted)', padding: '2px 4px', borderRadius: 4 }}>
                        015_auto_confirm_users.sql
                      </code>{' '}
                      to auto-confirm all users.
                    </li>
                  </ul>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const sqlCode = `UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;\nCREATE OR REPLACE FUNCTION public.auto_confirm_new_user() RETURNS trigger AS $$ BEGIN IF NEW.email_confirmed_at IS NULL THEN NEW.email_confirmed_at := now(); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;\nDROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;\nCREATE TRIGGER on_auth_user_created_auto_confirm BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();\nNOTIFY pgrst, 'reload schema';`;
                        navigator.clipboard?.writeText(sqlCode);
                        alert('SQL copied to clipboard! Paste and Run in Supabase SQL Editor.');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        border: '1px solid var(--surface-border)',
                        background: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-pill)',
                      }}
                    >
                      Copy Auto-Confirm SQL
                    </button>
                    <a
                      href="https://supabase.com/dashboard/project/isywkcymfzpgjerfuors/sql/new"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        border: '1px solid var(--surface-border-subtle)',
                        background: 'var(--surface-frosted-elevated)',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      Open SQL Editor &rarr;
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      disabled={resending || !email.trim()}
                      onClick={async () => {
                        if (!email.trim()) return;
                        setResending(true);
                        try {
                          await resendConfirmationEmail(email.trim());
                          setSuccess(`Confirmation email sent to ${email.trim()}! Check your inbox.`);
                          setError(null);
                          setIsEmailUnconfirmed(false);
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : 'Failed to resend confirmation email');
                        } finally {
                          setResending(false);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(220, 38, 38, 0.4)',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: 'var(--status-error)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: resending ? 'wait' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {resending ? 'Sending...' : 'Resend Confirmation Email'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {success && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginBottom: '1.25rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-card-sm)',
                background: 'var(--status-success-bg)',
                border: '1px solid rgba(22, 163, 74, 0.25)',
                color: 'var(--status-success)',
                fontSize: 13,
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{success}</div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'signin' ? (
              /* SIGN IN FORM */
              <motion.form
                key="signin-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                onSubmit={onSignIn}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}
              >
                <div>
                  <label htmlFor="signin-email" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Work Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="signin-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="username"
                      spellCheck={false}
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="stitch-input"
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signin-password"
                    className="form-label"
                    style={{ display: 'block', marginBottom: 6 }}
                  >
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="signin-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="stitch-input"
                      style={{ paddingLeft: 40, paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 4,
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.85rem 1.25rem',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busy ? 'wait' : 'pointer',
                    opacity: busy ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: 'var(--shadow-pill)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Authenticating…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              /* SIGN UP FORM */
              <motion.form
                key="signup-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                onSubmit={onSignUp}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}
              >
                <div>
                  <label htmlFor="signup-name" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="signup-name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Sarah Connor"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="stitch-input"
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-email" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Work Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="username"
                      spellCheck={false}
                      placeholder="sarah.connor@company.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="stitch-input"
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-role" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Organization Role
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      id="signup-role"
                      value={signupRole}
                      onChange={(e) => setSignupRole(e.target.value as UserRole)}
                      className="stitch-select"
                    >
                      <option value="employee">Employee — Workstation Tracking & Tasks</option>
                      <option value="manager">Manager — Team Telemetry & Oversight</option>
                      <option value="project_manager">Project Manager — Projects & Allocations</option>
                      <option value="admin">Admin — Full Organization Control</option>
                    </select>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {roleDescriptions[signupRole].icon}
                    <span>{roleDescriptions[signupRole].desc}</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-dept" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Department
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building2
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="signup-dept"
                      type="text"
                      required
                      autoComplete="organization-title"
                      placeholder="e.g. Engineering, Product, Design"
                      value={signupDept}
                      onChange={(e) => setSignupDept(e.target.value)}
                      className="stitch-input"
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-password"
                    className="form-label"
                    style={{ display: 'block', marginBottom: 6 }}
                  >
                    Password (min 6 characters)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="signup-password"
                      name="new-password"
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="stitch-input"
                      style={{ paddingLeft: 40, paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 4,
                      }}
                      title={showSignupPassword ? 'Hide password' : 'Show password'}
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.85rem 1.25rem',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: busy ? 'wait' : 'pointer',
                    opacity: busy ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: 'var(--shadow-pill)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Registering Account…</span>
                    </>
                  ) : (
                    <>
                      <span>Register Workspace Account</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer Metadata */}
          <div
            style={{
              marginTop: '1.75rem',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span>Supabase Cloud Sync</span>
            <span>•</span>
            <span style={{ fontFamily: 'monospace' }}>isywkcymfzpgjerfuors</span>
          </div>
        </div>
      </main>
    </div>
  );
};
