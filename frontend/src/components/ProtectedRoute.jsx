// frontend/src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user, fetchUserData } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const verifySession = async () => {
      if (isAuthenticated && user) {
        try {
          // Verify the session is still valid
          await fetchUserData();
        } catch (error) {
          console.error('Session verification failed:', error);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Verifying session...</p>
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
