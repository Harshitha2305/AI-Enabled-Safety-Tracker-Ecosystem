
import { useCallback, useEffect, useState } from "react";
import "./VolunteerDashboard.css";

const THRESHOLD = 18;
const REFRESH_MS = 5000;

export default function VolunteerDashboard({ currentUser, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [emergencies, setEmergencies] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [assignedLiveLocations, setAssignedLiveLocations] = useState({});
  const [relatedLocations, setRelatedLocations] = useState([]);
  const [sensorData, setSensorData] = useState(null);
  const [sensorLoading, setSensorLoading] = useState(true);
  const [sensorError, setSensorError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [volunteerSOS, setVolunteerSOS] = useState(null);
  const [smsPreview, setSmsPreview] = useState(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const request = async (url, options = {}) => {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) throw new Error("Session expired. Please log in again.");

    const response = await fetch(url, {
  cache: "no-store",
      ...options,
      headers: {
        Authorization: `Token ${authToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.error || data.message || "Request failed.");
    }
    return data;
  };

  const toList = (data) =>
    Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

  
const loadEmergencies = useCallback(async () => {
  try {
    const [active, mine] = await Promise.all([
      request("/api/alerts/active/"),
      request("/api/alerts/mine/"),
    ]);

    const isInactive = (item) =>
      ["cancelled", "canceled", "resolved", "closed"].includes(
        String(item.status || "").toLowerCase()
      );

    const activeRows = toList(active).filter(
      (item) => !isInactive(item)
    );

    const assignedRows = toList(mine).filter(
      (item) => !isInactive(item)
    );

    setEmergencies(activeRows);
    setAssigned(assignedRows);

    // Load only this volunteer's own location and assigned people.
    try {
      const related = await request("/api/alerts/related/locations/");

      setRelatedLocations(
        toList(related).filter(
          (item) =>
            item.relation === "self" ||
            item.relation === "assigned_person"
        )
      );
    } catch (locationError) {
      console.error(
        "Could not load related locations:",
        locationError.message
      );
      setRelatedLocations([]);
    }

    // Fetch live locations only for current assignments.
    const livePairs = await Promise.all(
      assignedRows
        .filter((item) =>
          ["assigned", "responding"].includes(
            String(item.status || "").toLowerCase()
          )
        )
        .map(async (item) => {
          try {
            const location = await request(
              `/api/alerts/${item.id}/live-location/`
            );
            return [item.id, location];
          } catch {
            return [item.id, null];
          }
        })
    );

    setAssignedLiveLocations(
      Object.fromEntries(
        livePairs.filter(([, location]) => location)
      )
    );

    setError("");
    setLastUpdated(new Date());
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}, []);

  const loadSensors = useCallback(async () => {
    setSensorLoading(true);
    try {
      const response = await fetch("/api/sensor-data/all/", {
        headers: {
          Authorization: `Token ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) throw new Error("Sensor API unavailable.");
      setSensorData(await response.json());
      setSensorError("");
    } catch (err) {
      setSensorError(err.message);
    } finally {
      setSensorLoading(false);
    }
  }, []);

  const loadVolunteerSOS = useCallback(async () => {
    try {
      const data = await request("/api/alerts/volunteer-sos/");
      setVolunteerSOS(data.active ? data : null);
      setSmsPreview(data.active ? data.sms_simulation || null : null);
    } catch (err) {
      console.error("Volunteer SOS refresh failed:", err.message);
    }
  }, []);

  useEffect(() => {
    loadEmergencies();
    loadSensors();
    loadVolunteerSOS();

    const timer = setInterval(() => {
      loadEmergencies();
      loadSensors();
      loadVolunteerSOS();
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [loadEmergencies, loadSensors, loadVolunteerSOS]);

  const latestSensor = (() => {
    if (Array.isArray(sensorData)) return sensorData[0] || null;
    if (Array.isArray(sensorData?.results)) return sensorData.results[0] || null;
    return sensorData;
  })();

  const x = Number(latestSensor?.acceleration_x ?? 0);
  const y = Number(latestSensor?.acceleration_y ?? 0);
  const z = Number(latestSensor?.acceleration_z ?? 0);
  const hasSensor = Boolean(latestSensor);
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const fallDetected = hasSensor && magnitude >= THRESHOLD;

  const allAlerts = [...emergencies, ...assigned]
  .filter(
    (item) =>
      !["cancelled", "canceled", "resolved", "closed"].includes(
        String(item.status || "").toLowerCase()
      )
  )
  .filter(
    (item, index, list) =>
      list.findIndex((other) => other.id === item.id) === index
  );

  async function activateSOS() {
    if (sosBusy || volunteerSOS) return;
    setSosBusy(true);
    setNotice("");
    try {
      const data = await request("/api/alerts/volunteer-sos/", {
        method: "POST",
        body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 }),
      });
      setVolunteerSOS({
        active: true,
        emergency_id: data.emergency_id,
        status: data.status || "active",
      });
      setSmsPreview(data.sms_simulation || null);
      setNotice(
        `${data.message || "Volunteer SOS activated."} ` +
        `In-app alerts created for ${data.notifications_created ?? 0} other approved volunteer(s). ` +
        "No alert is sent to your own account; SMS is simulation only."
      );
      await loadVolunteerSOS();
      await loadEmergencies();
    } catch (err) {
      setNotice(`SOS failed: ${err.message}`);
    } finally {
      setSosBusy(false);
    }
  }

  async function cancelSOS() {
    if (!volunteerSOS?.emergency_id || sosBusy) return;
    if (!window.confirm("Cancel your active volunteer SOS?")) return;

    setSosBusy(true);
    try {
      const data = await request(
        `/api/alerts/${volunteerSOS.emergency_id}/cancel/`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setVolunteerSOS(null);
      setSmsPreview(null);
      setNotice(data.message || "Volunteer SOS cancelled.");
    } catch (err) {
      setNotice(`Could not cancel SOS: ${err.message}`);
    } finally {
      setSosBusy(false);
    }
  }

  async function acceptEmergency(id) {
    setBusyId(id);
    setNotice("");
    try {
      const data = await request(`/api/alerts/${id}/respond/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotice(data.message || `Emergency #${id} accepted.`);
      await loadEmergencies();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function releaseEmergency(id) {
    if (!window.confirm(`Release emergency #${id}?`)) return;
    setBusyId(id);
    try {
      const data = await request(`/api/alerts/${id}/reject/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotice(data.message || `Emergency #${id} released.`);
      await loadEmergencies();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const name = currentUser?.full_name || currentUser?.username || "Volunteer";
  const navItems = [
    ["dashboard", "Dashboard"],
    ["emergencies", "Emergency Alerts"],
    ["locations", "Live Locations"],
    ["sensors", "Sensor Monitoring"],
    ["history", "Alert History"],
    ["device", "Device Information"],
  ];

  const sensorApiStatus = sensorLoading
    ? "Checking…"
    : sensorError
      ? "Unavailable"
      : "Reachable";

  const smsItems = Array.isArray(smsPreview)
    ? smsPreview
    : smsPreview?.messages || smsPreview?.recipients || [];

  return (
    <main className="volunteer-shell app-shell">
      <header className="v-header">
        <div>
          <p className="v-eyebrow">SAFEGUARD / VOLUNTEER WORKSPACE</p>
          <h1>{navItems.find(([id]) => id === tab)?.[1] || "Dashboard"}</h1>
          <p className="v-subtitle">Emergency response and safety monitoring</p>
        </div>
        <div className="v-header-right">
          <span className="v-online">● System Online</span>
          <div className="v-user">
            <span className="v-user-avatar">{name.charAt(0).toUpperCase()}</span>
            <span><strong>{name}</strong><small>Volunteer Account</small></span>
          </div>
        </div>
      </header>

      <aside className="sidebar v-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo"><span>✳</span></div>
          <div><strong>SAFEGUARD<span className="brand-dot">.</span></strong><small>INTELLIGENT SAFETY SYSTEM</small></div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          {navItems.map(([id, label]) => (
            <button key={id} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              <span>{({dashboard:"▦", emergencies:"♧", locations:"⌖", sensors:"⌁", history:"◷", device:"▣"})[id]}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-promo"><div className="promo-orbit">✦</div><strong>Ready to help.</strong><p>Review alerts and respond when someone needs assistance.</p></div>
        {onLogout && <button className="sidebar-logout" onClick={onLogout}><span>↪</span>Log out</button>}
      </aside>

      {notice && <div className="v-notice" role="status">{notice}</div>}
      {error && <div className="v-notice v-error" role="alert">{error}</div>}

      {tab === "dashboard" && (
        <>
          <section className="v-stats metric-grid">
            <article className="v-card metric-card tone-coral v-stat v-stat-red">
              <span className="v-chip red">Emergency response</span>
              <p>Active Emergencies</p>
              <strong>{emergencies.length}</strong>
              <small>Alerts awaiting response</small>
            </article>
            <article className="v-card metric-card tone-blue v-stat v-stat-blue">
              <span className="v-chip blue">Assignments</span>
              <p>Assigned Emergencies</p>
              <strong>{assigned.length}</strong>
              <small>Emergencies assigned to you</small>
            </article>
            <article className="v-card metric-card tone-violet v-stat v-stat-purple">
              <span className="v-chip purple">Sensor data</span>
              <p>Acceleration Magnitude</p>
              <strong>{hasSensor ? magnitude.toFixed(2) : "—"}</strong>
              <small>Latest available reading</small>
            </article>
            <article className="v-card metric-card tone-mint v-stat v-stat-green">
              <span className="v-chip green">{!hasSensor ? "No data" : fallDetected ? "Review" : "Within range"}</span>
              <p>Safety Status</p>
              <strong>{!hasSensor ? "UNKNOWN" : fallDetected ? "REVIEW" : "NORMAL"}</strong>
              <small>{!hasSensor ? "No sensor record" : "Prototype threshold assessment"}</small>
            </article>
          </section>

          <section className="v-dashboard-grid primary-grid">
            <article className="v-card v-sos-card">
              <div className="v-card-heading">
                <span className="v-icon red-bg">♧</span>
                <div><h2>Emergency SOS</h2><p>Send an alert for your own safety.</p></div>
              </div>

              {volunteerSOS ? (
                <>
                  <div className="v-status-alert">Volunteer SOS #{volunteerSOS.emergency_id} is active.</div>
                  <button className="v-cancel-button" onClick={cancelSOS} disabled={sosBusy}>
                    {sosBusy ? "Processing…" : "CANCEL VOLUNTEER SOS"}
                  </button>
                </>
              ) : (
                <button className="v-sos-button" onClick={activateSOS} disabled={sosBusy}>
                  {sosBusy ? "ACTIVATING…" : "♧ ACTIVATE EMERGENCY SOS"}
                </button>
              )}

              <p className="v-footnote">Prototype only. Coordinates are simulated, not live GPS.</p>

              {smsPreview && (
                <div className="v-sms-box">
                  <strong>SMS PREVIEW — SIMULATED, NOT SENT</strong>
                  {smsItems.length ? smsItems.map((item, i) => (
                    <p key={i}>{typeof item === "string" ? item : `${item.name || item.phone || "Contact"}: ${item.message || item.body || item.phone || ""}`}</p>
                  )) : <p>SMS preview details were not returned by the API.</p>}
                  {smsPreview.status_display && <small>{smsPreview.status_display}</small>}
                </div>
              )}
            </article>

            <article className="v-card">
              <div className="v-card-heading">
                <span className="v-icon blue-bg">ϟ</span>
                <div><h2>Fall Detection</h2><p>Accelerometer-based indicator</p></div>
              </div>
              <div className={fallDetected ? "v-status-alert" : "v-status-ok"}>
                {sensorLoading && !hasSensor ? "Loading sensor readings…" :
                  !hasSensor ? "No sensor record available." :
                    fallDetected ? "Reading reached the demo threshold. Review required." :
                      "Latest reading is below the demo threshold."}
              </div>
              <div className="v-mini-grid">
                <div><small>Acceleration magnitude</small><strong>{hasSensor ? magnitude.toFixed(2) : "—"}</strong></div>
                <div><small>Demo threshold</small><strong>{THRESHOLD.toFixed(2)}</strong></div>
              </div>
              <p className="v-footnote">Prototype indicator only; not a certified fall detection system.</p>
            </article>

            <article className="v-card">
              <div className="v-card-heading">
                <span className="v-icon blue-bg">▣</span>
                <div><h2>Device Information</h2><p>Tracker status overview</p></div>
              </div>
              <div className="v-mini-grid">
                <div><small>Device ID</small><strong>{latestSensor?.device_id || "TRACKER001 (demo)"}</strong></div>
                <div><small>Controller</small><strong>{latestSensor?.controller || "ESP32-S3 (demo)"}</strong></div>
                <div><small>Sensor API</small><strong>{sensorApiStatus}</strong></div>
                <div><small>Refresh interval</small><strong>5 seconds</strong></div>
              </div>
              <p className="v-footnote">API availability does not confirm physical hardware connectivity.</p>
            </article>

            <article className="v-card v-wide">
              <div className="v-card-heading">
                <span className="v-icon purple-bg">✦</span>
                <div><h2>Active Emergencies</h2><p>Respond to people who need help.</p></div>
                <button className="v-small-button" onClick={() => setTab("emergencies")}>View all</button>
              </div>
              {loading ? <div className="v-empty">Loading emergency alerts…</div> :
                emergencies.length === 0 ? <div className="v-empty">No active emergency alerts right now.</div> :
                  <div className="v-alert-list">
                    {emergencies.slice(0, 4).map((item) => (
                      <article className="v-alert-item" key={item.id}>
                        <div className="v-alert-top">
                          <strong>Emergency #{item.id}</strong>
                          <span className="v-chip red">{item.status || "ACTIVE"}</span>
                        </div>
                        <p><b>Person:</b> {item.user_full_name || item.username || "User"}</p>
                        <p><b>Emergency contact:</b> {item.emergency_contact_name || "Not provided"} · {item.emergency_contact_phone || "No phone"}</p>
                        {item.latitude != null && item.longitude != null && (
                          <p><a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">Open location in Google Maps ↗</a></p>
                        )}
                        <button className="v-primary-button" disabled={busyId !== null} onClick={() => acceptEmergency(item.id)}>
                          {busyId === item.id ? "Accepting…" : "Accept emergency"}
                        </button>
                      </article>
                    ))}
                  </div>}
            </article>

            <article className="v-card">
              <div className="v-card-heading">
                <span className="v-icon green-bg">⌖</span>
                <div><h2>Quick Actions</h2><p>Jump to a section</p></div>
              </div>
              <div className="v-quick-actions">
                <button onClick={() => setTab("locations")}>⌖<span>Locations</span><small>View locations</small></button>
                <button onClick={() => setTab("emergencies")}>♧<span>Emergencies</span><small>Respond to alerts</small></button>
                <button onClick={() => setTab("sensors")}>ϟ<span>Sensors</span><small>Latest readings</small></button>
                <button onClick={() => setTab("history")}>◷<span>History</span><small>View assignments</small></button>
              </div>
            </article>
          </section>
        </>
      )}

      {tab === "emergencies" && (
        <section className="v-card">
          <h2>Active Emergency Alerts</h2>
          <p className="v-subtitle">Review details before responding.</p>
          {loading ? <div className="v-empty">Loading…</div> : emergencies.length === 0 ?
            <div className="v-empty">No active emergencies.</div> :
            <div className="v-alert-list">{emergencies.map((item) => (
              <article className="v-alert-item" key={item.id}>
                <div className="v-alert-top"><strong>Emergency #{item.id}</strong><span className="v-chip red">{item.status || "ACTIVE"}</span></div>
                <p><b>Person:</b> {item.user_full_name || item.username || "User"}</p>
                <p><b>Contact:</b> {item.emergency_contact_name || "Not provided"} · {item.emergency_contact_phone || "No phone"}</p>
                {item.latitude != null && item.longitude != null && <p>Location: {item.latitude}, {item.longitude} · <a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">Open Maps ↗</a></p>}
                <p><b>Reported:</b> {item.created_at ? new Date(item.created_at).toLocaleString() : "Not provided"}</p>
                <button className="v-primary-button" disabled={busyId !== null} onClick={() => acceptEmergency(item.id)}>{busyId === item.id ? "Accepting…" : "Accept emergency"}</button>
              </article>
            ))}</div>}
        </section>
      )}

      {tab === "locations" && (
  <>
    <section className="v-card v-related-locations">
      <h2>My Demo Location & Assigned People</h2>

      <p className="v-subtitle">
        Your location is dummy demo data while logged in.
        Other people's locations appear only when they are related
        to an emergency assigned to you.
      </p>

      {relatedLocations.length === 0 ? (
        <div className="v-empty">
          No location records are available yet.
        </div>
      ) : (
        <div className="v-related-location-grid">
          {relatedLocations.map((item) => (
            <article
              className="v-related-location-item"
              key={`${item.user_id}-${item.relation}`}
            >
              <div className="v-alert-top">
                <strong>{item.full_name || item.username}</strong>
                <span className="v-chip blue">
                  {item.relation === "self"
                    ? "YOU"
                    : item.relation.replaceAll("_", " ").toUpperCase()}
                </span>
              </div>

              <p>
                {item.role}
                {item.is_simulated
                  ? " · DEMO LOCATION"
                  : " · GPS LOCATION"}
              </p>

              <strong>
                {Number(item.latitude).toFixed(6)},{" "}
                {Number(item.longitude).toFixed(6)}
              </strong>

              <p>
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
              </p>

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

    <section className="v-card">
      <h2>Emergency Locations</h2>

      <p className="v-subtitle">
        Live location is available only for emergencies assigned to you
        while they remain in an eligible active status.
      </p>

      {allAlerts.length === 0 ? (
        <div className="v-empty">
          No emergency locations available yet.
        </div>
      ) : (
        <div className="v-alert-list">
          {allAlerts.map((item) => {
            const liveLocation = assignedLiveLocations[item.id];

            const latitude =
              liveLocation?.latitude ?? item.latitude;

            const longitude =
              liveLocation?.longitude ?? item.longitude;

            const isAssigned =
              Boolean(liveLocation) &&
              ["assigned", "responding"].includes(
                String(item.status || "").toLowerCase()
              );

            return (
              <article className="v-alert-item" key={item.id}>
                <div className="v-alert-top">
                  <strong>Emergency #{item.id}</strong>
                  <span className="v-chip blue">
                    {item.status || "Unknown"}
                  </span>
                </div>

                <p>
                  {item.user_full_name || item.username || "User"}
                </p>

                {latitude != null && longitude != null ? (
                  <>
                    <p>
                      {Number(latitude).toFixed(6)},{" "}
                      {Number(longitude).toFixed(6)}
                    </p>

                    <a
                      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open {isAssigned ? "live" : "reported"} location in Google Maps ↗
                    </a>

                    {isAssigned && liveLocation.updated_at && (
                      <p className="v-footnote">
                        Location updated:{" "}
                        {new Date(
                          liveLocation.updated_at
                        ).toLocaleTimeString()}
                      </p>
                    )}

                    {liveLocation?.location_is_simulated && (
                      <p className="v-footnote">
                        These coordinates are simulated.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="v-footnote">
                    Location unavailable.
                  </p>
                )}

                {!isAssigned && (
                  <>
                    <p className="v-footnote">
                      Live tracking appears here after this emergency is
                      assigned to you.
                    </p>
                    {String(item.status || "").toLowerCase() === "active" && (
                      <button
                        className="v-primary-button"
                        disabled={busyId !== null}
                        onClick={() => acceptEmergency(item.id)}
                      >
                        {busyId === item.id
                          ? "Accepting…"
                          : "Accept emergency to enable live tracking"}
                      </button>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  </>
)}

      {tab === "sensors" && (
        <section className="v-dashboard-grid primary-grid">
          <article className="v-card v-wide">
            <h2>Sensor Readings</h2><p className="v-subtitle">Latest accelerometer record</p>
            {sensorError && <div className="v-status-alert">{sensorError}</div>}
            {!hasSensor ? <div className="v-empty">{sensorLoading ? "Loading sensor data…" : "No sensor records returned by the API."}</div> :
              <div className="v-mini-grid">
                <div><small>X axis</small><strong>{x.toFixed(2)}</strong></div>
                <div><small>Y axis</small><strong>{y.toFixed(2)}</strong></div>
                <div><small>Z axis</small><strong>{z.toFixed(2)}</strong></div>
                <div><small>Magnitude</small><strong>{magnitude.toFixed(2)}</strong></div>
              </div>}
            <p className="v-footnote">Only values returned by the API are displayed.</p>
          </article>
          <article className="v-card">
            <h2>Current Sensor Assessment</h2>
            <div className={fallDetected ? "v-status-alert" : "v-status-ok"}>
              {!hasSensor ? "Sensor status unknown." : fallDetected ? "Reading at or above the demo threshold." : "Latest reading below the demo threshold."}
            </div>
          </article>
        </section>
      )}

      {tab === "history" && (
        <section className="v-card">
          <h2>Assigned Emergencies & History</h2>
          <p className="v-subtitle">Records returned by your assigned-emergency endpoint.</p>
          {assigned.length === 0 ? <div className="v-empty">No assigned emergencies returned by the backend.</div> :
            <div className="v-alert-list">{assigned.map((item) => (
              <article className="v-alert-item" key={item.id}>
                <div className="v-alert-top"><strong>Emergency #{item.id}</strong><span className="v-chip blue">{item.status || "Unknown"}</span></div>
                <p><b>Person:</b> {item.user_full_name || item.username || "User"}</p>
                <p><b>Contact:</b> {item.emergency_contact_name || "Not provided"} · {item.emergency_contact_phone || "No phone"}</p>
                {item.latitude != null && item.longitude != null && <p><a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">Open location ↗</a></p>}
                <button className="v-secondary-button" disabled={busyId !== null} onClick={() => releaseEmergency(item.id)}>{busyId === item.id ? "Processing…" : "Reject / release"}</button>
              </article>
            ))}</div>}
        </section>
      )}

      {tab === "device" && (
        <section className="v-card">
          <h2>Device Information</h2><p className="v-subtitle">Latest status available from the sensor API</p>
          <div className="v-mini-grid">
            <div><small>Device ID</small><strong>{latestSensor?.device_id || "TRACKER001 (demo)"}</strong></div>
            <div><small>Controller</small><strong>{latestSensor?.controller || "ESP32-S3 (demo)"}</strong></div>
            <div><small>Sensor API</small><strong>{sensorApiStatus}</strong></div>
            <div><small>Last refresh</small><strong>{lastUpdated ? lastUpdated.toLocaleTimeString() : "Waiting…"}</strong></div>
          </div>
          <p className="v-footnote">API reachable does not prove that physical hardware is connected.</p>
        </section>
      )}

      <footer className="v-footer">
        <span><b>SAFEGUARD.</b> Volunteer Response Center</span>
        <span>{lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for data"}</span>
        {onLogout && <button className="v-secondary-button" onClick={onLogout}>Log out</button>}
      </footer>
    </main>
  );
}
