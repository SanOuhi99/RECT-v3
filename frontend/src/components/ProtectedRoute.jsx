// Production-Ready ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user, fetchUserData } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const verifySession = async () => {
      if (isAuthenticated && user) {
        try {
          // Verify the session is still valid by fetching fresh user data
          await fetchUserData();
          setError(null);
        } catch (error) {
          console.error('Session verification failed:', error);
          setError('Session verification failed');
          // Auth context will handle logout if token is invalid
        }
      }
      setVerifying(false);
    };

    if (!loading) {
      verifySession();
    }
  }, [isAuthenticated, user, fetchUserData, loading]);

  // Show loading spinner while checking authentication
  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-600 border-t-transparent absolute top-0 left-1/2 transform -translate-x-1/2"></div>
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900">
              {loading ? 'Initializing...' : 'Verifying session...'}
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Please wait while we secure your connection
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if verification failed
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-red-100 rounded-full p-4 w-16 h-16 mx-auto mb-6">
            <i className="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Session Error
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            There was a problem verifying your session. Please try logging in again.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render the protected component
  return children;
};

export default ProtectedRoute;
