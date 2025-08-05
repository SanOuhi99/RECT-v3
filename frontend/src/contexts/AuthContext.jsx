// Enhanced AuthContext.jsx with debugging
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

  // API base URL - Enhanced with debugging
  const API_URL = process.env.REACT_APP_API_URL || 'https://backend-rectenvironment.up.railway.app';
  
  console.log('AuthContext initialized with API_URL:', API_URL);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('=== AUTH INITIALIZATION START ===');
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        console.log('Stored token exists:', !!storedToken);
        console.log('Stored user exists:', !!storedUser);

        if (storedToken && storedUser) {
          console.log('Found stored auth data, setting state...');
          setToken(storedToken);
          
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setIsAuthenticated(true);
            console.log('Parsed user:', parsedUser);

            // Verify token is still valid by fetching user data
            console.log('Verifying token validity...');
            await fetchUserData(storedToken);
            console.log('Token verification successful');
          } catch (parseError) {
            console.error('Error parsing stored user data:', parseError);
            logout();
          }
        } else {
          console.log('No stored auth data found');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        logout(); // Clear invalid session
      } finally {
        setLoading(false);
        console.log('=== AUTH INITIALIZATION END ===');
      }
    };

    initializeAuth();
  }, []);

  // Fetch current user data
  const fetchUserData = async (authToken = null) => {
    console.log('=== FETCH USER DATA START ===');
    try {
      const tokenToUse = authToken || token;
      if (!tokenToUse) {
        console.log('No token available for fetchUserData');
        throw new Error('No token available');
      }

      console.log('Making request to:', `${API_URL}/me`);
      console.log('Using token:', tokenToUse.substring(0, 20) + '...');

      const response = await fetch(`${API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('fetchUserData response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Token expired (401)');
          throw new Error('Token expired');
        }
        const errorText = await response.text();
        console.error('fetchUserData error response:', errorText);
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }

      const userData = await response.json();
      console.log('fetchUserData success:', userData);
      setUser(userData);
      setIsAuthenticated(true);

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (error.message === 'Token expired') {
        logout();
      }
      throw error;
    } finally {
      console.log('=== FETCH USER DATA END ===');
    }
  };

  // Login function
  const login = async (email, password) => {
    console.log('=== LOGIN ATTEMPT START ===');
    try {
      setLoading(true);

      console.log('Login attempt for email:', email);
      console.log('API URL:', API_URL);

      const loginData = { email, password };
      console.log('Login payload:', { email, password: '[REDACTED]' });

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      console.log('Login response status:', response.status);
      console.log('Login response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`Invalid response from server: ${responseText}`);
      }

      if (!response.ok) {
        console.error('Login failed with data:', data);
        const errorMessage = data.detail || data.message || 'Login failed';
        throw new Error(errorMessage);
      }

      console.log('Login successful, received data:', {
        ...data,
        access_token: data.access_token ? '[TOKEN_RECEIVED]' : '[NO_TOKEN]'
      });

      const { access_token, user: userData } = data;

      if (!access_token || !userData) {
        throw new Error('Invalid response format: missing token or user data');
      }

      // Store auth data
      console.log('Storing auth data...');
      setToken(access_token);
      setUser(userData);
      setIsAuthenticated(true);

      // Persist to localStorage
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      console.log('Login completed successfully');
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
      console.log('=== LOGIN ATTEMPT END ===');
    }
  };

  // Logout function
  const logout = () => {
    console.log('=== LOGOUT START ===');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    console.log('Logout completed');
    console.log('=== LOGOUT END ===');
  };

  // Update user profile
  const updateProfile = async (updateData) => {
    console.log('=== UPDATE PROFILE START ===');
    try {
      if (!token) throw new Error('No authentication token');

      console.log('Updating profile with data:', updateData);

      const response = await fetch(`${API_URL}/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log('Update profile response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Update profile failed:', errorData);
        throw new Error(errorData.detail || 'Update failed');
      }

      const updatedUser = await response.json();
      console.log('Profile updated successfully:', updatedUser);
      setUser(updatedUser);

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: error.message };
    } finally {
      console.log('=== UPDATE PROFILE END ===');
    }
  };

  // API helper function with automatic token handling
  const apiRequest = async (endpoint, options = {}) => {
    console.log(`=== API REQUEST START: ${endpoint} ===`);
    try {
      if (!token) throw new Error('No authentication token');

      console.log('Making API request:', endpoint);
      console.log('Request options:', options);

      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('API request failed with 401, logging out');
          logout();
          throw new Error('Session expired. Please login again.');
        }
        const errorData = await response.json();
        console.error('API request failed:', errorData);
        throw new Error(errorData.detail || 'Request failed');
      }

      const data = await response.json();
      console.log('API request successful');
      return data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    } finally {
      console.log(`=== API REQUEST END: ${endpoint} ===`);
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
    
    // Debug info
    API_URL,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
