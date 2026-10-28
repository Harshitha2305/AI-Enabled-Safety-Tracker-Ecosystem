
import { useState } from "react";
import "./Login.css";

function Login({ onLogin, onShowRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/accounts/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.detail || "Invalid username or password."
        );
      }

      if (!data.token) {
        throw new Error("Login succeeded, but no authentication token was returned.");
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("username", data.username || username);
      localStorage.setItem("role", data.role || "user");
      localStorage.setItem(
        "volunteerStatus",
        data.volunteer_status || "not_applicable"
      );

      onLogin(data);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="brand">
          <div className="brand-icon">✳</div>
          <span>SAFEGUARD<span className="brand-dot">.</span></span>
        </div>

        <div className="visual-content">
          <span className="eyebrow">
            <span className="live-dot" /> INTELLIGENT SAFETY SYSTEM
          </span>

          <h1>
            Your safety.
            <br />
            <span>Always in focus.</span>
          </h1>

          <p>
            Real-time monitoring, intelligent fall detection, and
            emergency response in one connected safety platform.
          </p>

          <div className="visual-panel">
            <div className="visual-panel-top">
              <span>SAFETY MONITOR</span>
              <span className="monitor-status">
                <span className="live-dot" /> READY
              </span>
            </div>

            <div className="pulse-graphic">
              <div className="pulse-ring pulse-ring-one" />
              <div className="pulse-ring pulse-ring-two" />
              <div className="pulse-center">✚</div>
            </div>

            <div className="visual-panel-bottom">
              <div>
                <strong>AI-powered</strong>
                <span>Safety monitoring</span>
              </div>
              <div>
                <strong>24 / 7</strong>
                <span>Designed for protection</span>
              </div>
            </div>
          </div>
        </div>

        <p className="visual-footer">
          AI SAFETY TRACKER <span>•</span> PROTECTING WHAT MATTERS
        </p>
      </section>

      <section className="login-side">
        <div className="mobile-brand">
          <div className="brand-icon">✳</div>
          <span>SAFEGUARD<span className="brand-dot">.</span></span>
        </div>

        <div className="login-form-wrap">
          <div className="welcome-icon">↗</div>
          <p className="form-kicker">WELCOME BACK</p>
          <h2>Sign in to your account</h2>
          <p className="form-subtitle">
            Enter your credentials to access your safety dashboard.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />

            <div className="password-label-row">
              <label htmlFor="password">Password</label>
            </div>

            <div className="password-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <span>!</span> {error}
              </div>
            )}

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in securely"}
              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="security-note">
            <span>♢</span>
            Your account is protected by secure authentication.
          </div>

          {onShowRegister && (
            <p className="register-prompt">
              New to SafeGuard?
              <button type="button" onClick={onShowRegister}>
                Create an account
              </button>
            </p>
          )}
        </div>

        <p className="login-legal">
          AI Safety Tracker <span>•</span> Safety through technology
        </p>
      </section>
    </div>
  );
}

export default Login;
