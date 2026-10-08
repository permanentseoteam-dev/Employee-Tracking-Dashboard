import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { supabaseAuth } from '../services/supabaseService';
import type { UserProfile, UserRole } from '../types/roles';

// Default profiles matching seeded Supabase database users
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
  currentRoute: string;
  navigate: (path: string) => void;
  switchRole: (role: UserRole) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getRouteFromHash = (): string => {
    const raw = window.location.hash.replace(/^#\/?/, '/');
    if (raw.startsWith('/admin') || raw.startsWith('/manager') || raw.startsWith('/employee')) {
      return raw.startsWith('/') ? raw : `/${raw}`;
    }
    return '/employee/dashboard';
  };

  const getRoleFromPath = (path: string): UserRole => {
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/manager')) return 'manager';
    return 'employee';
  };

  const initialRoute = getRouteFromHash();
  const initialRole = getRoleFromPath(initialRoute);

  const [role, setRole] = useState<UserRole>(initialRole);
  const [user, setUser] = useState<UserProfile>(DEFAULT_PROFILES[initialRole]);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentRoute, setCurrentRoute] = useState<string>(initialRoute);
  const isConfigured = supabaseAuth.isConfigured();

  // Listen to browser Back (<-) and Forward (->) button events
  useEffect(() => {
    const syncRouteFromLocation = () => {
      const route = getRouteFromHash();
      const targetRole = getRoleFromPath(route);

      setRole((prevRole) => {
        if (prevRole !== targetRole) {
          setUser(DEFAULT_PROFILES[targetRole]);
          return targetRole;
        }
        return prevRole;
      });

      setCurrentRoute(route);
    };

    window.addEventListener('hashchange', syncRouteFromLocation);
    window.addEventListener('popstate', syncRouteFromLocation);

    // Initial check
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

  const syncSupabaseProfile = async (sUser: User | null) => {
    if (!sUser || !isConfigured) return;

    try {
      const p = await supabaseAuth.getProfile(sUser.id);
      if (p) {
        const uRole = p.role as UserRole;
        setRole(uRole);
        setUser({
          id: p.id,
          name: p.full_name || sUser.email?.split('@')[0] || 'User',
          email: p.email || sUser.email || '',
          role: uRole,
          avatar: (p.full_name || sUser.email || 'U').substring(0, 2).toUpperCase(),
          department: p.department || 'General',
          team_id: p.team_id,
        });
      }
    } catch (err) {
      console.warn('Failed to load profile from Supabase:', err);
    }
  };

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    supabaseAuth.getSession().then((sess) => {
      setSession(sess);
      setSupabaseUser(sess?.user ?? null);
      if (sess?.user) {
        syncSupabaseProfile(sess.user);
      }
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);
        setSupabaseUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await syncSupabaseProfile(currentSession.user);
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [isConfigured]);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    setUser(DEFAULT_PROFILES[newRole]);
    const defaultRoute = `/${newRole}/dashboard`;
    setCurrentRoute(defaultRoute);
    if (window.location.hash !== `#${defaultRoute}`) {
      window.location.hash = defaultRoute;
    }
  };

  const navigate = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const targetRole = getRoleFromPath(normalized);

    if (targetRole !== role) {
      setRole(targetRole);
      setUser(DEFAULT_PROFILES[targetRole]);
    }

    setCurrentRoute(normalized);
    if (window.location.hash !== `#${normalized}`) {
      window.location.hash = normalized;
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user: authedUser, session: newSession } = await supabaseAuth.signIn(email, password);
      setSupabaseUser(authedUser);
      setSession(newSession);
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
      const { user: newUser, session: newSession } = await supabaseAuth.signUp(email, password, fullName, userRole);
      setSupabaseUser(newUser);
      setSession(newSession);
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
      setUser(DEFAULT_PROFILES[role]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (supabaseUser) {
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
        currentRoute,
        navigate,
        switchRole,
        signIn,
        signUp,
        signOut,
        refreshProfile,
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
