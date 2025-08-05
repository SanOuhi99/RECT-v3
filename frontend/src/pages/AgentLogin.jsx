// Enhanced AgentLogin.jsx with debugging
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const AgentLogin = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDebugInfo('');

    console.log('=== LOGIN DEBUG START ===');
    console.log('Form submitted with credentials:', {
      email: credentials.email,
      password: credentials.password ? '[PROVIDED]' : '[EMPTY]'
    });

    try {
      // Add debug info about the API URL
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      console.log('API URL being used:', API_URL);
      setDebugInfo(`Attempting login to: ${API_URL}/login`);

      // Test basic connectivity first
      try {
        const healthCheck = await fetch(`${API_URL}/health`);
        console.log('Health check response:', healthCheck.status);
        if (!healthCheck.ok) {
          throw new Error(`Health check failed: ${healthCheck.status}`);
        }
      } catch (healthError) {
        console.error('Health check failed:', healthError);
        setError(`Cannot connect to server: ${healthError.message}`);
        setLoading(false);
        return;
      }

      // Attempt login
      console.log('Calling login function...');
      const result = await login(credentials.email, credentials.password);
      console.log('Login result:', result);
      
      if (result.success) {
        console.log('Login successful, navigating to dashboard');
        navigate('/dashboard');
      } else {
        console.log('Login failed:', result.error);
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error caught:', error);
      setError(`Login error: ${error.message}`);
    } finally {
      setLoading(false);
      console.log('=== LOGIN DEBUG END ===');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        :root {
          --primary: #2c3e50;
          --secondary: #e74c3c;
          --accent: #3498db;
          --light: #ecf0f1;
          --dark: #2c3e50;
        }
        
        .btn-primary-custom {
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          border: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
        }
        
        .btn-primary-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        }
        
        .btn-primary-custom:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .error-message {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        .debug-info {
          background: #e3f2fd;
          border: 1px solid #90caf9;
          color: #1565c0;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-family: monospace;
          font-size: 12px;
        }
        
        .spinner {
          border: 2px solid #f3f3f3;
          border-top: 2px solid #e74c3c;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
          display: inline-block;
          margin-right: 8px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <Navbar />

      <section className="py-20 scroll-mt-20">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              Agent Login
            </h2>
            
            {/* Debug Information */}
            {debugInfo && (
              <div className="debug-info">
                <strong>Debug Info:</strong><br />
                {debugInfo}
              </div>
            )}
            
            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {/* Test Credentials for Development */}
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4 text-sm">
              <strong>For Testing:</strong><br />
              Current API URL: {process.env.REACT_APP_API_URL || 'http://localhost:8000'}<br />
              Make sure you have a valid user account created first.
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  value={credentials.email}
                  onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                  required
                  disabled={loading}
                  placeholder="Enter your email"
                />
              </div>
              <div className="mb-8">
                <label className="block text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  required
                  disabled={loading}
                  placeholder="Enter your password"
                />
              </div>
              <button
                type="submit"
                className="btn-primary-custom w-full bg-red-600 text-white px-6 py-3 rounded-full text-lg font-medium hover:bg-red-700"
                disabled={loading}
              >
                {loading && <span className="spinner"></span>}
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Debug Section - Remove in production */}
            <div className="mt-6 p-4 bg-gray-50 rounded text-xs">
              <strong>Debug Info:</strong><br />
              Email: {credentials.email || '(empty)'}<br />
              Password: {credentials.password ? '(provided)' : '(empty)'}<br />
              Loading: {loading ? 'true' : 'false'}<br />
              Is Authenticated: {isAuthenticated ? 'true' : 'false'}<br />
              Environment: {process.env.NODE_ENV || 'development'}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AgentLogin;
