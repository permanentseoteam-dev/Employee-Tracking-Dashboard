import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Mail,
  Building2,
  UsersRound,
  KeyRound,
  Camera,
  Save,
  Check,
  AlertCircle,
  Phone,
  Shield,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/roles';

function isAvatarUrl(avatarStr?: string) {
  if (!avatarStr) return false;
  return (
    avatarStr.startsWith('http://') ||
    avatarStr.startsWith('https://') ||
    avatarStr.startsWith('/') ||
    avatarStr.startsWith('data:')
  );
}

function roleLabel(role: UserRole) {
  if (role === 'project_manager') return 'Project Manager';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ open, onClose }) => {
  const { user, role, isAuthenticated, isConfigured, updateProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [team, setTeam] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setDepartment(user.department || '');
    setTeam(user.team_name || '');
    setPhone(user.phone || '');
    setAvatar(user.avatar || '');
    setAvatarFile(null);
    setPassword('');
    setPassword2('');
    setMessage(null);
  }, [open, user]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'err', text: 'Please choose an image file (JPG, PNG, WebP)' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'err', text: 'Image must be under 5 MB' });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result || ''));
    reader.readAsDataURL(file);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password || password2) {
      if (!isAuthenticated) {
        setMessage({ type: 'err', text: 'Sign in to change your password' });
        return;
      }
      if (password.length < 6) {
        setMessage({ type: 'err', text: 'Password must be at least 6 characters' });
        return;
      }
      if (password !== password2) {
        setMessage({ type: 'err', text: 'Passwords do not match' });
        return;
      }
    }
    setBusy(true);
    try {
      await updateProfile({
        name,
        email,
        department,
        team_name: team,
        phone,
        avatar,
        avatarFile,
        newPassword: password || undefined,
      });
      setMessage({
        type: 'ok',
        text: isConfigured
          ? 'Profile saved to database (and photo to avatars bucket when uploaded).'
          : 'Profile saved locally. Connect Supabase to sync to the database.',
      });
      setPassword('');
      setPassword2('');
      setAvatarFile(null);
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.message || 'Failed to save profile' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="Edit Profile"
      subtitle={`${roleLabel(role)} account`}
      maxWidth={520}
      footer={
        <>
          <button type="button" className="btn-pill btn-pill-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-profile-form" className="btn-pill btn-pill-primary" disabled={busy}>
            <Save size={14} />
            <span>{busy ? 'Saving…' : 'Save changes'}</span>
          </button>
        </>
      }
    >
      <form id="edit-profile-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            className="avatar-chip"
            style={{
              width: 72,
              height: 72,
              fontSize: 20,
              fontWeight: 800,
              overflow: 'hidden',
              flexShrink: 0,
              background: 'linear-gradient(135deg, #4c6bff, #1e293b)',
              color: '#fff',
            }}
          >
            {isAvatarUrl(avatar) ? (
              <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (name || 'U').substring(0, 2).toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              className="btn-pill btn-pill-secondary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={14} />
              <span>Upload photo</span>
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={onPickFile} />
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Photos upload to the <strong>avatars</strong> storage bucket. Profile fields save to{' '}
              <strong>profiles</strong> (and users/employees mirrors) for your role.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--surface-frosted-subdued)',
            border: '1px solid var(--surface-border-subtle)',
            fontSize: 12,
          }}
        >
          <Shield size={14} color="var(--color-secondary)" />
          <span>
            Role locked:{' '}
            <strong style={{ textTransform: 'capitalize' }}>{roleLabel(role)}</strong>
            {isAuthenticated ? ' · signed in' : ' · demo session'}
          </span>
        </div>

        <div className="stitch-form-group">
          <label className="stitch-label" htmlFor="ep-name">
            Full name
          </label>
          <div style={{ position: 'relative' }}>
            <User size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input
              id="ep-name"
              className="stitch-input"
              style={{ paddingLeft: 34 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="stitch-form-group">
          <label className="stitch-label" htmlFor="ep-email">
            Email
          </label>
          <div style={{ position: 'relative' }}>
            <Mail size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input
              id="ep-email"
              type="email"
              className="stitch-input"
              style={{ paddingLeft: 34 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="stitch-form-group">
          <label className="stitch-label" htmlFor="ep-phone">
            Phone
          </label>
          <div style={{ position: 'relative' }}>
            <Phone size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input
              id="ep-phone"
              className="stitch-input"
              style={{ paddingLeft: 34 }}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 …"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="stitch-form-group">
            <label className="stitch-label" htmlFor="ep-dept">
              Department
            </label>
            <div style={{ position: 'relative' }}>
              <Building2 size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                id="ep-dept"
                className="stitch-input"
                style={{ paddingLeft: 34 }}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
              />
            </div>
          </div>
          <div className="stitch-form-group">
            <label className="stitch-label" htmlFor="ep-team">
              Team
            </label>
            <div style={{ position: 'relative' }}>
              <UsersRound size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                id="ep-team"
                className="stitch-input"
                style={{ paddingLeft: 34 }}
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="Core Team"
              />
            </div>
          </div>
        </div>

        <div className="stitch-form-group">
          <label className="stitch-label" htmlFor="ep-pass">
            New password {isAuthenticated ? '(optional)' : '(sign in required)'}
          </label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <input
              id="ep-pass"
              type="password"
              className="stitch-input"
              style={{ paddingLeft: 34 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!isAuthenticated}
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
            />
          </div>
        </div>
        <div className="stitch-form-group">
          <label className="stitch-label" htmlFor="ep-pass2">
            Confirm password
          </label>
          <input
            id="ep-pass2"
            type="password"
            className="stitch-input"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            disabled={!isAuthenticated || !password}
            autoComplete="new-password"
          />
        </div>

        {message && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              color: message.type === 'ok' ? 'var(--status-success)' : '#ef4444',
              background: message.type === 'ok' ? 'var(--status-success-bg)' : 'rgba(239,68,68,0.12)',
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            {message.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </div>
        )}
      </form>
    </Modal>
  );
};
