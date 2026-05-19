// filename: src/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('ehr_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem('ehr_user', JSON.stringify(user));
      else localStorage.removeItem('ehr_user');
    } catch {
      // ignore storage errors
    }
  }, [user]);

  const login = (profile) => {
    setUser(profile);
    try {
      localStorage.setItem('ehr_user', JSON.stringify(profile));
    } catch {
      // ignore storage errors
    }
  };

  const logout = async () => {
    setUser(null);
    try {
      localStorage.removeItem('ehr_user');
    } catch {
      // ignore storage errors
    }
  };

  const updateUser = (partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...(partial || {}) };
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
