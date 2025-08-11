// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import Navbar from '../components/Navbar';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [systemHealth, setSystemHealth] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const { admin, logout, apiRequest } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'companies') {
      loadCompanies();
    } else if (activeTab === 'system') {
      loadSystemHealth();
    }
  }, [activeTab, currentPage, searchTerm, selectedCompany]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const statsData = await apiRequest('/admin/stats');
      setStats(statsData);
    } catch (error) {
      setError('Failed to load dashboard data');
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage,
        page_size: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCompany && { company: selectedCompany })
      });

      const data = await apiRequest(`/admin/users?${params}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      setError('Failed to load users');
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await apiRequest('/admin/companies');
      setCompanies(data);
    } catch (error) {
      setError('Failed to load companies');
    }
  };

  const loadSystemHealth = async () => {
    try {
      const data = await apiRequest('/admin/system/health');
      setSystemHealth(data);
    } catch (error) {
      setError('Failed to load system health');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });
      loadUsers(); // Reload users list
      alert('User deleted successfully');
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && activeTab === 'overview') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        .admin-header {
          background: linear-gradient(135deg, #1f2937, #374151);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .stat-card {
          transition: all 0.3s ease;
          background: linear-gradient(135deg, #ffffff, #f8fafc);
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .tab-button {
          transition: all 0.3s ease;
          border-bottom: 3px solid transparent;
        }
        
        .tab-button.active {
          color: #dc2626;
          border-bottom-color: #dc2626;
          background-color: rgba(220, 38, 38, 0.05);
        }
        
        .tab-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .data-table {
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        
        .table-row:hover {
          background-color: #f8fafc;
        }
        
        .action-button {
          transition: all 0.2s ease;
        }
        
        .action-button:hover {
          transform: scale(1.05);
        }
        
        .health-indicator {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .chart-container {
          background: linear-gradient(135deg, #f8fafc, #ffffff);
          border: 1px solid #e2e8f0;
        }
      `}</style>

      <Navbar />

      {/* Admin Header */}
      <div className="admin-header text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold flex items-center">
                <i className="fas fa-shield-alt mr-3"></i>
                Admin Dashboard
              </h1>
              <p className="text-gray-300 mt-1">
                Welcome back, {admin?.username} | Role: {admin?.role}
              </p>
              <p className="text-sm text-gray-400">
                Last login: {formatDate(admin?.last_login)}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="flex items-center text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 health-indicator"></span>
                  System Online
                </div>
                <div className="text-xs text-gray-400">
                  {new Date().toLocaleString()}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {error}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="flex border-b overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: 'fas fa-chart-pie' },
              { id: 'users', label: 'Users', icon: 'fas fa-users' },
              { id: 'companies', label: 'Companies', icon: 'fas fa-building' },
              { id: 'system', label: 'System Health', icon: 'fas fa-heartbeat' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab-button px-6 py-4 font-medium whitespace-nowrap ${
                  activeTab === tab.id ? 'active' : 'text-gray-600'
                }`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                  setSearchTerm('');
                  setSelectedCompany('');
                }}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.overview?.total_users || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <i className="fas fa-users text-2xl text-blue-600"></i>
                    </div>
                  </div>
                </div>

                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Companies</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.overview?.total_companies || 0}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <i className="fas fa-building text-2xl text-green-600"></i>
                    </div>
                  </div>
                </div>

                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Properties</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.overview?.total_properties || 0}</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <i className="fas fa-home text-2xl text-purple-600"></i>
                    </div>
                  </div>
                </div>

                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-orange-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Recent Signups</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.overview?.recent_signups || 0}</p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <i className="fas fa-user-plus text-2xl text-orange-600"></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts and Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Users by Company */}
                <div className="chart-container bg-white rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    <i className="fas fa-chart-bar mr-2 text-blue-600"></i>
                    Users by Company
                  </h3>
                  <div className="space-y-3">
                    {stats.users_by_company?.slice(0, 8).map((company, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{company.company}</span>
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(company.count / (stats.users_by_company?.[0]?.count || 1)) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700">{company.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top States */}
                <div className="chart-container bg-white rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    <i className="fas fa-map-marker-alt mr-2 text-green-600"></i>
                    Top States by Properties
                  </h3>
                  <div className="space-y-3">
                    {stats.top_states?.slice(0, 8).map((state, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{state.state}</span>
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${(state.count / (stats.top_states?.[0]?.count || 1)) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700">{state.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mt-6 bg-white rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  <i className="fas fa-clock mr-2 text-purple-600"></i>
                  Properties by Month (Last 6 Months)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {stats.properties_by_month?.map((month, index) => (
                    <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{month.count}</div>
                      <div className="text-sm text-gray-600">{month.month}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="p-6">
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <select
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                  >
                    <option value="">All Companies</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.companycode}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={loadUsers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <i className="fas fa-search mr-2"></i>
                  Search
                </button>
              </div>

              {/* Users Table */}
              <div className="data-table bg-white rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          States/Counties
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Properties
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="table-row">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {user.companycode}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.states_counties?.length || 0} assigned
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {/* This would need to be calculated from seen_properties */}
                            N/A
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button className="action-button text-blue-600 hover:text-blue-900">
                                <i className="fas fa-eye"></i>
                              </button>
                              <button className="action-button text-green-600 hover:text-green-900">
                                <i className="fas fa-edit"></i>
                              </button>
                              {admin?.role === 'super_admin' && (
                                <button 
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="action-button text-red-600 hover:text-red-900"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                  <div className="bg-gray-50 px-6 py-3 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {((pagination.page - 1) * pagination.page_size) + 1} to {Math.min(pagination.page * pagination.page_size, pagination.total)} of {pagination.total} results
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={!pagination.has_prev}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 bg-red-600 text-white rounded">
                        {pagination.page}
                      </span>
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={!pagination.has_next}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Companies Tab */}
          {activeTab === 'companies' && (
            <div className="p-6">
              <div className="data-table bg-white rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company Code
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Users
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {companies.map((company) => (
                        <tr key={company.id} className="table-row">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {company.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {company.companycode}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {company.user_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button className="action-button text-blue-600 hover:text-blue-900">
                                <i className="fas fa-eye"></i>
                              </button>
                              <button className="action-button text-green-600 hover:text-green-900">
                                <i className="fas fa-edit"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* System Health Tab */}
          {activeTab === 'system' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">System Status</p>
                      <p className="text-lg font-bold text-green-600">
                        {systemHealth.status === 'healthy' ? 'Healthy' : 'Issues Detected'}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <i className={`fas fa-heartbeat text-2xl ${systemHealth.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}></i>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Database</p>
                      <p className="text-lg font-bold text-blue-600">
                        {systemHealth.database === 'connected' ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <i className={`fas fa-database text-2xl ${systemHealth.database === 'connected' ? 'text-blue-600' : 'text-red-600'}`}></i>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                      <p className="text-lg font-bold text-purple-600">
                        {systemHealth.recent_activity?.properties_last_24h || 0} properties
                      </p>
                      <p className="text-xs text-gray-500">Last 24 hours</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <i className="fas fa-chart-line text-2xl text-purple-600"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-white rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  <i className="fas fa-info-circle mr-2 text-blue-600"></i>
                  System Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Last Health Check</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(systemHealth.timestamp)}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Server Time</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date().toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
