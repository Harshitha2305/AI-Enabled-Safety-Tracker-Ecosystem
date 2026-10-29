import { useCallback, useEffect, useState } from "react";
import "./ParentDashboard.css";
import Profile from "./Profile";
function ParentDashboard({ currentUser, onLogout }) {
  const [children, setChildren] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [locationError, setLocationError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [enteredCode, setEnteredCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showProfile, setShowProfile] = useState(false);
  const [sensorRecords, setSensorRecords] = useState([]);
  const [sensorError, setSensorError] = useState("");
  const [parentSos, setParentSos] = useState(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosFeedback, setSosFeedback] = useState("");
  const token = localStorage.getItem("authToken");
  const [relatedLocations, setRelatedLocations] = useState([]);

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
      const [childrenData, emergencyData, parentSosData] =
        await Promise.all([
          request("/api/accounts/children/"),
          request("/api/alerts/parent/emergencies/"),
          request("/api/alerts/parent/sos/"),
        ]);

      setChildren(Array.isArray(childrenData) ? childrenData : []);
      setEmergencies(Array.isArray(emergencyData) ? emergencyData : []);

      // Load the parent's own SOS status from the backend.
      if (parentSosData.active) {
        setParentSos((current) => ({
          ...current,
          id: parentSosData.emergency_id,
          status: parentSosData.status,
        }));
      } else {
        setParentSos(null);
      }
      
      // Existing linked-child live locations
      try {
        const locationData = await request(
          "/api/alerts/parent/locations/"
        );

        setLiveLocations(
          Array.isArray(locationData) ? locationData : []
        );
        setLocationError("");
      } catch (locationFetchError) {
        setLocationError(
          locationFetchError.message ||
            "Live locations are unavailable."
        );
        setLiveLocations([]);
      }

      // NEW: Related locations (parent and assigned volunteer)
      try {
        const relatedData = await request(
          "/api/alerts/related/locations/"
        );

        setRelatedLocations(
          Array.isArray(relatedData)
            ? relatedData
            : relatedData.results || []
        );
      } catch (relatedError) {
        console.error(
          "Could not load related locations:",
          relatedError.message
        );
        setRelatedLocations([]);
      }

      // Existing emergency notifications
      try {
        const notificationData = await request(
          "/api/alerts/notifications/"
        );

        setNotifications(
          Array.isArray(notificationData) ? notificationData : []
        );
      } catch (error) {
        console.error(
          "Could not load notifications:",
          error.message
        );
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

  const loadSensorRecords = useCallback(async () => {
    try {
      const response = await fetch("/api/sensor-data/all/");
      if (!response.ok) throw new Error("Sensor API is unavailable");
      const data = await response.json();
      const rows = Array.isArray(data) ? data : (data.results || data.data || []);
      setSensorRecords(rows);
      setSensorError("");
    } catch (error) {
      setSensorError(error.message || "Sensor data unavailable");
      setSensorRecords([]);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
    loadSensorRecords();
    const interval = setInterval(() => {
      loadDashboard(false);
      loadSensorRecords();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadDashboard, loadSensorRecords]);

  const raiseParentSOS = async () => {
    if (sosBusy || parentSos?.id) return;
    setSosBusy(true);
    setSosFeedback("");
    try {
      const data = await request("/api/alerts/raise/", {
        method: "POST",
        body: JSON.stringify({
          description: "SOS raised from the SAFEGUARD parent dashboard.",
          latitude: 12.9716,
          longitude: 77.5946,
        }),
      });
      const id = data.emergency_id ?? data.id;
      if (!id) throw new Error("SOS was submitted, but the API did not return an emergency ID.");
      setParentSos({ id, status: data.status || "active", sms_simulation: data.sms_simulation });
      setSosFeedback(`SOS alert created successfully. Emergency #${id}.`);
      await loadDashboard(false);
    } catch (error) {
      setSosFeedback(error.message || "Unable to raise SOS.");
    } finally {
      setSosBusy(false);
    }
  };

  
const cancelParentSOS = async () => {
  if (!parentSos?.id || sosBusy) return;

  if (!window.confirm("Cancel your active SOS alert?")) return;

  const emergencyId = parentSos.id;
  setSosBusy(true);
  setSosFeedback("");

  try {
    const data = await request(
      `/api/alerts/${emergencyId}/cancel/`,
      { method: "POST" }
    );

    if (
      String(data.status || "").toLowerCase() !== "cancelled" ||
      Number(data.emergency_id) !== Number(emergencyId)
    ) {
      throw new Error(
        `Cancellation was not confirmed for SOS #${emergencyId}. Please check the server response.`
      );
    }

    setParentSos(null);
    setSosFeedback(`SOS #${emergencyId} cancelled successfully.`);
    await loadDashboard(false);
  } catch (error) {
    setSosFeedback(
      error.message || "Unable to cancel SOS."
    );
  } finally {
    setSosBusy(false);
  }
};


  const latestSensor = sensorRecords.length
    ? sensorRecords.reduce((latest, row) => {
        const a = new Date(latest.created_at || latest.timestamp || 0).getTime();
        const b = new Date(row.created_at || row.timestamp || 0).getTime();
        return b >= a ? row : latest;
      }, sensorRecords[0])
    : null;
  const sensorMagnitude = latestSensor
    ? Math.sqrt(["acceleration_x", "acceleration_y", "acceleration_z"].reduce((sum, key) => sum + Number(latestSensor[key] || 0) ** 2, 0))
    : null;
  const sensorFall = sensorMagnitude !== null && sensorMagnitude >= 18;

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

  const targetId = section === "alerts" ? "parent-history" : section === "history" ? "parent-history" : section === "sensors" ? "parent-sensors" : `parent-${section}`;
  const element = document.getElementById(targetId);
  element?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};
  const navItems = [
    { id: "dashboard", icon: "⌂", label: "Dashboard" },
    { id: "children", icon: "♧", label: "Linked Children" },
    { id: "alerts", icon: "♢", label: "Emergency Alerts" },
    { id: "safety", icon: "✓", label: "Safety Overview" },
    { id: "sensors", icon: "⌁", label: "Sensor Monitoring" },
    { id: "history", icon: "◷", label: "Alert History" },
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

          {/* Family & Response Locations */}
          <section
            className="parent-panel parent-related-locations-panel"
            id="parent-related-locations"
          >
            <div className="parent-panel-heading">
              <div>
                <h2>Family &amp; Response Locations</h2>
                <p>
                  Parent and volunteer positions are dummy demo locations,
                  not real GPS.
                </p>
              </div>
              <span className="parent-alert-count">AUTO REFRESH</span>
            </div>

            {relatedLocations.length === 0 ? (
              <div className="parent-empty">
                <strong>No location records yet</strong>
                <p>
                  Keep this dashboard open while the demo location publisher runs.
                </p>
              </div>
            ) : (
              <div className="parent-related-location-grid">
                {relatedLocations.map((item) => (
                  <article
                    className="parent-related-location-card"
                    key={`${item.user_id}-${item.relation}`}
                  >
                    <div className="parent-related-location-top">
                      <strong>{item.full_name || item.username}</strong>
                      <span>
                        {item.relation === "self"
                          ? "You"
                          : item.relation.replaceAll("_", " ")}
                      </span>
                    </div>

                    <p>
                      {item.role}
                      {item.is_simulated
                        ? " · DEMO LOCATION"
                        : " · GPS LOCATION"}
                    </p>

                    <strong className="parent-related-coordinates">
                      {Number(item.latitude).toFixed(6)}, {" "}
                      {Number(item.longitude).toFixed(6)}
                    </strong>

                    <a
                      href={
                        item.maps_url ||
                        `https://www.google.com/maps?q=${item.latitude},${item.longitude}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps ↗
                    </a>

                    <small>
                      {item.updated_at
                        ? `Updated ${new Date(item.updated_at).toLocaleTimeString()}`
                        : "Waiting for update"}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="parent-monitor-grid" id="parent-alerts">
            <article className="parent-panel parent-sos-panel">
              <div className="parent-panel-heading">
                <div><h2>Emergency SOS</h2><p>Raise an alert for your own safety from the parent account.</p></div>
                <span className="parent-alert-count">SOS</span>
              </div>
              <button type="button" className={`parent-sos-button ${parentSos?.id ? "cancel" : ""}`} onClick={parentSos?.id ? cancelParentSOS : raiseParentSOS} disabled={sosBusy}>
                {sosBusy ? "PLEASE WAIT…" : parentSos?.id ? "CANCEL MY SOS" : "ACTIVATE EMERGENCY SOS"}
              </button>
              <p className="parent-sos-status">{parentSos?.id ? `Your SOS #${parentSos.id} is active.` : "No active SOS from this parent account."}</p>
              {sosFeedback && <p className="parent-sos-feedback" role="status">{sosFeedback}</p>}
    {parentSos?.sms_simulation && (
  <div className="parent-sms-preview" role="status">
    <strong>Emergency contact message preview</strong>
    <p>Simulation only — no SMS has been sent.</p>

    {parentSos.sms_simulation.recipients?.length ? (
      <ul>
        {parentSos.sms_simulation.recipients.map((contact, index) => (
          <li key={`${contact.phone}-${index}`}>
            <span>
              {contact.recipient_name || "Emergency contact"}
            </span>
            <strong>{contact.phone}</strong>
            <small>
              {contact.status_display || "SIMULATED - NOT SENT"}
            </small>
          </li>
        ))}
      </ul>
    ) : (
      <small>
        No emergency contact phone numbers are saved for this parent account.
      </small>
    )}
  </div>
)}
              <small>Prototype only. The displayed coordinates are demo coordinates, not live GPS. SMS is not sent by this dashboard.</small>
            </article>
            <article className="parent-panel" id="parent-sensors">
              <div className="parent-panel-heading"><div><h2>Sensor Monitoring</h2><p>Latest available accelerometer reading</p></div><span className={`parent-safety-badge ${sensorFall ? "danger" : "safe"}`}>{sensorFall ? "CHECK READING" : latestSensor ? "WITHIN RANGE" : "NO DATA"}</span></div>
              {latestSensor ? <>
                <div className={`parent-sensor-banner ${sensorFall ? "danger" : ""}`}><strong>{sensorFall ? "Possible high-impact movement detected" : "Latest reading is below the demo threshold"}</strong><span>Magnitude: {sensorMagnitude.toFixed(2)} · Threshold: 18.00</span></div>
                <div className="parent-sensor-values">
                  <div><span>X axis</span><strong>{Number(latestSensor.acceleration_x || 0).toFixed(2)}</strong></div>
                  <div><span>Y axis</span><strong>{Number(latestSensor.acceleration_y || 0).toFixed(2)}</strong></div>
                  <div><span>Z axis</span><strong>{Number(latestSensor.acceleration_z || 0).toFixed(2)}</strong></div>
                  <div><span>Device</span><strong>{latestSensor.device_id || "TRACKER001"}</strong></div>
                </div>
                <p className="parent-muted-note">Readings from the available sensor API; they are not guaranteed to belong to a specific linked child.</p>
              </> : <div className="parent-empty"><div className="parent-empty-icon">⌁</div><strong>{sensorError ? "Sensor API unavailable" : "Waiting for sensor readings"}</strong><p>{sensorError || "No sensor records have been returned yet."}</p></div>}
            </article>
          </section>

          <section className="parent-safety-section" id="parent-safety">
            <div className="parent-safety-heading">
              <div>
                <span className="parent-eyebrow">CHILD SAFETY</span>
                <h2>Safety Overview</h2>
                <p>Review emergency status and location information reported for your linked children.</p>
              </div>
              <span className={`parent-safety-badge ${activeEmergencies.length ? "danger" : "safe"}`}>
                {activeEmergencies.length ? "ATTENTION NEEDED" : "NO ACTIVE ALERTS"}
              </span>
            </div>
            <div className="parent-safety-grid">
              <article className="parent-safety-card">
                <div className="parent-safety-card-icon red">!</div>
                <div>
                  <span>Emergency Status</span>
                  <strong>{activeEmergencies.length ? "Alert active" : "No active emergency"}</strong>
                  <small>{activeEmergencies.length ? `${activeEmergencies.length} unresolved alert(s) from linked children` : "No unresolved child alerts currently reported"}</small>
                </div>
              </article>
              <article className="parent-safety-card">
                <div className="parent-safety-card-icon blue">⌖</div>
                <div>
                  <span>Live Location</span>
                  <strong>{liveLocations.length ? `${liveLocations.length} live location(s)` : "No live location yet"}</strong>
                  <small>{locationError || "Latest GPS locations shared by linked children in the supported Bengaluru area."}</small>
                  {liveLocations.length > 0 && (
                    <div className="parent-live-location-list">
                      {liveLocations.map((location) => (
                        <p key={location.user_id}>
                          <strong>{location.child_full_name || location.child_username}</strong>
                          {" · "}
                          {location.updated_at ? `Updated ${new Date(location.updated_at).toLocaleTimeString()}` : "Recently updated"}
                          {" · "}
                          <a className="parent-map-link" href={location.maps_url || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Open live location ↗</a>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </article>
              <article className="parent-safety-card">
                <div className="parent-safety-card-icon violet">↯</div>
                <div>
                  <span>Fall Detection</span>
                  <strong>{activeEmergencies.some((item) => /fall/i.test(item.description || "")) ? "Possible fall alert" : "No fall alert reported"}</strong>
                  <small>Based on emergency reports returned by the server; this is not a live sensor feed.</small>
                </div>
              </article>
              <article className="parent-safety-card">
                <div className="parent-safety-card-icon teal">▣</div>
                <div>
                  <span>Sensor & Device Status</span>
                  <strong>Not connected to parent view</strong>
                  <small>The current parent API does not provide child sensor readings or hardware status, so no readings are invented here.</small>
                </div>
              </article>
            </div>
            <div className="parent-safety-note">
              <strong>Need immediate help?</strong>
              <span>This dashboard does not contact emergency services automatically. If your child may be in immediate danger, call <a href="tel:112">112</a>.</span>
            </div>
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
              id="parent-history"
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

              {activeEmergencies.length === 0 ? (
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
                  {activeEmergencies.map((emergency) => {
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

                          <div className="parent-child-emergency-contact">
                            <strong>Child emergency contact</strong>
                            <p>
                              {emergency.emergency_contact_name || "Name not saved"}
                              {emergency.emergency_contact_phone ? (
                                <> · <a href={`tel:${emergency.emergency_contact_phone}`}>{emergency.emergency_contact_phone}</a></>
                              ) : " · Phone number not saved"}
                            </p>
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

                          {(() => {
                            const liveLocation = liveLocations.find((item) =>
                              item.child_username === emergency.child_username
                            );
                            const latitude = liveLocation?.latitude ?? emergency.latitude;
                            const longitude = liveLocation?.longitude ?? emergency.longitude;
                            return latitude != null && longitude != null ? (
                              <a
                                className="parent-map-link"
                                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                ⌖ {liveLocation ? "View live location on Maps" : "View reported location on Maps"}
                              </a>
                            ) : (
                              <span className="parent-no-location">Live location unavailable</span>
                            );
                          })()}

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
