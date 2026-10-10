import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { supabaseAuth } from '../services/supabaseService';
import type { DisplayNamePref, UserProfile, UserRole } from '../types/roles';
import { roleFromPath, rolePathPrefix } from '../types/roles';
import { formatDisplayName, normalizeDisplayNamePref } from '../utils/displayName';

const EMPTY_PROFILE: UserProfile = {
  id: '',
  name: '',
  full_name: '',
  email: '',
  role: 'employee',
  avatar: '',
  department: '',
  display_name_pref: 'first',
};

interface AuthContextType {
  user: UserProfile;
  supabaseUser: User | null;
  role: UserRole;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  /** True only when signed in via Supabase with active session. */
  isAuthenticated: boolean;
  currentRoute: string;
  navigate: (path: string) => void;
  switchRole: (role: UserRole) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole, department?: string) => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Update editable profile fields for the current user (persists to profiles + avatars bucket). */
  updateProfile: (patch: {
    name?: string;
    email?: string;
    department?: string;
    team_name?: string;
    phone?: string;
    avatar?: string;
    avatarFile?: File | null;
    newPassword?: string;
    display_name_pref?: DisplayNamePref;
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
  const [user, setUser] = useState<UserProfile>(EMPTY_PROFILE);
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
      let p = await supabaseAuth.getProfile(sUser.id);

      // Auto-provision profile and users / employees tables if first time logging in
      if (!p) {
        const metaRole = (sUser.user_metadata?.role as UserRole) || 'employee';
        const metaName = sUser.user_metadata?.full_name || sUser.email?.split('@')[0] || 'User';
        const metaDept = sUser.user_metadata?.department || 'General';

        p = await supabaseAuth.upsertProfile({
          id: sUser.id,
          email: sUser.email || '',
          full_name: metaName,
          role: metaRole,
          department: metaDept,
        });
      }

      if (p) {
        const uRole = p.role as UserRole;
        const pref = normalizeDisplayNamePref((p as { display_name_pref?: string }).display_name_pref);
        const fullName = p.full_name || sUser.email?.split('@')[0] || 'User';
        profileRoleRef.current = uRole;
        setRole(uRole);
        const authedProfile: UserProfile = {
          id: p.id,
          name: formatDisplayName(fullName, pref, 'User'),
          full_name: fullName,
          email: p.email || sUser.email || '',
          role: uRole,
          avatar:
            p.avatar_url ||
            formatDisplayName(fullName, 'first', 'U').substring(0, 2).toUpperCase(),
          department: p.department || 'General',
          team_id: p.team_id,
          team_name: p.team_name || undefined,
          phone: p.phone || undefined,
          display_name_pref: pref,
        };
        setUser(authedProfile);
        userRef.current = authedProfile;

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
      const currentRole = profileRoleRef.current;

      if (sessionRef.current?.user && currentRole) {
        route = clampRouteToRole(route, currentRole);
        setRole(currentRole);
        if (window.location.hash !== `#${route}`) {
          window.location.hash = route;
        }
      }
      setCurrentRoute(route);
    };

    window.addEventListener('hashchange', syncRouteFromLocation);
    window.addEventListener('popstate', syncRouteFromLocation);

    if (window.location.hash) {
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
        syncSupabaseProfile(sess.user).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
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
          setUser(EMPTY_PROFILE);
          userRef.current = EMPTY_PROFILE;
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [isConfigured]);

  const switchRole = (newRole: UserRole) => {
    // Authenticated users are locked to their authorized Supabase role
    if (sessionRef.current?.user && profileRoleRef.current) {
      const locked = profileRoleRef.current;
      if (newRole !== locked) {
        console.warn(`Role switch blocked: authenticated strictly as ${locked}`);
        return;
      }
      const defaultRoute = `/${rolePathPrefix(locked)}/dashboard`;
      setCurrentRoute(defaultRoute);
      if (window.location.hash !== `#${defaultRoute}`) {
        window.location.hash = defaultRoute;
      }
      return;
    }
  };

  const navigate = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const lockedRole = sessionRef.current?.user ? profileRoleRef.current : null;
    const safePath = lockedRole ? clampRouteToRole(normalized, lockedRole) : normalized;

    if (lockedRole) {
      setRole(lockedRole);
    }

    setCurrentRoute(safePath);
    if (window.location.hash !== `#${safePath}`) {
      window.location.hash = safePath;
    }
  };

  const signIn = async (email: string, password: string) => {
    const { user: authedUser, session: newSession } = await supabaseAuth.signIn(email, password);
    setSupabaseUser(authedUser);
    setSession(newSession);
    sessionRef.current = newSession;
    if (authedUser) {
      await syncSupabaseProfile(authedUser);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    userRole: UserRole = 'employee',
    department: string = 'General'
  ) => {
    setIsLoading(true);
    try {
      const { user: newUser, session: newSession } = await supabaseAuth.signUp(
        email,
        password,
        fullName,
        userRole,
        department
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

  const resendConfirmationEmail = async (email: string) => {
    await supabaseAuth.resendConfirmationEmail(email);
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
      setUser(EMPTY_PROFILE);
      userRef.current = EMPTY_PROFILE;
      setRole('employee');
      window.location.hash = '';
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
    display_name_pref?: DisplayNamePref;
  }) => {
    const current = userRef.current;
    const nextFullName = (patch.name ?? current.full_name ?? current.name).trim();
    const nextEmail = (patch.email ?? current.email).trim();
    const nextDept = (patch.department ?? current.department).trim();
    const nextTeam =
      patch.team_name !== undefined ? patch.team_name.trim() : current.team_name || '';
    const nextPhone = patch.phone !== undefined ? patch.phone.trim() : current.phone || '';
    const nextPref = normalizeDisplayNamePref(
      patch.display_name_pref ?? current.display_name_pref ?? 'first'
    );
    const nextDisplay = formatDisplayName(nextFullName, nextPref, 'User');
    let nextAvatar =
      patch.avatar !== undefined
        ? patch.avatar.trim() || nextDisplay.substring(0, 2).toUpperCase()
        : current.avatar;

    if (!nextFullName) throw new Error('Name is required');
    if (!nextEmail || !nextEmail.includes('@')) throw new Error('A valid email is required');

    const uid = current.id;
    const signedIn = Boolean(sessionRef.current?.user);

    if (patch.newPassword && !signedIn) {
      throw new Error('Sign in to change your password');
    }

    if (isConfigured && (patch.avatarFile || (nextAvatar && nextAvatar.startsWith('data:')))) {
      try {
        nextAvatar = await supabaseAuth.uploadAvatar(
          uid,
          patch.avatarFile || nextAvatar
        );
      } catch (e: any) {
        console.warn('Avatar upload failed, keeping local preview:', e?.message || e);
      }
    }

    if (isConfigured) {
      const avatarUrl =
        nextAvatar.startsWith('http') || nextAvatar.startsWith('/') ? nextAvatar : null;
      await supabaseAuth.upsertProfile({
        id: uid,
        email: nextEmail,
        full_name: nextFullName,
        role: current.role,
        department: nextDept || 'General',
        team_name: nextTeam || null,
        phone: nextPhone || null,
        avatar_url: avatarUrl,
        team_id: current.team_id || null,
        display_name_pref: nextPref,
      });
      if (patch.newPassword) {
        await supabaseAuth.updatePassword(patch.newPassword);
      }
    }

    const updated: UserProfile = {
      ...current,
      name: nextDisplay,
      full_name: nextFullName,
      email: nextEmail,
      department: nextDept || 'General',
      team_name: nextTeam || undefined,
      phone: nextPhone || undefined,
      avatar: nextAvatar,
      display_name_pref: nextPref,
    };
    setUser(updated);
    userRef.current = updated;

    if (signedIn && supabaseUser) {
      await syncSupabaseProfile(supabaseUser);
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
        resendConfirmationEmail,
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
