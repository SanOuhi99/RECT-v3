import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useCompanyAuth } from '../contexts/CompanyAuthContext';
import Navbar from '../components/Navbar';

const CompanyLogin = () => {
  const [credentials, setCredentials] = useState({
    companycode: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useCompanyAuth();

  // Get the intended destination or default to company dashboard
  const from = location.state?.from?.pathname || '/company-dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  // Load remembered company code on component mount
  useEffect(() => {
    const rememberedCompanyCode = localStorage.getItem('rememberedCompanyCode');
    if (rememberedCompanyCode) {
      setCredentials(prev => ({ ...prev, companycode: rememberedCompanyCode }));
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!credentials.companycode.trim() || !credentials.password.trim()) {
      setError('Please enter both company code and password');
      setLoading(false);
      return;
    }

    try {
      const result = await login(credentials.companycode.trim(), credentials.password);
      
      if (result.success) {
        // Handle remember me functionality
        if (rememberMe) {
          localStorage.setItem('rememberedCompanyCode', credentials.companycode.trim());
        } else {
          localStorage.removeItem('rememberedCompanyCode');
        }

        // Clear form
        setCredentials({ companycode: '', password: '' });
        
        // Navigation will happen automatically via useEffect when isAuthenticated changes
      } else {
        setError(result.error || 'Invalid company code or password. Please try again.');
      }
    } catch (error) {
      console.error('Company login error:', error);
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
        .login-container {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          min-height: calc(100vh - 80px);
        }
        
        .login-card {
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
        }
        
        .input-field {
          transition: all 0.3s ease;
          border: 2px solid #e2e8f0;
        }
        
        .input-field:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
          transform: translateY(-2px);
        }
        
        .login-button {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
        }
        
        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(79, 70, 229, 0.5);
        }
        
        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .feature-icon {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <Navbar />

      <div className="login-container flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="login-card rounded-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-building text-blue-600 text-2xl"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Company Portal
              </h2>
              <p className="text-gray-600">
                Sign in to access your company dashboard
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                <div className="flex items-center">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="companycode" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Code
                </label>
                <input
                  id="companycode"
                  type="text"
                  className="input-field w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Enter your company code"
                  value={credentials.companycode}
                  onChange={(e) => setCredentials({...credentials, companycode: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input-field w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember my company code
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="login-button w-full py-3 px-4 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Signing you in...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <i className="fas fa-sign-in-alt mr-2"></i>
                    Sign In
                  </div>
                )}
              </button>
            </form>

            {/* Features */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">Company portal features:</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="feature-icon fas fa-users text-lg mr-3"></i>
                    <span>Agent management</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="feature-icon fas fa-chart-bar text-lg mr-3"></i>
                    <span>Performance analytics</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="feature-icon fas fa-cog text-lg mr-3"></i>
                    <span>Company settings</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have a company account?{' '}
                <Link to="/company-register" className="text-blue-600 hover:text-blue-700 font-medium">
                  Register your company
                </Link>
              </p>
            </div>

            {/* Support */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Need help? Contact{' '}
                <a href="mailto:support@rectracker.com" className="text-blue-600 hover:text-blue-700">
                  support@rectracker.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyLogin;
