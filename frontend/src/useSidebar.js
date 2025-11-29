import { useState, useEffect } from 'react';

const useSidebar = (defaultCollapsed = false) => {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : defaultCollapsed;
  });

  const toggle = () => {
    setCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newVal));
      return newVal;
    });
  };

  // Listen for storage changes in case multiple tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'sidebarCollapsed') {
        setCollapsed(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { collapsed, toggle };
};

export { useSidebar };
