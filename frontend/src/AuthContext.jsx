// filename: src/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const supaUser = data?.user ?? null;
        if (supaUser && mounted) {
          // fetch minimal profile (exclude sensitive fields) - adjust table/columns to match your schema
          const { data: profile } = await supabase
            .from('users')
            .select('id, name, email, avatar, role')
            .eq('email', supaUser.email)
            .single();
          if (profile && mounted) {
            setUser({
              id: profile.id,
              name: profile.name,
              email: profile.email,
              avatar: profile.avatar,
              role: profile.role,
            });
          } else if (mounted) {
            // fallback to supabase user object but only safe fields
            setUser({ id: supaUser.id, email: supaUser.email });
          }
        }
      } catch (e) {
        // don't log sensitive session data
        console.error('Auth init error');
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        return;
      }
      try {
        const email = session.user.email;
        const { data: profile } = await supabase
          .from('users')
          .select('id, name, email, avatar, role')
          .eq('email', email)
          .single();
        if (profile) {
          setUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            avatar: profile.avatar,
            role: profile.role,
          });
        } else {
          setUser({ id: session.user.id, email: session.user.email });
        }
      } catch {
        setUser({ id: session.user.id, email: session.user.email });
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const login = (profile) => {
    // keep minimal safe info in-memory
    setUser(profile);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
