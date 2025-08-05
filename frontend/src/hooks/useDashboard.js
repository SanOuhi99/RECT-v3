// frontend/src/hooks/useDashboard.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useDashboard = () => {
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const { apiRequest, user } = useAuth();

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');

      // Fetch all data in parallel
      const [propertiesData, statsData, analyticsData] = await Promise.all([
        apiRequest('/seen_properties'),
        apiRequest('/seen_properties/stats'),
        apiRequest('/seen_properties/analytics')
      ]);

      setProperties(propertiesData || []);
      setStats(statsData || {});
      setAnalytics(analyticsData || {});
      setLastUpdated(new Date());

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [apiRequest]);

  // Fetch paginated properties
  const fetchPaginatedProperties = useCallback(async (page = 1, filters = {}) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '20',
        ...filters
      });

      const data = await apiRequest(`/seen_properties/paginated?${params}`);
      return data;
    } catch (err) {
      console.error('Error fetching paginated properties:', err);
      throw err;
    }
  }, [apiRequest]);

  // Refresh data without showing loading spinner
  const refreshData = useCallback(async () => {
    await fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Get activity summary
  const fetchActivitySummary = useCallback(async () => {
    try {
      const data = await apiRequest('/user/activity-summary');
      return data;
    } catch (err) {
      console.error('Error fetching activity summary:', err);
      throw err;
    }
  }, [apiRequest]);

  // Filter properties by various criteria
  const filterProperties = useCallback((filters) => {
    let filtered = [...properties];

    if (filters.state) {
      filtered = filtered.filter(prop => 
        prop.state?.toLowerCase().includes(filters.state.toLowerCase())
      );
    }

    if (filters.county) {
      filtered = filtered.filter(prop => 
        prop.county?.toLowerCase().includes(filters.county.toLowerCase())
      );
    }

    if (filters.daysBack) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.daysBack);
      filtered = filtered.filter(prop => 
        new Date(prop.created_at) >= cutoffDate
      );
    }

    if (filters.hasContact) {
      filtered = filtered.filter(prop => 
        prop.contact_email || prop.contact_first_name
      );
    }

    return filtered;
  }, [properties]);

  // Get property statistics
  const getPropertyStats = useCallback(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentProperties = properties.filter(prop => 
      new Date(prop.created_at) >= sevenDaysAgo
    );

    const monthlyProperties = properties.filter(prop => 
      new Date(prop.created_at) >= thirtyDaysAgo
    );

    const propertiesWithContacts = properties.filter(prop => 
      prop.contact_email || prop.contact_first_name
    );

    const stateDistribution = properties.reduce((acc, prop) => {
      const state = prop.state || 'Unknown';
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    return {
      total: properties.length,
      recent: recentProperties.length,
      monthly: monthlyProperties.length,
      withContacts: propertiesWithContacts.length,
      contactRate: properties.length > 0 ? 
        Math.round((propertiesWithContacts.length / properties.length) * 100) : 0,
      stateDistribution: Object.entries(stateDistribution)
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count),
      uniqueStates: Object.keys(stateDistribution).length
    };
  }, [properties]);

  // Initialize dashboard data
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [refreshData]);

  return {
    // Data
    properties,
    stats,
    analytics,
    loading,
    error,
    lastUpdated,

    // Actions
    fetchDashboardData,
    refreshData,
    fetchPaginatedProperties,
    fetchActivitySummary,

    // Utilities
    filterProperties,
    getPropertyStats,

    // Computed values
    computedStats: getPropertyStats()
  };
};
