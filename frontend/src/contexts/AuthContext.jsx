// Production-Ready AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // API base URL - Use production URL by default
  const API_URL = process.env.REACT_APP_API_URL || 'https://backend-rectenvironment.up.railway.app';

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setIsAuthenticated(true);

            // Verify token is still valid
            await fetchUserData(storedToken);
          } catch (parseError) {
            console.error('Error parsing stored user data');
            logout();
          }
        }
      } catch (error) {
        console.error('Error initializing auth');
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Fetch current user data
  const fetchUserData = async (authToken = null) => {
    try {
      const tokenToUse = authToken || token;
      if (!tokenToUse) {
        throw new Error('No token available');
      }

      const response = await fetch(`${API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Token expired');
        }
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }

      const userData = await response.json();
      setUser(userData);
      setIsAuthenticated(true);

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      if (error.message === 'Token expired') {
        logout();
      }
      throw error;
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let errorMessage = 'Login failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (parseError) {
          // If response isn't JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      const { access_token, user: userData } = data;

      if (!access_token || !userData) {
        return { success: false, error: 'Invalid response from server' };
      }

      // Store auth data
      setToken(access_token);
      setUser(userData);
      setIsAuthenticated(true);

      // Persist to localStorage
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      return { success: true, user: userData };
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
    setUser(null);
    setIsAuthenticated(false);
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Update user profile
  const updateProfile = async (updateData) => {
    try {
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${API_URL}/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Update failed');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      return { success: true, user: updatedUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // API helper function with automatic token handling
  const apiRequest = async (endpoint, options = {}) => {
    try {
      if (!token) throw new Error('No authentication token');

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
          throw new Error('Session expired. Please login again.');
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

  // Fetch seen properties
  const fetchSeenProperties = async () => {
    return await apiRequest('/seen_properties');
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    return await apiRequest('/seen_properties/stats');
  };

  // Fetch paginated properties with filters
  const fetchPaginatedProperties = async (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return await apiRequest(`/seen_properties/paginated?${searchParams}`);
  };

  // Fetch detailed analytics
  const fetchDetailedAnalytics = async () => {
    return await apiRequest('/seen_properties/analytics');
  };

  // Fetch user activity summary
  const fetchUserActivitySummary = async () => {
    return await apiRequest('/user/activity-summary');
  };

  const contextValue = {
    // State
    user,
    token,
    loading,
    isAuthenticated,
    
    // Actions
    login,
    logout,
    updateProfile,
    fetchUserData,
    
    // API helpers
    apiRequest,
    fetchSeenProperties,
    fetchDashboardStats,
    fetchPaginatedProperties,
    fetchDetailedAnalytics,
    fetchUserActivitySummary,
    
    // Config
    API_URL,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
