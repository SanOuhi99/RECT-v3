import React from 'react';
import Navbar from '../components/Navbar';

const AgentDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Reuse your exact style block from landing page */}
      <style jsx>{`
        :root {
          --primary: #2c3e50;
          --secondary: #e74c3c;
          --accent: #3498db;
          --light: #ecf0f1;
          --dark: #2c3e50;
        }
        /* Include all other styles from RECTLandingPage.jsx */
      `}</style>

      <Navbar />

      <section className="py-20 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Your Client Dashboard
            </h2>
            <p className="text-xl text-gray-600">
              Track your protected commissions
            </p>
          </div>

          {/* Client alerts - using your card styles */}
          <div className="grid md:grid-cols-3 gap-8">
            {['Active Clients', 'At Risk', 'Closed With Others'].map((item) => (
              <div 
                key={item}
                className="feature-card bg-white rounded-2xl p-8 text-center border-t-4 border-red-600 shadow-lg"
              >
                <div className="text-5xl text-red-600 mb-6">
                  <i className="fas fa-user" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {item}
                </h3>
                <p className="text-gray-600 mb-8">12 clients</p>
                <button className="btn-primary-custom bg-red-600 text-white px-6 py-3 rounded-full">
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AgentDashboard;
