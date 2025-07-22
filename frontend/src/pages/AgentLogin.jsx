import React, { useState } from 'react';
import Navbar from '../components/Navbar';

const AgentLogin = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add your login logic here
    console.log('Login submitted:', credentials);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Reuse your exact style block from landing page */}
      <style jsx>{`
        /* Paste all styles from RECTLandingPage.jsx here */
      `}</style>

      <Navbar />

      <section className="py-20 scroll-mt-20">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              Agent Login
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  value={credentials.email}
                  onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                  required
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
                />
              </div>
              <button
                type="submit"
                className="btn-primary-custom w-full bg-red-600 text-white px-6 py-3 rounded-full text-lg font-medium hover:bg-red-700"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AgentLogin;
