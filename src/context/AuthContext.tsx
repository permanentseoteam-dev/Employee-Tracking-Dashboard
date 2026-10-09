import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { supabaseAuth } from '../services/supabaseService';
import type { UserProfile, UserRole } from '../types/roles';
import { roleFromPath, rolePathPrefix } from '../types/roles';

/** Per-role local edits key — keeps admin/manager/PM/employee profiles separate. */
function demoProfileKey(role: UserRole, id: string) {
  return `stitch_profile_edit_${role}_${id}`;
}

function withDemoProfileEdits(base: UserProfile): UserProfile {
  try {
    const raw = localStorage.getItem(demoProfileKey(base.role, base.id));
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return {
      ...base,
      name: saved.name || base.name,
      email: saved.email || base.email,
      department: saved.department || base.department,
      team_name: saved.team_name || base.team_name,
      phone: saved.phone || base.phone,
      avatar: saved.avatar || base.avatar,
    };
  } catch {
    return base;
  }
}

/** Demo-only profiles used when Supabase auth is not signed in. */
const DEFAULT_PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Arsal (Admin)',
    email: 'arsal.admin@company.com',
    role: 'admin',
    avatar: 'AR',
    department: 'Management',
  },
  manager: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Arsal (Manager)',
    email: 'arsal.manager@company.com',
    role: 'manager',
    avatar: 'AR',
    department: 'Engineering',
    team_id: 'team-backend',
    team_name: 'Core Backend Team',
  },
  project_manager: {
    // Dedicated id — must exist in public.users (projects.manager_id FK).
    // Do not reuse dddddddd (Michael Chen employee seed).
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    name: 'Arsal (Project Manager)',
    email: 'project.manager@company.com',
    role: 'project_manager',
    avatar: 'PM',
    department: 'Delivery',
  },
  employee: {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Arsal',
    email: 'arsal@company.com',
    role: 'employee',
    avatar: 'AR',
    department: 'Engineering',
    team_id: 'team-backend',
    team_name: 'Core Backend Team',
    assigned_manager_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  },
};

interface AuthContextType {
  user: UserProfile;
  supabaseUser: User | null;
  role: UserRole;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  /** True when signed in via Supabase — role switching is locked to the profile role. */
  isAuthenticated: boolean;
  currentRoute: string;
  navigate: (path: string) => void;
  switchRole: (role: UserRole) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Update editable profile fields for the current user (any role). Persists to profiles + avatars bucket when configured. */
  updateProfile: (patch: {
    name?: string;
    email?: string;
    department?: string;
    team_name?: string;
    phone?: string;
    avatar?: string;
    avatarFile?: File | null;
    newPassword?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getRouteFromHash = (): string => {
    const raw = window.location.hash.replace(/^#\/?/, '/');
    if (
      raw.startsWith('/admin') ||
      raw.startsWith('/manager') ||
      raw.startsWith('/project-manager') ||
      raw.startsWith('/project_manager') ||
      raw.startsWith('/employee')
    ) {
      return raw.startsWith('/') ? raw : `/${raw}`;
    }
    return '/employee/dashboard';
  };

  const getRoleFromPath = (path: string): UserRole => roleFromPath(path);

  const initialRoute = getRouteFromHash();
  const initialRole = getRoleFromPath(initialRoute);

  const [role, setRole] = useState<UserRole>(initialRole);
  const [user, setUser] = useState<UserProfile>(() =>
    withDemoProfileEdits(DEFAULT_PROFILES[initialRole])
  );
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentRoute, setCurrentRoute] = useState<string>(initialRoute);
  const isConfigured = supabaseAuth.isConfigured();

  const sessionRef = useRef<Session | null>(null);
  const profileRoleRef = useRef<UserRole | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  sessionRef.current = session;

  const isAuthenticated = Boolean(session?.user);

  const clampRouteToRole = (path: string, allowedRole: UserRole): string => {
    const targetRole = getRoleFromPath(path);
    if (targetRole === allowedRole) return path.startsWith('/') ? path : `/${path}`;
    const rest =
      path.replace(/^\/(admin|project-manager|project_manager|manager|employee)/, '') || '/dashboard';
    const prefix = rolePathPrefix(allowedRole);
    return `/${prefix}${rest.startsWith('/') ? rest : `/${rest}`}`;
  };

  const syncSupabaseProfile = async (sUser: User | null) => {
    if (!sUser || !isConfigured) return;

    try {
      const p = await supabaseAuth.getProfile(sUser.id);
      if (p) {
        const uRole = p.role as UserRole;
        profileRoleRef.current = uRole;
        setRole(uRole);
        setUser({
          id: p.id,
          name: p.full_name || sUser.email?.split('@')[0] || 'User',
          email: p.email || sUser.email || '',
          role: uRole,
          avatar:
            p.avatar_url ||
            (p.full_name || sUser.email || 'U').substring(0, 2).toUpperCase(),
          department: p.department || 'General',
          team_id: p.team_id,
          team_name: p.team_name || undefined,
          phone: p.phone || undefined,
        });
        const safeRoute = clampRouteToRole(getRouteFromHash(), uRole);
        setCurrentRoute(safeRoute);
        if (window.location.hash !== `#${safeRoute}`) {
          window.location.hash = safeRoute;
        }
      }
    } catch (err) {
      console.warn('Failed to load profile from Supabase:', err);
    }
  };

  // Browser back/forward + hash sync
  useEffect(() => {
    const syncRouteFromLocation = () => {
      let route = getRouteFromHash();
      const lockedRole = sessionRef.current?.user ? profileRoleRef.current : null;

      if (lockedRole) {
        route = clampRouteToRole(route, lockedRole);
        setRole(lockedRole);
        if (window.location.hash !== `#${route}`) {
          window.location.hash = route;
        }
      } else {
        const targetRole = getRoleFromPath(route);
        setRole((prevRole) => {
          if (prevRole !== targetRole) {
            setUser(withDemoProfileEdits(DEFAULT_PROFILES[targetRole]));
            return targetRole;
          }
          return prevRole;
        });
      }

      setCurrentRoute(route);
    };

    window.addEventListener('hashchange', syncRouteFromLocation);
    window.addEventListener('popstate', syncRouteFromLocation);

    if (!window.location.hash) {
      window.location.hash = initialRoute;
    } else {
      syncRouteFromLocation();
    }

    return () => {
      window.removeEventListener('hashchange', syncRouteFromLocation);
      window.removeEventListener('popstate', syncRouteFromLocation);
    };
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    supabaseAuth.getSession().then((sess) => {
      setSession(sess);
      sessionRef.current = sess;
      setSupabaseUser(sess?.user ?? null);
      if (sess?.user) {
        syncSupabaseProfile(sess.user);
      }
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);
        sessionRef.current = currentSession;
        setSupabaseUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await syncSupabaseProfile(currentSession.user);
        } else {
          profileRoleRef.current = null;
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [isConfigured]);

  const switchRole = (newRole: UserRole) => {
    // Authenticated users cannot escalate / switch roles — only demo mode may.
    if (sessionRef.current?.user && profileRoleRef.current) {
      const locked = profileRoleRef.current;
      if (newRole !== locked) {
        console.warn(`Role switch blocked: authenticated as ${locked}`);
        return;
      }
      const defaultRoute = `/${rolePathPrefix(locked)}/dashboard`;
      setCurrentRoute(defaultRoute);
      if (window.location.hash !== `#${defaultRoute}`) {
        window.location.hash = defaultRoute;
      }
      return;
    }

    setRole(newRole);
    setUser(withDemoProfileEdits(DEFAULT_PROFILES[newRole]));
    const defaultRoute = `/${rolePathPrefix(newRole)}/dashboard`;
    setCurrentRoute(defaultRoute);
    if (window.location.hash !== `#${defaultRoute}`) {
      window.location.hash = defaultRoute;
    }
  };

  const navigate = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const lockedRole = sessionRef.current?.user ? profileRoleRef.current : null;
    const safePath = lockedRole ? clampRouteToRole(normalized, lockedRole) : normalized;
    const targetRole = getRoleFromPath(safePath);

    if (!lockedRole && targetRole !== role) {
      setRole(targetRole);
      setUser(withDemoProfileEdits(DEFAULT_PROFILES[targetRole]));
    } else if (lockedRole) {
      setRole(lockedRole);
    }

    setCurrentRoute(safePath);
    if (window.location.hash !== `#${safePath}`) {
      window.location.hash = safePath;
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user: authedUser, session: newSession } = await supabaseAuth.signIn(email, password);
      setSupabaseUser(authedUser);
      setSession(newSession);
      sessionRef.current = newSession;
      if (authedUser) {
        await syncSupabaseProfile(authedUser);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    userRole: UserRole = 'employee'
  ) => {
    setIsLoading(true);
    try {
      const { user: newUser, session: newSession } = await supabaseAuth.signUp(
        email,
        password,
        fullName,
        userRole
      );
      setSupabaseUser(newUser);
      setSession(newSession);
      sessionRef.current = newSession;
      if (newUser) {
        await syncSupabaseProfile(newUser);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isConfigured) {
        await supabaseAuth.signOut();
      }
      setSupabaseUser(null);
      setSession(null);
      sessionRef.current = null;
      profileRoleRef.current = null;
      setUser(withDemoProfileEdits(DEFAULT_PROFILES[role]));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (supabaseUser) {
      await syncSupabaseProfile(supabaseUser);
    }
  };

  const updateProfile = async (patch: {
    name?: string;
    email?: string;
    department?: string;
    team_name?: string;
    phone?: string;
    avatar?: string;
    avatarFile?: File | null;
    newPassword?: string;
  }) => {
    const current = userRef.current;
    const nextName = (patch.name ?? current.name).trim();
    const nextEmail = (patch.email ?? current.email).trim();
    const nextDept = (patch.department ?? current.department).trim();
    const nextTeam =
      patch.team_name !== undefined ? patch.team_name.trim() : current.team_name || '';
    const nextPhone = patch.phone !== undefined ? patch.phone.trim() : current.phone || '';
    let nextAvatar =
      patch.avatar !== undefined
        ? patch.avatar.trim() || nextName.substring(0, 2).toUpperCase()
        : current.avatar;

    if (!nextName) throw new Error('Name is required');
    if (!nextEmail || !nextEmail.includes('@')) throw new Error('A valid email is required');

    const uid = current.id;
    const signedIn = Boolean(sessionRef.current?.user);

    if (patch.newPassword && !signedIn) {
      throw new Error('Sign in to change your password');
    }

    // Prefer uploading photo to avatars bucket whenever Supabase is configured
    if (isConfigured && (patch.avatarFile || (nextAvatar && nextAvatar.startsWith('data:')))) {
      try {
        nextAvatar = await supabaseAuth.uploadAvatar(
          uid,
          patch.avatarFile || nextAvatar
        );
      } catch (e: any) {
        // Keep data-URL locally if bucket missing; still save profile row
        console.warn('Avatar upload failed, keeping local preview:', e?.message || e);
      }
    }

    if (isConfigured) {
      const avatarUrl =
        nextAvatar.startsWith('http') || nextAvatar.startsWith('/') ? nextAvatar : null;
      await supabaseAuth.upsertProfile({
        id: uid,
        email: nextEmail,
        full_name: nextName,
        role: current.role,
        department: nextDept || 'General',
        team_name: nextTeam || null,
        phone: nextPhone || null,
        avatar_url: avatarUrl,
        team_id: current.team_id || null,
      });
      if (patch.newPassword) {
        await supabaseAuth.updatePassword(patch.newPassword);
      }
    }

    const updated: UserProfile = {
      ...current,
      name: nextName,
      email: nextEmail,
      department: nextDept || 'General',
      team_name: nextTeam || undefined,
      phone: nextPhone || undefined,
      avatar: nextAvatar,
    };
    setUser(updated);
    userRef.current = updated;

    try {
      localStorage.setItem(
        demoProfileKey(updated.role, updated.id),
        JSON.stringify({
          name: updated.name,
          email: updated.email,
          department: updated.department,
          team_name: updated.team_name,
          phone: updated.phone,
          avatar: updated.avatar,
        })
      );
    } catch {
      /* ignore */
    }

    if (signedIn && supabaseUser) {
      await syncSupabaseProfile(supabaseUser);
      setUser((prev) => ({
        ...prev,
        avatar: nextAvatar || prev.avatar,
        team_name: nextTeam || prev.team_name,
        phone: nextPhone || prev.phone,
      }));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        role,
        session,
        isLoading,
        isConfigured,
        isAuthenticated,
        currentRoute,
        navigate,
        switchRole,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
