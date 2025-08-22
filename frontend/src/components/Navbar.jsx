import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  
  // Check if we're on the landing page (root path)
  const isLandingPage = location.pathname === '/';

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center">
            <i className="fas fa-home text-red-600 text-xl mr-2" />
            <span className="text-xl font-bold text-red-600">RECT</span>
          </Link>

          {/* Desktop links - Only show on landing page */}
          {isLandingPage && (
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="nav-link text-gray-700 hover:text-red-600">
                Features
              </a>
              <a href="#about" className="nav-link text-gray-700 hover:text-red-600">
                About
              </a>
              <a href="#contact" className="nav-link text-gray-700 hover:text-red-600">
                Contact
              </a>
              {/* Admin link removed for security */}
            </div>
          )}

          {/* Mobile toggle */}
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            <i className="fas fa-bars text-gray-700" />
          </button>
        </div>

        {/* Mobile menu - Only show on landing page */}
        {isLandingPage && mobileOpen && (
          <div className="md:hidden pb-3">
            <a href="#features" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              Features
            </a>
            <a href="#about" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              About
            </a>
            <a href="#contact" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              Contact
            </a>
            {/* Admin link removed for security */}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
