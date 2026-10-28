import { useCallback, useEffect, useState } from "react";
import "./ParentDashboard.css";
import Profile from "./Profile";
function ParentDashboard({ currentUser, onLogout }) {
  const [children, setChildren] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [enteredCode, setEnteredCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showProfile, setShowProfile] = useState(false);
  const token = localStorage.getItem("authToken");

  const request = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.detail ||
            data.message ||
            "Request failed. Please try again."
        );
      }

      return data;
    },
    [token]
  );

  const loadDashboard = useCallback(
    async (showErrors = false) => {
      try {
        const [childrenData, emergencyData] = await Promise.all([
          request("/api/accounts/children/"),
          request("/api/alerts/parent/emergencies/"),
        ]);

        setChildren(Array.isArray(childrenData) ? childrenData : []);
        setEmergencies(Array.isArray(emergencyData) ? emergencyData : []);

        try {
          const notificationData = await request(
            "/api/alerts/notifications/"
          );

          setNotifications(
            Array.isArray(notificationData) ? notificationData : []
          );
        } catch (error) {
          console.error("Could not load notifications:", error.message);
          setNotifications([]);
        }
      } catch (error) {
        if (showErrors) {
          setMessage(error.message);
          setMessageType("error");
        }
      }
    },
    [request]
  );

  useEffect(() => {
    loadDashboard(true);

    const interval = setInterval(() => {
      loadDashboard(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const linkChild = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await request("/api/accounts/link-child/", {
        method: "POST",
        body: JSON.stringify({
          pairing_code: enteredCode.trim(),
        }),
      });

      setEnteredCode("");
      setMessage("Child account linked successfully.");
      setMessageType("success");
      await loadDashboard(true);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeNotification = async (notificationId) => {
    setAcknowledgingId(notificationId);
    setMessage("");

    try {
      await request(
        `/api/alerts/notifications/${notificationId}/acknowledge/`,
        { method: "POST" }
      );

      setMessage("Emergency acknowledged successfully.");
      setMessageType("success");

      await loadDashboard(false);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setAcknowledgingId(null);
    }
  };

  const activeEmergencies = emergencies.filter(
    (emergency) =>
      !["resolved", "closed", "cancelled"].includes(
        emergency.status?.toLowerCase()
      )
  );
  const scrollToSection = (section) => {
  setActiveSection(section);

  if (section === "profile") {
    setShowProfile(true);
    return;
  }

  setShowProfile(false);

  const element = document.getElementById(`parent-${section}`);
  element?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};
  const navItems = [
    { id: "dashboard", icon: "⌂", label: "Dashboard" },
    { id: "children", icon: "♧", label: "Linked Children" },
    { id: "alerts", icon: "♢", label: "Emergency Alerts" },
    { id: "contacts", icon: "☎", label: "Emergency Contacts" },
    { id: "settings", icon: "⚙", label: "Account Settings" },
    { id: "profile", icon: "♙", label: "My Profile" },
  ];
  if (showProfile) {
  return (
    <Profile
      onBack={() => {
        setShowProfile(false);
        setActiveSection("dashboard");
      }}
    />
  );
}
  return (
    <div className="parent-app">
      <aside className="parent-sidebar">
        <div className="parent-brand">
          <div className="parent-brand-icon">✳</div>
          <div>
            <strong>
              SAFEGUARD<span>.</span>
            </strong>
            <small>Parent Account</small>
          </div>
        </div>

        <div className="parent-nav-label">WORKSPACE</div>

        <nav className="parent-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`parent-nav-item ${
                activeSection === item.id ? "active" : ""
              }`}
              onClick={() => scrollToSection(item.id)}
            >
              <span className="parent-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <button className="parent-logout" onClick={onLogout}>
          <span className="parent-nav-icon">↪</span>
          Log out
        </button>
      </aside>

      <div className="parent-workspace">
        <header className="parent-topbar">
          <span className="parent-topbar-label">Safety Monitoring</span>
          <div className="parent-user">
            <span>
              Welcome, <strong>{currentUser.username}</strong>
            </span>
            <div className="parent-avatar">
              {(currentUser.username || "P").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="parent-main" id="parent-dashboard">
          <section className="parent-page-heading">
            <div>
              <span className="parent-eyebrow">OVERVIEW</span>
              <h1>Dashboard</h1>
              <p>
                Monitor linked children, review emergency alerts, and
                manage safety information.
              </p>
            </div>
            <div className="parent-live-indicator">
              <span /> Live updates
            </div>
          </section>

          {message && (
            <div
              className={`parent-message ${messageType}`}
              role="status"
            >
              {message}
              <button
                className="parent-message-close"
                onClick={() => setMessage("")}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          <section className="parent-stat-grid">
            <article className="parent-stat-card">
              <div className="parent-stat-icon blue">♧</div>
              <div>
                <span>Linked Children</span>
                <strong>{children.length}</strong>
                <small>Connected accounts</small>
              </div>
            </article>

            <article className="parent-stat-card">
              <div className="parent-stat-icon red">♢</div>
              <div>
                <span>Active Alerts</span>
                <strong>{activeEmergencies.length}</strong>
                <small>Unresolved alerts</small>
              </div>
            </article>

            <article className="parent-stat-card">
              <div className="parent-stat-icon teal">⌖</div>
              <div>
                <span>Locations Available</span>
                <strong>
                  {
                    new Set(
                      activeEmergencies
                        .filter(
                          (item) =>
                            item.latitude != null &&
                            item.longitude != null
                        )
                        .map((item) => item.child_username)
                    ).size
                  }
                </strong>
                <small>Children with alert coordinates</small>
              </div>
            </article>

            <article className="parent-stat-card">
              <div className="parent-stat-icon violet">✓</div>
              <div>
                <span>Account Status</span>
                <strong className="parent-stat-status">Connected</strong>
                <small>Parent account</small>
              </div>
            </article>
          </section>

          <div className="parent-content-grid">
            <div className="parent-content-column">
              <section
                className="parent-panel"
                id="parent-children"
              >
                <div className="parent-panel-heading">
                  <div>
                    <h2>Linked Children</h2>
                    <p>Accounts connected to your profile</p>
                  </div>
                  <span className="parent-count-pill">
                    {children.length}
                  </span>
                </div>

                {children.length === 0 ? (
                  <div className="parent-empty">
                    <div className="parent-empty-icon">♧</div>
                    <strong>No linked children yet</strong>
                    <p>
                      Link a child using the temporary code from
                      their account.
                    </p>
                  </div>
                ) : (
                  <div className="parent-child-list">
                    {children.map((child, index) => {
                      const username =
                        child.username ||
                        child.child_username ||
                        child.child?.username ||
                        "Child account";

                      return (
                        <div
                          className="parent-child-row"
                          key={
                            child.id ??
                            child.child_id ??
                            username ??
                            index
                          }
                        >
                          <div className="parent-child-avatar">
                            {username.charAt(0).toUpperCase()}
                          </div>
                          <div className="parent-child-details">
                            <strong>{username}</strong>
                            <span>Linked account</span>
                          </div>
                          <span className="parent-linked-status">
                            <i /> Linked
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="parent-panel" id="parent-link">
                <div className="parent-panel-heading">
                  <div>
                    <h2>Link a Child Account</h2>
                    <p>Connect using a temporary pairing code</p>
                  </div>
                  <div className="parent-link-icon">↗</div>
                </div>

                <p className="parent-link-description">
                  Ask your child to generate a pairing code from
                  their account. Enter that code below to link
                  their account securely.
                </p>

                <form
                  onSubmit={linkChild}
                  className="parent-link-form"
                >
                  <label htmlFor="parent-pairing-code">
                    Child's pairing code
                  </label>
                  <input
                    id="parent-pairing-code"
                    value={enteredCode}
                    onChange={(event) =>
                      setEnteredCode(event.target.value)
                    }
                    placeholder="Enter pairing code"
                    autoComplete="off"
                    required
                  />
                  <button type="submit" disabled={loading}>
                    {loading ? "Linking account..." : "Link Child"}
                  </button>
                </form>
              </section>

              <section
                className="parent-panel"
                id="parent-contacts"
              >
                <div className="parent-panel-heading">
                  <div>
                    <h2>Emergency Contacts</h2>
                    <p>Contact management</p>
                  </div>
                  <span className="parent-coming-soon">
                    Not connected
                  </span>
                </div>
                <div className="parent-info-note">
                  Emergency contact management has not been
                  connected to the backend yet. No contacts are
                  currently being loaded or saved here.
                </div>
              </section>

              <section
                className="parent-panel"
                id="parent-settings"
              >
                <div className="parent-panel-heading">
                  <div>
                    <h2>Account Settings</h2>
                    <p>Your signed-in account</p>
                  </div>
                </div>
                <div className="parent-settings-row">
                  <span>Username</span>
                  <strong>{currentUser.username}</strong>
                </div>
                <div className="parent-settings-row">
                  <span>Account role</span>
                  <strong>Parent</strong>
                </div>
              </section>
            </div>

            <section
              className="parent-panel parent-alerts-panel"
              id="parent-alerts"
            >
              <div className="parent-panel-heading">
                <div>
                  <h2>Emergency Alerts</h2>
                  <p>Latest records from linked children</p>
                </div>
                <span
                  className={`parent-alert-count ${
                    activeEmergencies.length ? "has-alerts" : ""
                  }`}
                >
                  {activeEmergencies.length} active
                </span>
              </div>

              {emergencies.length === 0 ? (
                <div className="parent-empty">
                  <div className="parent-empty-icon">✓</div>
                  <strong>No emergency records</strong>
                  <p>
                    Alerts from linked children will appear here
                    when records are available.
                  </p>
                </div>
              ) : (
                <div className="parent-alert-list">
                  {emergencies.map((emergency) => {
                    const hasLocation =
                      emergency.latitude != null &&
                      emergency.longitude != null;

                    const notification = notifications.find(
                      (item) =>
                        Number(item.emergency_id) ===
                        Number(emergency.id)
                    );

                    const isAcknowledged = Boolean(
                      notification?.acknowledged ||
                      notification?.acknowledged_at ||
                      notification?.is_read
                    );

                    return (
                      <article
                        className="parent-alert-row"
                        key={emergency.id}
                      >
                        <div className="parent-alert-icon">!</div>

                        <div className="parent-alert-body">
                          <div className="parent-alert-topline">
                            <strong>
                              {emergency.child_username || "Child"}
                            </strong>
                            <span
                              className={`parent-status ${
                                ["resolved", "closed", "cancelled"].includes(
                                  emergency.status?.toLowerCase()
                                )
                                  ? "resolved"
                                  : "active"
                              }`}
                            >
                              {emergency.status || "Unknown"}
                            </span>
                          </div>

                          <p>
                            {emergency.description || "Emergency alert"}
                          </p>

                          <div style={{ marginTop: "10px", padding: "12px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <strong style={{ fontSize: "12px", color: "#334155" }}>Child emergency contact</strong>
                            <p style={{ margin: "5px 0", fontSize: "12px", color: "#475569" }}>
                              {emergency.emergency_contact_name || "Name not saved"}
                              {emergency.emergency_contact_phone ? <> · <a href={`tel:${emergency.emergency_contact_phone}`}>{emergency.emergency_contact_phone}</a></> : " · Phone number not saved"}
                            </p>
                            <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9f1239", fontWeight: 800 }}>SMS STATUS: SIMULATION ONLY — NO REAL SMS SENT</p>
                            {emergency.sms_simulation?.recipients?.length ? emergency.sms_simulation.recipients.map((contact, index) => (
                              <div key={`${emergency.id}-${contact.phone}-${index}`} style={{ marginTop: "8px", padding: "10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                                <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>{contact.recipient_name || "Emergency contact"} · {contact.phone}</div>
                                <div style={{ fontSize: "10px", fontWeight: 800, color: "#be123c", marginTop: "4px" }}>{contact.status_display || "SIMULATED — NOT SENT"}</div>
                                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: "11px", lineHeight: 1.5, color: "#475569", margin: "7px 0 0" }}>{contact.message || emergency.sms_simulation.message}</pre>
                              </div>
                            )) : (
                              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b" }}>No emergency contact phone numbers are saved for this child.</p>
                            )}
                          </div>

                          <p style={{ margin: "8px 0", fontSize: "12px", color: "#475569" }}>
                            Assigned volunteer: <strong>{emergency.assigned_volunteer || "Not assigned yet"}</strong>
                          </p>
                          {emergency.location_is_simulated && <p style={{ margin: "5px 0", fontSize: "11px", color: "#9f1239" }}>Demo location only — this is not live GPS.</p>}

                          {emergency.created_at && (
                            <time>
                              {new Date(
                                emergency.created_at
                              ).toLocaleString()}
                            </time>
                          )}

                          {hasLocation ? (
                            <a
                              className="parent-map-link"
                              href={`https://www.google.com/maps?q=${emergency.latitude},${emergency.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ⌖ View location on Maps
                            </a>
                          ) : (
                            <span className="parent-no-location">
                              Location unavailable
                            </span>
                          )}

                          {notification && (
                            <div className="parent-acknowledge-area">
                              {isAcknowledged ? (
                                <span className="parent-acknowledged">
                                  ✓ Acknowledged
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="parent-acknowledge-button"
                                  disabled={
                                    acknowledgingId === notification.id
                                  }
                                  onClick={() =>
                                    acknowledgeNotification(notification.id)
                                  }
                                >
                                  {acknowledgingId === notification.id
                                    ? "Acknowledging..."
                                    : "Acknowledge Alert"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {activeEmergencies.length > 0 && (
                <div className="parent-emergency-note">
                  <strong>Emergency action</strong>
                  <p>
                    If your child may be in immediate danger,
                    call <a href="tel:112">112</a> directly.
                    This dashboard does not call emergency
                    services automatically.
                  </p>
                </div>
              )}
            </section>
          </div>

          <footer className="parent-footer">
            SAFEGUARD · Parent Dashboard
          </footer>
        </main>
      </div>
    </div>
  );
}

export default ParentDashboard;
