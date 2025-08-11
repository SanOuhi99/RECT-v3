// frontend/src/pages/AdminLogin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import Navbar from '../components/Navbar';

const AdminLogin = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAdminAuth();

  // Get the intended destination or default to admin dashboard
  const from = location.state?.from?.pathname || '/admin/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      const result = await login(credentials.username.trim(), credentials.password);
      
      if (result.success) {
        setCredentials({ username: '', password: '' });
        // Navigation will happen automatically via useEffect
      } else {
        setError(result.error || 'Invalid credentials. Please try again.');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setError('Login failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        .admin-login-container {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          min-height: calc(100vh - 80px);
        }
        
        .admin-login-card {
          backdrop-filter: blur(15px);
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }
        
        .admin-input {
          transition: all 0.3s ease;
          border: 2px solid #e2e8f0;
        }
        
        .admin-input:focus {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
          transform: translateY(-2px);
        }
        
        .admin-button {
          background: linear-gradient(135deg, #dc2626, #991b1b);
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
        }
        
        .admin-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(220, 38, 38, 0.5);
        }
        
        .admin-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .security-badge {
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .admin-icon {
          background: linear-gradient(135deg, #dc2626, #991b1b);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <Navbar />

      <div className="admin-login-container flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="admin-login-card rounded-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto h-20 w-20 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <i className="fas fa-shield-alt text-white text-3xl"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Admin Portal
              </h2>
              <p className="text-gray-600">
                Secure access to system administration
              </p>
              <div className="flex items-center justify-center mt-3">
                <i className="fas fa-lock text-yellow-500 mr-2"></i>
                <span className="security-badge text-sm font-semibold">
                  SECURED ACCESS
                </span>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 animate-pulse">
                <div className="flex items-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-user mr-2 admin-icon"></i>
                  Administrator Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  className="admin-input w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Enter admin username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-key mr-2 admin-icon"></i>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="admin-input w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Enter admin password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="admin-button w-full py-3 px-4 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Authenticating...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <i className="fas fa-sign-in-alt mr-2"></i>
                    Access Admin Panel
                  </div>
                )}
              </button>
            </form>

            {/* Security Features */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">Security Features:</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="fas fa-lock text-green-600 text-lg mr-3"></i>
                    <span>Encrypted Authentication</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="fas fa-history text-blue-600 text-lg mr-3"></i>
                    <span>Session Monitoring</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="fas fa-shield-alt text-purple-600 text-lg mr-3"></i>
                    <span>Role-Based Access</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Support */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                System Administrator Access Only
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Unauthorized access attempts are logged and monitored
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
