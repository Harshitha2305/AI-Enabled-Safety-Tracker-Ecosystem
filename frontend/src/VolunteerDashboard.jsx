import { useCallback, useEffect, useState } from "react";
import "./VolunteerDashboard.css";
import Profile from "./Profile.jsx";

function VolunteerDashboard({ currentUser, onLogout }) {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [assignedEmergencies, setAssignedEmergencies] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  
const [volunteerSOSId, setVolunteerSOSId] = useState(null);
const [volunteerSOSLoading, setVolunteerSOSLoading] = useState(false);
const [volunteerSOSMessage, setVolunteerSOSMessage] = useState("");
const [volunteerSOSStatus, setVolunteerSOSStatus] = useState("");
const [volunteerSmsSimulation, setVolunteerSmsSimulation] = useState(null);

  const fetchEmergencies = useCallback(async () => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/alerts/active/", {
        headers: { Authorization: `Token ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || "Unable to load emergency alerts."
        );
      }

      setEmergencies(Array.isArray(data) ? data : data.results || []);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Unable to connect to the emergency service.");
    } finally {
      setLoading(false);
    }
  }, []);
  
const fetchVolunteerSOS = useCallback(async () => {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch("/api/alerts/volunteer-sos/", {
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.error || "Unable to check volunteer SOS."
      );
    }

    setVolunteerSOSId(data.active ? data.emergency_id : null);
    setVolunteerSOSStatus(data.active ? data.status : "");
    setVolunteerSmsSimulation(data.active ? (data.sms_simulation || null) : null);
  } catch (err) {
    console.error("Volunteer SOS check failed:", err.message);
  }
}, []);

const handleVolunteerSOS = async () => {
  if (volunteerSOSLoading || volunteerSOSId) return;

  const confirmed = window.confirm(
    "Send a VOLUNTEER SOS to other approved volunteers? This is a safety emergency alert."
  );

  if (!confirmed) return;

  const token = localStorage.getItem("authToken");

  if (!token) {
    setVolunteerSOSMessage("Please log in again.");
    return;
  }

  setVolunteerSOSLoading(true);
  setVolunteerSOSMessage("");

  try {
    // Demo coordinates only. This is NOT real GPS.
    const response = await fetch("/api/alerts/volunteer-sos/", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.error || "Unable to send volunteer SOS."
      );
    }

    setVolunteerSOSId(data.emergency_id);
    setVolunteerSOSStatus(data.status || "active");
    setVolunteerSmsSimulation(data.sms_simulation || null);

    setVolunteerSOSMessage(
      data.message || "Volunteer SOS sent successfully."
    );

    window.alert(
      `VOLUNTEER SOS SENT\n\nEmergency #${data.emergency_id}\nOther approved volunteers have been notified.\n\nLocation is simulated.`
    );

    await fetchVolunteerSOS();
  } catch (err) {
    setVolunteerSOSMessage(err.message || "Unable to send volunteer SOS.");
    window.alert(`SOS FAILED\n\n${err.message}`);
  } finally {
    setVolunteerSOSLoading(false);
  }
};

const handleCancelVolunteerSOS = async () => {
  if (!volunteerSOSId || volunteerSOSLoading) return;

  const confirmed = window.confirm(
    `Cancel your Volunteer SOS #${volunteerSOSId}?`
  );

  if (!confirmed) return;

  const token = localStorage.getItem("authToken");

  if (!token) {
    setVolunteerSOSMessage("Please log in again.");
    return;
  }

  setVolunteerSOSLoading(true);
  setVolunteerSOSMessage("");

  try {
    const response = await fetch(
      `/api/alerts/${volunteerSOSId}/cancel/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.error || "Unable to cancel volunteer SOS."
      );
    }

    setVolunteerSOSId(null);
    setVolunteerSOSStatus("");
    setVolunteerSOSMessage(
      `Volunteer SOS #${data.emergency_id} cancelled successfully.`
    );

    window.alert(
      `VOLUNTEER SOS CANCELLED\n\nEmergency #${data.emergency_id} has been cancelled.`
    );
  } catch (err) {
    setVolunteerSOSMessage(
      err.message || "Unable to cancel volunteer SOS."
    );
    window.alert(`CANCELLATION FAILED\n\n${err.message}`);
  } finally {
    setVolunteerSOSLoading(false);
  }
};

useEffect(() => {
  fetchVolunteerSOS();

  const interval = setInterval(fetchVolunteerSOS, 5000);

  return () => clearInterval(interval);
}, [fetchVolunteerSOS]);

const fetchAssignedEmergencies = useCallback(async () => {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch("/api/alerts/mine/", {
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.error || "Unable to load assigned emergencies."
      );
    }

    setAssignedEmergencies(Array.isArray(data) ? data : data.results || []);
  } catch (err) {
    console.error("Assigned emergencies:", err.message);
  }
}, []);

useEffect(() => {
  fetchEmergencies();
  fetchAssignedEmergencies();

  const interval = setInterval(() => {
    fetchEmergencies();
    fetchAssignedEmergencies();
  }, 5000);

  return () => clearInterval(interval);
}, [fetchEmergencies, fetchAssignedEmergencies]);
  
const handleAccept = async (id) => {
  if (acceptingId !== null) return;

  const token = localStorage.getItem("authToken");

  if (!token) {
    setMessage("Please log in again.");
    return;
  }

  setAcceptingId(id);
  setMessage("");

  try {
    const response = await fetch(`/api/alerts/${id}/respond/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.error || "This alert could not be accepted."
      );
    }

    setMessage(`Emergency #${id} accepted successfully.`);

    // Load assigned emergencies from Django's database.
    await fetchAssignedEmergencies();

    // Refresh the available emergency inbox.
    await fetchEmergencies();
  } catch (err) {
    setMessage(err.message || "Unable to accept this emergency.");
    await fetchEmergencies();
  } finally {
    setAcceptingId(null);
  }
};

  
const handleReject = async (id) => {
  if (rejectingId !== null) return;

  const confirmed = window.confirm(
    `You accepted Emergency #${id}. Rejecting will release it so another approved volunteer can respond. Continue?`
  );

  if (!confirmed) return;

  const token = localStorage.getItem("authToken");

  if (!token) {
    setMessage("Please log in again.");
    return;
  }

  setRejectingId(id);
  setMessage("");

  try {
    const response = await fetch(`/api/alerts/${id}/reject/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.error || "Unable to release this emergency."
      );
    }

    setMessage(
      data.message || `Emergency #${id} released for another volunteer.`
    );

    // Refresh both lists from the backend.
    await fetchAssignedEmergencies();
    await fetchEmergencies();

  } catch (err) {
    setMessage(err.message || "Unable to reject this emergency.");
    await fetchAssignedEmergencies();
    await fetchEmergencies();
  } finally {
    setRejectingId(null);
  }
};


  const formatTime = (value) => {
    if (!value) return "Time unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Time unavailable"
      : date.toLocaleString();
  };

  const goToTab = (tab, sectionId) => {
    setActiveTab(tab);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  if (showProfile) {
  return (
    <Profile
      onBack={() => {
        setShowProfile(false);
        setActiveTab("inbox");
      }}
    />
  );
}
  return (
    <div className="volunteer-shell">
      <aside className="volunteer-sidebar">
        <div className="volunteer-brand">
          <div className="volunteer-brand-icon">✳</div>
          <div>
            <strong>
              SAFEGUARD<span>.</span>
            </strong>
            <small>VOLUNTEER ACCOUNT</small>
          </div>
        </div>

        <div className="volunteer-nav-label">OPERATIONS</div>

        <button type="button" className={`volunteer-nav-item ${activeTab === "dashboard" ? "selected" : ""}`} onClick={() => goToTab("dashboard", "volunteer-dashboard-top")}><span>▦</span> Dashboard</button>
        <button type="button" className={`volunteer-nav-item ${activeTab === "inbox" ? "selected" : ""}`} onClick={() => goToTab("inbox", "emergency-inbox")}><span>♧</span> Emergency Alerts</button>
        <button type="button" className={`volunteer-nav-item ${activeTab === "location" ? "selected" : ""}`} onClick={() => goToTab("location", "live-location")}><span>⌖</span> Live Location</button>
        <button type="button" className={`volunteer-nav-item ${activeTab === "sensors" ? "selected" : ""}`} onClick={() => goToTab("sensors", "sensor-monitoring")}><span>⌁</span> Sensor Monitoring</button>
        <button type="button" className={`volunteer-nav-item ${activeTab === "history" ? "selected" : ""}`} onClick={() => goToTab("history", "response-status")}><span>◷</span> Alert History</button>
        <button type="button" className={`volunteer-nav-item ${activeTab === "device" ? "selected" : ""}`} onClick={() => goToTab("device", "device-status")}><span>▣</span> Device</button>
        <button
  type="button"
  className={`volunteer-nav-item ${
    activeTab === "profile" ? "selected" : ""
  }`}
  onClick={() => {
    setActiveTab("profile");
    setShowProfile(true);
  }}
>
  <span>♙</span> My Profile
</button>

        <div className="volunteer-sidebar-bottom">
          <div className="volunteer-profile">
            <div className="volunteer-avatar">
              {(currentUser?.username || "V").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{currentUser?.username || "Volunteer"}</strong>
              <small>Approved volunteer</small>
            </div>
          </div>
          <button type="button" className="volunteer-logout" onClick={onLogout}>
            ↪ Log out
          </button>
        </div>
      </aside>

      <main className="volunteer-main" id="volunteer-dashboard-top">
        <header className="volunteer-topbar">
          <div>
            <div className="volunteer-breadcrumb">
              SAFEGUARD <span>/</span> VOLUNTEER ACCOUNT
            </div>
            <h1>Dashboard</h1>
            <p>Monitor incoming emergencies and coordinate your response.</p>
          </div>

          <div className="volunteer-online">
            <span />
            RESPONSE SYSTEM
          </div>
        </header>

        <section className="volunteer-welcome">
          <div>
            <span className="volunteer-eyebrow">VOLUNTEER OPERATIONS</span>
            <h2>Ready to respond, {currentUser?.username || "Volunteer"}?</h2>
            <p>
              Review incoming SOS alerts and accept an emergency when you are
              ready to respond.
            </p>
          </div>
          <div className="volunteer-welcome-icon">♧</div>
        </section>
        
<section
  style={{
    marginTop: "18px",
    padding: "22px",
    background: "#fff",
    border: "1px solid #fecdd3",
    borderRadius: "16px",
    boxShadow: "0 5px 20px rgba(225, 29, 72, 0.06)",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "16px",
      flexWrap: "wrap",
    }}
  >
    <div style={{ flex: "1", minWidth: "220px" }}>
      <h2 style={{ margin: "0 0 8px", color: "#9f1239", fontSize: "19px" }}>
        Volunteer Safety SOS
      </h2>

      <p style={{ margin: 0, color: "#718096", fontSize: "12px", lineHeight: 1.7 }}>
        Need help yourself? Alert other approved volunteers with your simulated
        location.
      </p>

      {volunteerSOSId && (
        <p style={{ margin: "10px 0 0", color: "#be123c", fontSize: "12px" }}>
          Emergency #{volunteerSOSId} · Status: {volunteerSOSStatus}
        </p>
      )}

      {volunteerSOSMessage && (
        <p role="status" style={{ margin: "10px 0 0", color: "#475569", fontSize: "12px" }}>
          {volunteerSOSMessage}
        </p>
      )}

      {volunteerSOSId && volunteerSmsSimulation && (
        <div style={{ marginTop: "14px", padding: "14px", border: "1px solid #fecdd3", borderRadius: "12px", background: "#fff1f2", width: "100%", boxSizing: "border-box" }}>
          <strong style={{ color: "#9f1239", fontSize: "13px" }}>Emergency contact & SMS preview</strong>
          <p style={{ margin: "6px 0 10px", color: "#9f1239", fontSize: "11px", fontWeight: 800 }}>SIMULATION ONLY — NO REAL SMS SENT</p>
          {volunteerSmsSimulation.recipients?.length ? volunteerSmsSimulation.recipients.map((contact, index) => (
            <div key={`${contact.phone}-${index}`} style={{ marginTop: "9px", padding: "10px", borderRadius: "8px", background: "#fff", border: "1px solid #ffe4e6" }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#334155" }}>{contact.recipient_name || "Emergency contact"}</div>
              <div style={{ fontSize: "12px", marginTop: "3px" }}>Phone: <a href={`tel:${contact.phone}`}>{contact.phone}</a></div>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "#be123c", marginTop: "5px" }}>{contact.status_display || "SIMULATED — NOT SENT"}</div>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: "11px", lineHeight: 1.5, color: "#475569", margin: "7px 0 0" }}>{contact.message || volunteerSmsSimulation.message}</pre>
            </div>
          )) : (
            <p style={{ fontSize: "12px", color: "#64748b", marginBottom: 0 }}>No emergency contacts with phone numbers are saved on your profile.</p>
          )}
        </div>
      )}
    </div>

    {!volunteerSOSId ? (
      <button
        type="button"
        onClick={handleVolunteerSOS}
        disabled={volunteerSOSLoading}
        style={{
          appearance: "none",
          border: "none",
          borderRadius: "12px",
          padding: "15px 22px",
          minHeight: "48px",
          background: volunteerSOSLoading ? "#fda4af" : "#e11d48",
          color: "#fff",
          fontSize: "12px",
          fontWeight: 900,
          letterSpacing: "0.5px",
          cursor: volunteerSOSLoading ? "wait" : "pointer",
          boxShadow: "0 5px 14px rgba(225, 29, 72, 0.2)",
        }}
      >
        {volunteerSOSLoading ? "SENDING SOS..." : "🆘 SOS — I NEED HELP"}
      </button>
    ) : (
      <button
        type="button"
        onClick={handleCancelVolunteerSOS}
        disabled={volunteerSOSLoading}
        style={{
          appearance: "none",
          border: "1px solid #fecdd3",
          borderRadius: "12px",
          padding: "15px 22px",
          minHeight: "48px",
          background: "#fff1f2",
          color: "#be123c",
          fontSize: "12px",
          fontWeight: 900,
          cursor: volunteerSOSLoading ? "wait" : "pointer",
        }}
      >
        {volunteerSOSLoading ? "PLEASE WAIT..." : "CANCEL MY SOS"}
      </button>
    )}
  </div>

  <p style={{ margin: "14px 0 0", color: "#94a3b8", fontSize: "10px" }}>
    Demo mode: location is simulated; no real GPS or SMS is used.
  </p>
</section>

        <section className="volunteer-stats" aria-label="Volunteer dashboard overview">
          <article className="volunteer-stat"><span className="volunteer-stat-icon red">!</span><div><small>Active emergencies</small><strong>{emergencies.length}</strong><span>Awaiting response</span></div></article>
          <article className="volunteer-stat"><span className="volunteer-stat-icon blue">✓</span><div><small>Assigned to me</small><strong>{assignedEmergencies.length}</strong><span>Accepted responses</span></div></article>
          <article className="volunteer-stat"><span className="volunteer-stat-icon green">●</span><div><small>Volunteer access</small><strong className="access-approved">Approved</strong><span>Response enabled</span></div></article>
          <article className="volunteer-stat"><span className="volunteer-stat-icon blue">↻</span><div><small>System refresh</small><strong>5 sec</strong><span>Automatic updates</span></div></article>
        </section>

        <section
          className="volunteer-inbox-panel"
          id="emergency-inbox"
        >
          <div className="volunteer-inbox-heading">
            <div>
              <h2>Incoming Emergency Alerts</h2>
              <p>Only active, unassigned emergencies appear here.</p>
            </div>
            <button
              type="button"
              className="volunteer-refresh"
              onClick={fetchEmergencies}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>

          {message && (
            <div className="volunteer-message" role="status">
              {message}
            </div>
          )}

          {error && (
            <div className="volunteer-error" role="alert">
              <strong>Connection issue</strong>
              <p>{error}</p>
              <button type="button" onClick={fetchEmergencies}>
                Try again
              </button>
            </div>
          )}

          {loading && emergencies.length === 0 ? (
            <div className="volunteer-empty">
              <div className="volunteer-empty-icon">↻</div>
              <strong>Loading emergency inbox…</strong>
              <p>Checking for active SOS alerts.</p>
            </div>
          ) : !error && emergencies.length === 0 ? (
            <div className="volunteer-empty">
              <div className="volunteer-empty-icon">✓</div>
              <strong>You're all caught up</strong>
              <p>No unassigned emergencies right now.</p>
              <small>
                {lastUpdated
                  ? `Last checked at ${lastUpdated.toLocaleTimeString()}`
                  : "The inbox refreshes automatically every 5 seconds."}
              </small>
            </div>
          ) : (
            <div className="volunteer-alert-list">
              {emergencies.map((emergency) => (
                <article
                  className="volunteer-alert-card"
                  key={emergency.id}
                >
                  <div className="volunteer-alert-top">
                    <span className="volunteer-alert-symbol">SOS</span>
                    <span className="volunteer-active-badge">
                      <i /> ACTIVE
                    </span>
                  </div>

                  <h3>Emergency #{emergency.id}</h3>
                  <p className="volunteer-alert-description">
                    {emergency.description || "No additional details provided."}
                  </p>

                  <div className="volunteer-alert-details">
                    <div>
                      <span>Person needing help</span>
                      <strong>
                        {emergency.user_full_name ||
                          emergency.full_name ||
                          emergency.username ||
                          emergency.user_name ||
                          "User details unavailable"}
                      </strong>
                    </div>
                    <div>
                      <span>Contact number</span>
                      <strong>
                        {emergency.user_phone ||
                          emergency.phone ||
                          "Not provided"}
                      </strong>
                    </div>
                  </div>

                  {emergency.emergency_contact_name && (
                    <div className="volunteer-location">
                      <span>☎</span>
                      <div>
                        <strong>Emergency contact</strong>
                        <p>
                          {emergency.emergency_contact_name}
                          {emergency.emergency_contact_phone
                            ? ` · ${emergency.emergency_contact_phone}`
                            : ""}
                        </p>
                        {emergency.emergency_contact_phone && (
                          <a href={`tel:${emergency.emergency_contact_phone}`}>
                            Call emergency contact
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="volunteer-alert-details">
                    <div>
                      <span>Reported</span>
                      <strong>{formatTime(emergency.created_at)}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong className="volunteer-status-text">
                        {emergency.status || "active"}
                      </strong>
                    </div>
                  </div>

                  {emergency.latitude != null &&
                    emergency.longitude != null && (
                      <div className="volunteer-location">
                        <span>⌖</span>
                        <div>
                          <strong>Reported coordinates</strong>
                          <p>
                            {emergency.latitude}, {emergency.longitude}
                          </p>
                          <a
                            href={`https://www.google.com/maps?q=${encodeURIComponent(
                              `${emergency.latitude},${emergency.longitude}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Google Maps ↗
                          </a>
                        </div>
                      </div>
                    )}

                  <button
                    type="button"
                    className="volunteer-accept"
                    onClick={() => handleAccept(emergency.id)}
                    disabled={acceptingId !== null}
                  >
                    {acceptingId === emergency.id
                      ? "ACCEPTING EMERGENCY…"
                      : "ACCEPT EMERGENCY →"}
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className="volunteer-inbox-footer">
            <span>
              <i /> Automatic monitoring enabled
            </span>
            <span>
              Last updated:{" "}
              {lastUpdated ? lastUpdated.toLocaleTimeString() : "Waiting…"}
            </span>
          </div>
        </section>

        
        <section className="volunteer-inbox-panel" id="live-location">
          <div className="volunteer-inbox-heading"><div><h2>Live Location</h2><p>Location details attached to active and assigned emergencies.</p></div></div>
          {[...emergencies, ...assignedEmergencies].filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index && item.latitude != null && item.longitude != null).length ? (
            <div className="volunteer-response-list">
              {[...emergencies, ...assignedEmergencies].filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index && item.latitude != null && item.longitude != null).map((item) => (
                <article className="volunteer-response-card" key={`loc-${item.id}`}><div className="volunteer-response-check">⌖</div><div><strong>Emergency #{item.id}</strong><p>{item.user_full_name || item.username || "Person needing help"}</p><p>{item.latitude}, {item.longitude}</p><a href={`https://www.google.com/maps?q=${encodeURIComponent(`${item.latitude},${item.longitude}`)}`} target="_blank" rel="noreferrer">Open location in Google Maps ↗</a></div></article>
              ))}
            </div>
          ) : <div className="volunteer-empty"><div className="volunteer-empty-icon">⌖</div><strong>No emergency location available</strong><p>Coordinates appear here when an active or assigned alert includes them.</p></div>}
        </section>

        <section className="volunteer-inbox-panel" id="sensor-monitoring">
          <div className="volunteer-inbox-heading"><div><h2>Sensor Monitoring</h2><p>Sensor readings are shown only when the emergency API supplies them.</p></div></div>
          <div className="volunteer-empty"><div className="volunteer-empty-icon">⌁</div><strong>Monitoring emergency reports</strong><p>This volunteer account does not directly control the user's hardware. Review reported details and locations from each emergency alert.</p></div>
        </section>

        <section className="volunteer-inbox-panel" id="device-status">
          <div className="volunteer-inbox-heading"><div><h2>Device Status</h2><p>SAFEGUARD demo environment status.</p></div></div>
          <div className="volunteer-response-card"><div className="volunteer-response-check">✓</div><div><strong>Volunteer console connected</strong><p>Emergency inbox, assigned responses, and volunteer SOS refresh automatically.</p><p>Location mode: simulated demo coordinates where indicated.</p></div><span className="volunteer-assigned-badge">ONLINE</span></div>
        </section>

<section
  className="volunteer-inbox-panel volunteer-response-status"
  id="response-status"
>
  <div className="volunteer-inbox-heading">
    <div>
      <h2>Response Status</h2>
      <p>Your assigned emergencies, saved in the database.</p>
    </div>

    <span className="volunteer-status-count">
      {assignedEmergencies.length} ASSIGNED
    </span>
  </div>

  {assignedEmergencies.length === 0 ? (
    <div className="volunteer-empty">
      <div className="volunteer-empty-icon">◉</div>
      <strong>No assigned emergencies</strong>
      <p>Accepted emergencies will appear here automatically.</p>
    </div>
  ) : (
    <div className="volunteer-response-list">
      {assignedEmergencies.map((item) => (
        <article className="volunteer-response-card" key={item.id}>
          <div className="volunteer-response-check">✓</div>

          <div>
            <strong>Emergency #{item.id}</strong>
            <p>
              Person: {item.user_full_name || item.username || "User"}
            </p>
            <p>
              Status: {item.status}
              {" · "}
              Updated:{" "}
              {item.updated_at
                ? new Date(item.updated_at).toLocaleString()
                : "—"}
            </p>

            {item.latitude != null && item.longitude != null && (
              <p>
                <a
                  href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open location in Google Maps ↗
                </a>
              </p>
            )}
          </div>

          <div className="response-status-actions">
            <span className="volunteer-assigned-badge">
              {item.status.toUpperCase()}
            </span>

            <button
              type="button"
              onClick={() => handleReject(item.id)}
              disabled={rejectingId !== null}
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                backgroundColor:
                  rejectingId === item.id ? "#fda4af" : "#fff1f2",
                color: "#e11d48",
                border: "1px solid #fecdd3",
                borderRadius: "9px",
                padding: "10px 16px",
                minHeight: "40px",
                fontFamily: "inherit",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.3px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                cursor:
                  rejectingId === item.id ? "wait" : "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (rejectingId !== item.id) {
                  e.currentTarget.style.backgroundColor = "#e11d48";
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.borderColor = "#e11d48";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(225, 29, 72, 0.18)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff1f2";
                e.currentTarget.style.color = "#e11d48";
                e.currentTarget.style.borderColor = "#fecdd3";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {rejectingId === item.id
                ? "RELEASING..."
                : "REJECT / RELEASE"}
            </button>
          </div>
        </article>
      ))}
    </div>
  )}
</section>


        <footer className="volunteer-footer">
          <strong>SAFEGUARD.</strong>
          <span>Volunteer Response Center · Safety prototype</span>
        </footer>
      </main>
    </div>
  );
}

export default VolunteerDashboard;
