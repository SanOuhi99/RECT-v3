import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCompanyAuth } from '../contexts/CompanyAuthContext';

const ProtectedCompanyRoute = ({ children }) => {
  const { isAuthenticated, loading, company, fetchCompanyData } = useCompanyAuth();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const verifyCompanySession = async () => {
      if (isAuthenticated && company) {
        try {
          // Verify the company session is still valid
          await fetchCompanyData();
          setError(null);
        } catch (error) {
          console.error('Company session verification failed:', error);
          setError('Company session verification failed');
        }
      }
      setVerifying(false);
    };

    if (!loading) {
      verifyCompanySession();
    }
  }, [isAuthenticated, company, fetchCompanyData, loading]);

  // Show loading spinner while checking authentication
  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-1/2 transform -translate-x-1/2"></div>
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900">
              <i className="fas fa-building mr-2 text-blue-600"></i>
              {loading ? 'Initializing company access...' : 'Verifying company session...'}
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Please wait while we verify your company credentials
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
            Company Session Error
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            There was a problem verifying your company session. Please try logging in again.
          </p>
          <button
            onClick={() => window.location.href = '/company-login'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-sign-in-alt mr-2"></i>
            Go to Company Login
          </button>
        </div>
      </div>
    );
  }

  // Redirect to company login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/company-login" state={{ from: location }} replace />;
  }

  // Render the protected company component
  return children;
};

export default ProtectedCompanyRoute;
