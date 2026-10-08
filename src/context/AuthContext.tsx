import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { supabaseAuth } from '../services/supabaseService';
import type { UserProfile, UserRole } from '../types/roles';

// Default profiles matching seeded Supabase database users
const DEFAULT_PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    avatar: 'AU',
    department: 'Management',
  },
  manager: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Alex Vance (Manager)',
    email: 'alex.v@company.com',
    role: 'manager',
    avatar: 'AV',
    department: 'Engineering',
    team_id: 'team-backend',
    team_name: 'Core Backend Team',
  },
  employee: {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Arsal (Employee)',
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
  const [role, setRole] = useState<UserRole>('employee');
  const [user, setUser] = useState<UserProfile>(DEFAULT_PROFILES['employee']);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('/admin') || hash.startsWith('/manager') || hash.startsWith('/employee')) {
      return hash;
    }
    return '/employee/dashboard';
  });
  const isConfigured = supabaseAuth.isConfigured();

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
    window.location.hash = defaultRoute;
  };

  const navigate = (path: string) => {
    if (path.startsWith('/admin') && role !== 'admin') {
      alert(`403 Forbidden: Your current role [${role.toUpperCase()}] is not authorized to access Admin resources.`);
      return;
    }
    if ((path.startsWith('/admin') || path.startsWith('/manager')) && role === 'employee') {
      alert(`403 Forbidden: Employee accounts cannot access management consoles.`);
      return;
    }
    setCurrentRoute(path);
    window.location.hash = path;
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
