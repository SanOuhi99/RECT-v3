// frontend/src/contexts/AdminAuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // API base URL - Use production URL by default
  const API_URL = process.env.REACT_APP_API_URL || 'https://backend-rectenvironment.up.railway.app';

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAdminAuth = async () => {
      try {
        const storedToken = localStorage.getItem('admin_token');
        const storedAdmin = localStorage.getItem('admin_user');

        if (storedToken && storedAdmin) {
          setToken(storedToken);
          
          try {
            const parsedAdmin = JSON.parse(storedAdmin);
            setAdmin(parsedAdmin);
            setIsAuthenticated(true);

            // Verify token is still valid
            await fetchAdminData(storedToken);
          } catch (parseError) {
            console.error('Error parsing stored admin data');
            logout();
          }
        }
      } catch (error) {
        console.error('Error initializing admin auth');
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAdminAuth();
  }, []);

  // Fetch current admin data
  const fetchAdminData = async (authToken = null) => {
    try {
      const tokenToUse = authToken || token;
      if (!tokenToUse) {
        throw new Error('No admin token available');
      }

      const response = await fetch(`${API_URL}/admin/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Admin token expired');
        }
        throw new Error(`Failed to fetch admin data: ${response.status}`);
      }

      const adminData = await response.json();
      setAdmin(adminData);
      setIsAuthenticated(true);

      // Update localStorage
      localStorage.setItem('admin_user', JSON.stringify(adminData));

      return adminData;
    } catch (error) {
      if (error.message === 'Admin token expired') {
        logout();
      }
      throw error;
    }
  };

  // Login function
  const login = async (username, password) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        let errorMessage = 'Admin login failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage;
        }
        
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      const { access_token, admin: adminData } = data;

      if (!access_token || !adminData) {
        return { success: false, error: 'Invalid response from server' };
      }

      // Store auth data
      setToken(access_token);
      setAdmin(adminData);
      setIsAuthenticated(true);

      // Persist to localStorage
      localStorage.setItem('admin_token', access_token);
      localStorage.setItem('admin_user', JSON.stringify(adminData));

      return { success: true, admin: adminData };
    } catch (error) {
      let errorMessage = 'Network error. Please check your connection and try again.';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to server. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setToken(null);
    setAdmin(null);
    setIsAuthenticated(false);
    
    // Clear localStorage
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  };

  // API helper function with automatic token handling
  const apiRequest = async (endpoint, options = {}) => {
    try {
      if (!token) throw new Error('No admin authentication token');

      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error('Admin session expired. Please login again.');
        }
        
        let errorMessage = 'Request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  // Admin-specific API helpers
  const fetchUsers = async (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return await apiRequest(`/admin/users?${searchParams}`);
  };

  const fetchCompanies = async () => {
    return await apiRequest('/admin/companies');
  };

  const fetchStats = async () => {
    return await apiRequest('/admin/stats');
  };

  const fetchSystemHealth = async () => {
    return await apiRequest('/admin/system/health');
  };

  const deleteUser = async (userId) => {
    return await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });
  };

  const toggleUserStatus = async (userId) => {
    return await apiRequest(`/admin/users/${userId}/toggle-status`, { method: 'PUT' });
  };

  // Performance monitoring
  const getPerformanceMetrics = async () => {
    try {
      const [stats, health] = await Promise.all([
        fetchStats(),
        fetchSystemHealth()
      ]);

      return {
        overview: stats.overview,
        system_health: health,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      throw error;
    }
  };

  // Audit logging (for future implementation)
  const logAdminAction = async (action, details) => {
    try {
      console.log(`Admin Action: ${action}`, details);
      // Future: Send to audit log endpoint
      // await apiRequest('/admin/audit-log', {
      //   method: 'POST',
      //   body: JSON.stringify({ action, details, timestamp: new Date().toISOString() })
      // });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const contextValue = {
    // State
    admin,
    token,
    loading,
    isAuthenticated,
    
    // Actions
    login,
    logout,
    fetchAdminData,
    
    // API helpers
    apiRequest,
    fetchUsers,
    fetchCompanies,
    fetchStats,
    fetchSystemHealth,
    deleteUser,
    toggleUserStatus,
    getPerformanceMetrics,
    logAdminAction,
    
    // Config
    API_URL,
  };

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
};
