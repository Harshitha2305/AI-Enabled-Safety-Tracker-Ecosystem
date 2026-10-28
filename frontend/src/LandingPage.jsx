
import "./LandingPage.css";

export default function LandingPage({ onGetStarted }) {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <a href="#home" className="landing-brand">
          <span className="landing-logo">✳</span>
          <span className="landing-brand-text">
            <strong>SAFEGUARD<span>.</span></strong>
            <small>INTELLIGENT SAFETY SYSTEM</small>
          </span>
        </a>

        <nav className="landing-nav">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#features">Contact</a>
          <button onClick={onGetStarted} className="landing-nav-cta">
            Get Started <span>→</span>
          </button>
        </nav>
      </header>

      <main id="home">
        <section className="landing-hero" id="about">
          <div className="landing-copy">
            <div className="landing-eyebrow">
              <span /> INTELLIGENT SAFETY SYSTEM
            </div>

            <h1>
              Your safety.
              <br />
              <span>Always in focus.</span>
            </h1>

            <p className="landing-description">
              Real-time monitoring, intelligent fall detection, and
              emergency response in one connected safety platform.
            </p>

            <div className="landing-actions">
              <button onClick={onGetStarted} className="landing-primary">
                Get Started <span>→</span>
              </button>
              <a href="#features" className="landing-secondary">
                Learn More
              </a>
            </div>

            <div className="safety-monitor">
              <div className="monitor-heading">
                <span>SAFETY MONITOR</span>
                <span className="monitor-ready">
                  <i /> READY
                </span>
              </div>

              <div className="monitor-center">
                <div className="monitor-ring">
                  <div className="monitor-plus">✚</div>
                </div>
              </div>

              <div className="monitor-footer">
                <div>
                  <strong>AI-powered</strong>
                  <span>Continuous monitoring</span>
                </div>
                <div>
                  <strong>24 / 7</strong>
                  <span>Designed for protection</span>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-visual" aria-label="Safety system illustration">
            <div className="radar radar-one" />
            <div className="radar radar-two" />
            <div className="radar radar-three" />
            <div className="radar radar-four" />

            <div className="shield-core">
              <div className="shield-shape">
                <span>✚</span>
              </div>
            </div>

            <div className="feature-node node-fall">
              <span className="node-icon">⌁</span>
              <span>Fall<br />Detection</span>
            </div>

            <div className="feature-node node-emergency">
              <span className="node-icon">♧</span>
              <span>Emergency<br />Response</span>
            </div>

            <div className="feature-node node-location">
              <span className="node-icon">⌖</span>
              <span>Real-time<br />Tracking</span>
            </div>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <span>BUILT FOR YOUR SAFETY</span>
            <h2>Protection that stays connected.</h2>
            <p>
              One platform for monitoring, emergency alerts, and
              connected safety devices.
            </p>
          </div>

          <div className="landing-feature-grid">
            <article className="landing-feature-card">
              <div className="feature-card-icon">⌁</div>
              <h3>Fall Detection</h3>
              <p>
                Monitor movement readings and identify potential fall
                events from connected sensor data.
              </p>
            </article>

            <article className="landing-feature-card">
              <div className="feature-card-icon">♧</div>
              <h3>Emergency SOS</h3>
              <p>
                Raise an emergency alert so it can be viewed in the
                safety response system.
              </p>
            </article>

            <article className="landing-feature-card">
              <div className="feature-card-icon">⌖</div>
              <h3>Connected Safety</h3>
              <p>
                View available location information and monitor
                connected safety device readings.
              </p>
            </article>
          </div>
        </section>
      </main>

      
<footer className="landing-footer">
  <span>SAFEGUARD<span className="footer-dot">.</span></span>
  <span>Intelligent Safety System · Project Prototype</span>
  <span>
    © {new Date().getFullYear()} SAFEGUARD. All rights reserved.
  </span>
</footer>

    </div>
  );
}
