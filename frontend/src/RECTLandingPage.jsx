import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const RECTLandingPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert('Thank you for your message! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* CSS Variables & Styles (keep your existing styles) */}
      <style jsx>{`
        /* Your existing styles remain unchanged */
      `}</style>

      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/" className="flex items-center">
              <i className="fas fa-home text-red-600 text-xl mr-2" />
              <span className="text-xl font-bold text-red-600">RECT</span>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex space-x-8">
              {['features', 'about', 'contact', 'admin'].map((id) => (
                <Link 
                  key={id} 
                  to={`#${id}`}
                  className="nav-link text-gray-700"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </Link>
              ))}
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
            >
              <i className="fas fa-bars text-gray-700" />
            </button>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden pb-3">
              {['features', 'about', 'contact', 'admin'].map((id) => (
                <Link
                  key={id}
                  to={`#${id}`}
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                    setMobileOpen(false);
                  }}
                >
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="hero-section text-white py-20 scroll-mt-20">
        {/* ... (keep your existing hero content) ... */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="#signup"
            className="btn-primary-custom bg-red-600 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-red-700 transition-all text-center"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Get Started
          </Link>
          <Link
            to="#features"
            className="btn-outline-custom border-2 border-white text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-white hover:text-gray-800 transition-all text-center"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Account Type Cards */}
      <section id="signup" className="py-20 bg-gray-100 scroll-mt-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: 'fas fa-user-tie',
              title: 'Real Estate Agent',
              desc: 'Track your buyer clients and receive alerts if they close with another agent.',
              actions: [
                { 
                  label: 'Agent Login', 
                  element: <Link to="/agent-login" className="block py-3 px-6 rounded-full font-medium bg-red-600 text-white hover:bg-red-700 text-center">Agent Login</Link>
                },
                { 
                  label: 'Agent Sign Up', 
                  element: <Link to="/agent-signup" className="block py-3 px-6 rounded-full font-medium border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white text-center">Sign Up</Link>
                }
              ],
            },
            // ... other cards
          ].map((card) => (
            <div key={card.title} className="feature-card bg-white rounded-2xl p-8 text-center border-t-4 border-red-600 shadow-lg">
              {/* ... card content ... */}
              <div className="space-y-3">
                {card.actions.map((action, index) => (
                  action.element || (
                    <Link
                      key={index}
                      to={action.to || action.href}
                      className={`block py-3 px-6 rounded-full font-medium text-center ${
                        action.outline
                          ? 'border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {action.label}
                    </Link>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ... rest of your sections (Features, About, Contact, Footer) ... */}
    </div>
  );
};

export default RECTLandingPage;
