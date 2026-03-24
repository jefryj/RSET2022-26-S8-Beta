
import React from 'react';
import './LandingPage.css';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const handleStart = (e: React.MouseEvent) => {
    e.preventDefault();
    onStart();
  };

  return (
    <div className="landing-page-wrapper">

      <header>
        <div className="container nav" role="navigation" aria-label="Primary">
          <div className="brand">
            <span style={{ fontSize: '1.5rem', marginRight: '8px' }}>🕶️</span>
            VTO
          </div>
          <nav className="nav-links">
            <a className="nav-link" href="#features">Features</a>
            <a className="nav-link" href="#about">About</a>
            <a className="nav-link" href="#contact">Contact</a>
            <a className="btn-nav" href="#pre-features">Get Started</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <h1 className="hero-title">Try On Accessories Virtually With Us!</h1>
            <h2>Mix, Match, and Make It Yours!!</h2>
          </div>
        </section>

        {/* What we do section */}
        <section className="cta">
          <div className="container cta-flex">
            <div className="cta-text">
              <h2>What we do?</h2>
              <p>
                VTO lets you explore accessories in real time — virtually. 
                Try on multiple pieces, discover your unique style, 
                and get smart recommendations tailored to your taste. 
                No downloads. No guesswork. Just you and your vibe.
              </p>
            </div>
            <div className="cta-image">
              <img 
                src="1.png" 
                alt="Virtual try-on illustration" 
              />
            </div>
          </div>
        </section>

        {/* Get Started Section */}
        <section id="pre-features">
          <div className="container">
            <h2>Ready to see yourself in a new light?</h2>
            <p>Start your virtual try-on now. It’s fast, fun, and free.</p>
            <a href="#" onClick={handleStart} className="btn-nav">Get Started</a>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="features">
          <div className="container">
            <div className="features-heading">
              <h2>Features</h2>
            </div>
            <div className="features-grid">
              <div className="feature">
                <h3>Accessory Fusion</h3>
                <p>Try multiple accessories at once — earrings, glasses, hats, all in one view.</p>
              </div>
              <div className="feature">
                <h3>Smart Suggestions</h3>
                <p>Get personalized accessory picks based on your preferences and try-on history.</p>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" style={{ padding: '60px 20px', textAlign: 'left' }}>
          <div className="container">
            <div className="about-heading">
              <h2>About Us!</h2>
              <p style={{ width: '100%', color: 'var(--text-dim)', fontSize: '1.05rem' }}>
                We at VTO aim to bring fashion and tech together seamlessly.
                Our virtual try-on tool helps you visualize accessories before purchase — saving time, money, and the planet from unnecessary returns.
              </p>
            </div>
            <div className="about-grid">
              <div className="person" style={{ textAlign: 'left' }}>
                <h3>Devanjana S.Puthalath</h3>
                <p>Frontend Developer</p>
              </div>
              <div className="person" style={{ textAlign: 'left' }}>
                <h3>Dominic Linson</h3>
                <p>Backend Developer</p>
              </div>
              <div className="person" style={{ textAlign: 'left' }}>
                <h3>Eesha Ajith</h3>
                <p>Frontend Developer</p>
              </div>
              <div className="person" style={{ textAlign: 'left' }}>
                <h3>Gourinanda A.G</h3>
                <p>Backend Developer</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" style={{ padding: '60px 20px', textAlign: 'left' }}>
          <div className="container">
            <h2>Contact Us</h2>
            <p style={{ maxWidth: '700px', color: 'var(--text-dim)' }}>
              Have feedback or want to collaborate? Reach us at 
              {' '}<strong>support@vtoapp.com</strong>.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          VTO © <span>{new Date().getFullYear()}</span> All rights reserved.
        </div>
      </footer>
    </div>
  );
};
