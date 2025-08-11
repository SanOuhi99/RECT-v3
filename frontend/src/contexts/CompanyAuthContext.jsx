// frontend/src/contexts/CompanyAuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const CompanyAuthContext = createContext();

export const useCompanyAuth = () => {
  const context = useContext(CompanyAuthContext);
  if (!context) {
    throw new Error('useCompanyAuth must be used within a CompanyAuthProvider');
  }
  return context;
};

export const CompanyAuthProvider = ({ children }) => {
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // API base URL
  const API_URL = process.env.REACT_APP_API_URL || 'https://backend-rectenvironment.up.railway.app';

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeCompanyAuth = async () => {
      try {
        const storedToken = localStorage.getItem('company_token');
        const storedCompany = localStorage.getItem('company_data');

        if (storedToken && storedCompany) {
          setToken(storedToken);
          
          try {
            const parsedCompany = JSON.parse(storedCompany);
            setCompany(parsedCompany);
            setIsAuthenticated(true);

            // Verify token is still valid
            await fetchCompanyData(storedToken);
          } catch (parseError) {
            console.error('Error parsing stored company data');
            logout();
          }
        }
      } catch (error) {
        console.error('Error initializing company auth');
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeCompanyAuth();
  }, []);

  // Fetch current company data
  const fetchCompanyData = async (authToken = null) => {
    try {
      const tokenToUse = authToken || token;
      if (!tokenToUse) {
        throw new Error('No company token available');
      }

      const response = await fetch(`${API_URL}/company/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Company token expired');
        }
        throw new Error(`Failed to fetch company data: ${response.status}`);
      }

      const companyData = await response.json();
      setCompany(companyData);
      setIsAuthenticated(true);

      // Update localStorage
      localStorage.setItem('company_data', JSON.stringify(companyData));

      return companyData;
    } catch (error) {
      if (error.message === 'Company token expired') {
        logout();
      }
      throw error;
    }
  };

  // Login function
  const login = async (companycode, password) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/company/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companycode, password }),
      });

      if (!response.ok) {
        let errorMessage = 'Company login failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage;
        }
        
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      const { access_token, company: companyData } = data;

      if (!access_token || !companyData) {
        return { success: false, error: 'Invalid response from server' };
      }

      // Store auth data
      setToken(access_token);
      setCompany(companyData);
      setIsAuthenticated(true);

      // Persist to localStorage
      localStorage.setItem('company_token', access_token);
      localStorage.setItem('company_data', JSON.stringify(companyData));

      return { success: true, company: companyData };
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
    setCompany(null);
    setIsAuthenticated(false);
    
    // Clear localStorage
    localStorage.removeItem('company_token');
    localStorage.removeItem('company_data');
  };

  // Update company profile
  const updateCompany = async (updateData) => {
    try {
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${API_URL}/company/me`, {
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

      const updatedCompany = await response.json();
      setCompany(updatedCompany);

      // Update localStorage
      localStorage.setItem('company_data', JSON.stringify(updatedCompany));

      return { success: true, company: updatedCompany };
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

  // Fetch company agents
  const fetchCompanyAgents = async () => {
    return await apiRequest('/company/agents');
  };

  // Fetch company statistics
  const fetchCompanyStats = async () => {
    return await apiRequest('/company/stats');
  };

  // Fetch company analytics
  const fetchCompanyAnalytics = async () => {
    return await apiRequest('/company/analytics');
  };

  // Add new agent
  const addAgent = async (agentData) => {
    return await apiRequest('/company/agents', {
      method: 'POST',
      body: JSON.stringify(agentData)
    });
  };

  // Update agent
  const updateAgent = async (agentId, agentData) => {
    return await apiRequest(`/company/agents/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(agentData)
    });
  };

  // Delete agent
  const deleteAgent = async (agentId) => {
    return await apiRequest(`/company/agents/${agentId}`, {
      method: 'DELETE'
    });
  };

  // Toggle agent status
  const toggleAgentStatus = async (agentId) => {
    return await apiRequest(`/company/agents/${agentId}/toggle-status`, {
      method: 'PUT'
    });
  };

  const contextValue = {
    // State
    company,
    token,
    loading,
    isAuthenticated,
    
    // Actions
    login,
    logout,
    updateCompany,
    fetchCompanyData,
    
    // API helpers
    apiRequest,
    fetchCompanyAgents,
    fetchCompanyStats,
    fetchCompanyAnalytics,
    addAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    
    // Config
    API_URL,
  };

  return (
    <CompanyAuthContext.Provider value={contextValue}>
      {children}
    </CompanyAuthContext.Provider>
  );
};
