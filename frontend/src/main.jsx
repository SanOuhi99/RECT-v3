import React, { useState } from 'react';

const RECTLandingPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    console.log('Form submitted:', formData);
    // Handle form submission here
    alert('Thank you for your message! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
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

        .hero-section {
          background: linear-gradient(135deg, var(--primary), var(--dark));
          position: relative;
          overflow: hidden;
        }

        .hero-section::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80') no-repeat center center;
          background-size: cover;
          opacity: 0.15;
          z-index: 0;
        }

        .hero-content {
          position: relative;
          z-index: 1;
        }

        .feature-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .btn-primary-custom {
          background-color: var(--secondary);
          border: none;
          transition: all 0.3s ease;
        }

        .btn-primary-custom:hover {
          background-color: #c0392b;
          transform: translateY(-2px);
        }

        .btn-outline-custom {
          border: 2px solid var(--secondary);
          color: var(--secondary);
          transition: all 0.3s ease;
        }

        .btn-outline-custom:hover {
          background-color: var(--secondary);
          color: white;
        }

        .nav-link {
          transition: color 0.3s ease;
        }

        .nav-link:hover {
          color: var(--secondary) !important;
        }

        .story-image {
          border-radius: 15px;
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <i className="fas fa-home text-red-600 text-xl mr-2"></i>
              <span className="text-xl font-bold text-red-600">RECT</span>
            </div>
            
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="nav-link text-gray-700 hover:text-red-600 transition-colors">Features</a>
              <a href="#about" className="nav-link text-gray-700 hover:text-red-600 transition-colors">About Us</a>
              <a href="#contact" className="nav-link text-gray-700 hover:text-red-600 transition-colors">Contact</a>
              <a href="#admin" className="nav-link text-gray-700 hover:text-red-600 transition-colors">Admin</a>
            </div>

            {/* Mobile menu button */}
            <button className="md:hidden">
              <i className="fas fa-bars text-gray-700"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section text-white py-20">
        <div className="hero-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Protect Your Commissions
              </h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                RECT alerts you when your buyers close with another agent, ensuring you get the commission you've earned.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="#signup" 
                  className="btn-primary-custom bg-red-600 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-red-700 transition-all text-center"
                >
                  Get Started
                </a>
                <a 
                  href="#features" 
                  className="btn-outline-custom border-2 border-white text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-white hover:text-gray-800 transition-all text-center"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Account Type Cards */}
      <section id="signup" className="py-20 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Get Started with RECT</h2>
            <p className="text-xl text-gray-600">Choose your account type below</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Real Estate Agent */}
            <div className="feature-card bg-white rounded-2xl p-8 text-center border-t-4 border-red-600 shadow-lg">
              <div className="text-5xl text-red-600 mb-6">
                <i className="fas fa-user-tie"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Real Estate Agent</h3>
              <p className="text-gray-600 mb-8">
                Track your buyer clients and receive alerts if they close with another agent.
              </p>
              <div className="space-y-3">
                <a 
                  href="#agent-login" 
                  className="block bg-red-600 text-white py-3 px-6 rounded-full font-medium hover:bg-red-700 transition-colors"
                >
                  Agent Login
                </a>
                <a 
                  href="#agent-signup" 
                  className="block border-2 border-red-600 text-red-600 py-3 px-6 rounded-full font-medium hover:bg-red-600 hover:text-white transition-colors"
                >
                  Agent Sign Up
                </a>
              </div>
            </div>

            {/* Company */}
            <div className="feature-card bg-white rounded-2xl p-8 text-center border-t-4 border-red-600 shadow-lg">
              <div className="text-5xl text-red-600 mb-6">
                <i className="fas fa-building"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Brokerage / Company</h3>
              <p className="text-gray-600 mb-8">
                Register your company to provide access to your agents.
              </p>
              <div className="space-y-3">
                <a 
                  href="#company-register" 
                  className="block bg-red-600 text-white py-3 px-6 rounded-full font-medium hover:bg-red-700 transition-colors"
                >
                  Register Company
                </a>
              </div>
            </div>

            {/* Onboarding */}
            <div className="feature-card bg-white rounded-2xl p-8 text-center border-t-4 border-red-600 shadow-lg">
              <div className="text-5xl text-red-600 mb-6">
                <i className="fas fa-rocket"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Agent Onboarding</h3>
              <p className="text-gray-600 mb-8">
                New to RECT? Start the guided onboarding process.
              </p>
              <div className="space-y-3">
                <a 
                  href="#onboarding" 
                  className="block border-2 border-red-600 text-red-600 py-3 px-6 rounded-full font-medium hover:bg-red-600 hover:text-white transition-colors"
                >
                  Start Onboarding
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How RECT Protects You</h2>
            <p className="text-xl text-gray-600">Key features that safeguard your commissions</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-5xl text-blue-600 mb-6">
                <i className="fas fa-bell"></i>
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">Instant Alerts</h4>
              <p className="text-gray-600 text-lg">
                Get notified immediately when one of your buyers closes with another agent.
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-5xl text-blue-600 mb-6">
                <i className="fas fa-chart-line"></i>
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">Performance Insights</h4>
              <p className="text-gray-600 text-lg">
                Identify where client relationships break down to improve your outreach.
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-5xl text-blue-600 mb-6">
                <i className="fas fa-shield-alt"></i>
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">Commission Protection</h4>
              <p className="text-gray-600 text-lg">
                Documentation to support your claim for owed commissions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Story */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src="https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="Couple working" 
                className="story-image w-full h-auto"
              />
            </div>
            
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Our Story</h2>
              <div className="space-y-6 text-gray-700 text-lg leading-relaxed">
                <p>
                  One summer evening in 2024, my fiancée and I were sitting on the couch when we heard the news of the National Association of Realtors and all its changes. With her being a top-performing real estate agent and me being a real-estate investor, we knew big things were coming—both good and bad!
                </p>
                <p>
                  The buyer-agency agreement rule particularly stood out. We knew agents needed a way to protect their hard-earned commissions when buyers went behind their backs. That's when <strong className="text-red-600">RECT</strong> was born.
                </p>
                <p>
                  After six months working with data scientists, developers, and automation engineers, we created an easy-to-use, secure, accurate, and seamless software to alert real-estate agents if one of their buyers closes on a house with another agent.
                </p>
                <p>
                  One additional benefit: this helps you fine-tune your promotion. If you lose a client—either recently or years ago—you can see where the communication fell off and improve your outreach.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-xl text-gray-600">Have questions? We're here to help.</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Your Name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Your Email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                />
              </div>
              
              <div className="mb-6">
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder="Subject"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                />
              </div>
              
              <div className="mb-8">
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows="5"
                  placeholder="Your Message"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none resize-none"
                ></textarea>
              </div>
              
              <div className="text-center">
                <button
                  onClick={handleSubmit}
                  className="bg-red-600 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center mb-4">
                <i className="fas fa-home text-red-600 text-xl mr-2"></i>
                <h5 className="text-xl font-bold">RECT</h5>
              </div>
              <p className="text-gray-400 text-lg">
                Protecting real-estate agents' commissions since 2024.
              </p>
            </div>
            
            <div>
              <h5 className="text-lg font-bold mb-4">Quick Links</h5>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#about" className="text-gray-400 hover:text-white transition-colors">Our Story</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="text-lg font-bold mb-4">Legal</h5>
              <ul className="space-y-2">
                <li><a href="#privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#terms" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <hr className="border-gray-800 my-8" />
          
          <div className="text-center">
            <p className="text-gray-400">
              &copy; 2024 RECT - Real Estate Client Tracker. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Font Awesome CDN */}
      <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
      />
    </div>
  );
};

export default RECTLandingPage;
