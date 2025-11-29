import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('ehr_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // Fetch user data from Supabase on mount to ensure it's current
  useEffect(() => {
    const fetchUserFromSupabase = async () => {
      const storedUser = localStorage.getItem('ehr_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', parsedUser.email)
            .single();
          if (data && !error) {
            setUser(data);
            localStorage.setItem('ehr_user', JSON.stringify(data));
          }
        } catch (err) {
          console.error('Error fetching user from Supabase:', err);
          // If error, keep localStorage data
        }
      }
    };

    fetchUserFromSupabase();
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('ehr_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ehr_user');
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('ehr_user', JSON.stringify(userData));
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};
