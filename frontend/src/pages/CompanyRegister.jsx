import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const CompanyRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    companycode: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  // API base URL
  const API_URL = process.env.REACT_APP_API_URL || 'https://backend-rectenvironment.up.railway.app';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.name.trim() || !formData.companycode.trim() || !formData.password.trim()) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (formData.companycode.length < 3) {
      setError('Company code must be at least 3 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          companycode: formData.companycode.trim(),
          password: formData.password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const data = await response.json();
      setSuccess(true);
      
      // Clear form
      setFormData({
        name: '',
        companycode: '',
        password: '',
        confirmPassword: ''
      });

      // Redirect to company login after 2 seconds
      setTimeout(() => {
        navigate('/company-login');
      }, 2000);

    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
              <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-check text-green-600 text-2xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Registration Successful!
              </h2>
              <p className="text-gray-600 mb-4">
                Your company has been registered successfully.
              </p>
              <p className="text-sm text-gray-500">
                Redirecting to company login...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        .register-container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: calc(100vh - 80px);
        }
        
        .register-card {
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
          border-color: #e53e3e;
          box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1);
          transform: translateY(-2px);
        }
        
        .register-button {
          background: linear-gradient(135deg, #e53e3e, #c53030);
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(229, 62, 62, 0.4);
        }
        
        .register-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(229, 62, 62, 0.5);
        }
        
        .register-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .feature-icon {
          background: linear-gradient(135deg, #667eea, #764ba2);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <Navbar />

      <div className="register-container flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="register-card rounded-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-building text-blue-600 text-2xl"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Company Registration
              </h2>
              <p className="text-gray-600">
                Register your company to provide access to your agents
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

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="input-field w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Enter your company name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="companycode" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Code *
                </label>
                <input
                  id="companycode"
                  name="companycode"
                  type="text"
                  className="input-field w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Create a unique company code"
                  value={formData.companycode}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  minLength="3"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be used by your agents to register. Make it unique and memorable.
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="input-field w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  minLength="6"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className="input-field w-full px-4 py-3 border rounded-lg focus:outline-none"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  minLength="6"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="register-button w-full py-3 px-4 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Registering Company...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <i className="fas fa-building mr-2"></i>
                    Register Company
                  </div>
                )}
              </button>
            </form>

            {/* Features */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">What you'll get:</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="feature-icon fas fa-users text-lg mr-3"></i>
                    <span>Agent management system</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="feature-icon fas fa-chart-line text-lg mr-3"></i>
                    <span>Company-wide analytics</span>
                  </div>
                  <div className="flex items-center justify-center text-gray-700">
                    <i className="feature-icon fas fa-shield-alt text-lg mr-3"></i>
                    <span>Secure company portal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have a company account?{' '}
                <Link to="/company-login" className="text-red-600 hover:text-red-700 font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyRegister;
