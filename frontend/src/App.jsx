import { useEffect, useRef, useState } from "react";
import "./App.css";
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import VolunteerDashboard from "./VolunteerDashboard.jsx";
import ParentDashboard from "./ParentDashboard.jsx";
import LandingPage from "./LandingPage.jsx";
import Profile from "./Profile.jsx";

function App() {
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sosActive, setSosActive] = useState(false);
  const [fallDetected, setFallDetected] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState("");
const [simulationLoading, setSimulationLoading] = useState(false);

const [simulatedLocation, setSimulatedLocation] = useState({
  latitude: "12.9716",
  longitude: "77.5946",
});
const [autoSimulation, setAutoSimulation] = useState(false);
const [simulationScenario, setSimulationScenario] = useState("normal");
  const autoSosTriggered = useRef(false);
  const simulationTick = useRef(0);
  const simulatedLocationRef = useRef(simulatedLocation);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosMessage, setSosMessage] = useState("");
  const [emergencyId, setEmergencyId] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    if (!localStorage.getItem("authToken")) return null;
    return {
      username: localStorage.getItem("username"),
      role: localStorage.getItem("role"),
      volunteer_status: localStorage.getItem("volunteerStatus"),
    };
  });
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showProfile, setShowProfile] = useState(false);
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [emergenciesLoading, setEmergenciesLoading] = useState(false);
  const [volunteerMessage, setVolunteerMessage] = useState("");
  const [acceptingEmergencyId, setAcceptingEmergencyId] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const isApprovedVolunteer =
    currentUser?.role === "volunteer" &&
    currentUser?.volunteer_status === "approved";

  const fetchSensorData = async () => {
    try {
      const response = await fetch("/api/sensor-data/all/");
      if (!response.ok) throw new Error("Failed to fetch sensor data");
      const data = await response.json();
      setSensorData(data);
      setFallDetected(detectFall(getLatestRecord(data)));
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to connect to sensor API");
    } finally {
      setLoading(false);
    }
  };

  
const raiseAutomaticSOS = async () => {
  if (autoSosTriggered.current || currentUser?.role !== "user") return;

  const token = localStorage.getItem("authToken");
  if (!token) {
    setSosMessage("Automatic SOS needs a logged-in user account.");
    return;
  }

  autoSosTriggered.current = true;
  try {
    const response = await fetch("/api/alerts/raise/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        description: "AUTOMATED SIMULATION: possible fall detected by simulated sensor.",
        latitude: Number(simulatedLocationRef.current.latitude),
        longitude: Number(simulatedLocationRef.current.longitude),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      autoSosTriggered.current = false;
      throw new Error(data.error || data.detail || "Automatic SOS failed.");
    }

    setSosActive(true);
    setEmergencyId(data.emergency_id);
    setSosMessage(`Simulated fall triggered SOS #${data.emergency_id}.`)
  } catch (err) {
    setSosMessage(err.message || "Automatic SOS failed.");
  }
};

const simulateSensor = async (scenario) => {
  const readings = {
    normal: {
      acceleration_x: Number((Math.random() * 1.4 - 0.7).toFixed(2)),
      acceleration_y: Number((Math.random() * 1.4 - 0.7).toFixed(2)),
      acceleration_z: Number((9.5 + Math.random() * 0.6).toFixed(2)),
      gyro_x: Number((Math.random() * 0.5).toFixed(2)),
      gyro_y: Number((Math.random() * 0.5).toFixed(2)),
      gyro_z: Number((Math.random() * 0.5).toFixed(2)),
    },
    impact: {
      acceleration_x: 8.5,
      acceleration_y: 7.5,
      acceleration_z: 10.0,
      gyro_x: 2.4,
      gyro_y: 1.8,
      gyro_z: 2.0,
    },
    fall: {
      acceleration_x: 12.0,
      acceleration_y: 10.0,
      acceleration_z: 11.0,
      gyro_x: 4.0,
      gyro_y: 3.0,
      gyro_z: 5.0,
    },
  };

  if (!readings[scenario]) return;
  setSimulationLoading(true);
  setSimulationMessage("");

  try {
    const response = await fetch("/api/sensor-data/send/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "TRACKER001-SIM", ...readings[scenario] }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Unable to submit simulated reading.");
    }

    // Update immediately so the dashboard does not wait for the next poll.
    setSensorData((previous) => {
      const oldRecords = Array.isArray(previous)
        ? previous
        : Array.isArray(previous?.results)
          ? previous.results
          : [];
      const next = [{ ...data }, ...oldRecords.filter((item) => item.id !== data.id)];
      return Array.isArray(previous?.results) ? { ...previous, results: next } : next;
    });
    setFallDetected(Boolean(data.possible_fall));
    setSimulationMessage(
      `${scenario.toUpperCase()} reading submitted. Magnitude: ${Number(data.acceleration_magnitude).toFixed(2)}. ` +
      `${data.possible_fall ? "Possible fall detected." : "Below fall threshold."}`
    );

    if (scenario === "fall" && autoSimulation) {
      await raiseAutomaticSOS();
    }
  } catch (err) {
    setSimulationMessage(err.message || "Simulation failed.");
  } finally {
    setSimulationLoading(false);
  }
};

  const fetchActiveEmergencies = async () => {
  if (!isApprovedVolunteer) return;

  const token = localStorage.getItem("authToken");
  if (!token) return;

  setEmergenciesLoading(true);

  try {
    const response = await fetch("/api/alerts/active/", {
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || data.error || "Unable to load emergency alerts."
      );
    }

    setActiveEmergencies(Array.isArray(data) ? data : data.results || []);
    setVolunteerMessage("");
  } catch (err) {
    setVolunteerMessage(err.message || "Could not load emergency alerts.");
  } finally {
    setEmergenciesLoading(false);
  }
  };
  useEffect(() => {
    fetchSensorData();
    const interval = setInterval(fetchSensorData, 5000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
  if (!isApprovedVolunteer) {
    setActiveEmergencies([]);
    return;
  }

  fetchActiveEmergencies();

  const interval = setInterval(fetchActiveEmergencies, 5000);
  return () => clearInterval(interval);
  }, [isApprovedVolunteer]);

  const handleSOS = async () => {
    if (sosLoading || sosActive) return;
    if (currentUser?.role !== "user") {
      setSosMessage("SOS alerts are available to registered user accounts.");
      return;
    
    }
    const token = localStorage.getItem("authToken");
    if (!token) {
      setSosMessage("Please log in before raising an SOS alert.");
      return;
    }
    setSosLoading(true);
    setSosMessage("");
    try {
      const response = await fetch("/api/alerts/raise/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({
          description: "SOS raised from the SAFEGUARD dashboard.",
          latitude: Number(simulatedLocationRef.current.latitude),
          longitude: Number(simulatedLocationRef.current.longitude),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detail || "Unable to raise SOS.");
      setSosActive(true);
      setEmergencyId(data.emergency_id);
        setSosMessage(`SOS sent successfully. Emergency ID: ${data.emergency_id}`);
    } catch (err) {
      setSosMessage(err.message || "Unable to connect to the SOS API.");
    } finally {
      setSosLoading(false);
    }
  };
  
const handleCancelSOS = async () => {
  if (sosLoading) return;

  if (!emergencyId) {
    setSosMessage("No emergency ID is available to cancel.");
    window.alert("No active SOS found to cancel.");
    return;
  }

  const token = localStorage.getItem("authToken");

  if (!token) {
    setSosMessage("Please log in again before cancelling SOS.");
    window.alert("Please log in again before cancelling SOS.");
    return;
  }

  // Ask for confirmation before cancelling.
  const confirmed = window.confirm(
    `Are you sure you want to cancel Emergency #${emergencyId}?`
  );

  if (!confirmed) return;

  setSosLoading(true);
  setSosMessage("");

  try {
    const response = await fetch(
      `/api/alerts/${emergencyId}/cancel/`,
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
        data.error || data.detail || "Unable to cancel SOS."
      );
    }

    // Update the interface only after the backend confirms success.
    setSosActive(false);
    setEmergencyId(null);
    setSosMessage(
      `Emergency #${data.emergency_id} cancelled successfully.`
    );

    autoSosTriggered.current = false;

    // Show success popup.
    window.alert(
      `SOS CANCELLED SUCCESSFULLY!\n\nEmergency #${data.emergency_id} has been cancelled.`
    );
  } catch (err) {
    const errorMessage =
      err.message || "Unable to cancel SOS.";

    setSosMessage(errorMessage);
    window.alert(`Cancellation failed!\n\n${errorMessage}`);
  } finally {
    setSosLoading(false);
  }
};

  const handleAcceptEmergency = async (id) => {
  if (acceptingEmergencyId !== null) return;

  const token = localStorage.getItem("authToken");
  if (!token) {
    setVolunteerMessage("Please log in again.");
    return;
  }

  setAcceptingEmergencyId(id);
  setVolunteerMessage("");

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
        data.detail || data.error || "Unable to accept this emergency."
      );
    }

    setActiveEmergencies((previous) =>
      previous.filter((emergency) => emergency.id !== id)
    );

    setVolunteerMessage(`Emergency #${id} accepted successfully.`);
    fetchActiveEmergencies();
  } catch (err) {
    setVolunteerMessage(err.message || "Could not accept the emergency.");
    fetchActiveEmergencies();
  } finally {
    setAcceptingEmergencyId(null);
  }
};

const handleLogout = () => {
  // Logging out must NOT cancel an SOS in the database.
  ["authToken", "username", "role", "volunteerStatus"].forEach((key) => {
    localStorage.removeItem(key);
  });

  setCurrentUser(null);
  setShowLanding(true);
  setShowRegister(false);
  setSosMessage("");
};


  const sensor = getLatestRecord(sensorData);
  const safety = getSafetyStatus(sensor);
  const magnitude = getAccelerationMagnitude(sensor);
  const vibration = sensor ? magnitude.toFixed(2) : "--";
  const goTo = (id) => {
  if (id === "profile") {
    setShowProfile(true);
    setActiveSection("profile");
    return;
  }

  setShowProfile(false);
  setActiveSection(id);

  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

  // All hooks must remain above conditional returns.
  useEffect(() => {
    if (!autoSimulation || currentUser?.role !== "user") return;

    autoSosTriggered.current = false;
    const interval = setInterval(() => {
      simulationTick.current += 1;
      const step = simulationTick.current;
      // Jury demo cycle: three normal readings followed by one fall reading.
      const scenario = step % 4 === 0 ? "fall" : "normal";
      setSimulationScenario(scenario);

      // Simulate a small movement along a route near the demo starting point.
      const latitude = 12.9716 + Math.sin(step / 5) * 0.0012;
      const longitude = 77.5946 + Math.cos(step / 5) * 0.0012;
      const nextLocation = { latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
      simulatedLocationRef.current = nextLocation;
      setSimulatedLocation(nextLocation);

      void simulateSensor(scenario);
    }, 3000);

    return () => clearInterval(interval);
  }, [autoSimulation, currentUser?.role]);

  if (!currentUser) {
  if (showLanding) {
    return (
      <LandingPage
        onGetStarted={() => setShowLanding(false)}
      />
    );
  }

  if (showRegister) {
    return (
      <Register
        onRegistered={() => setShowRegister(false)}
        onShowLogin={() => setShowRegister(false)}
      />
    );
  }

  return (
    <Login
      onLogin={setCurrentUser}
      onShowRegister={() => setShowRegister(true)}
    />
  );
}
  if (showProfile && currentUser.role === "user") {
  return (
    <Profile
      onBack={() => {
        setShowProfile(false);
        setActiveSection("dashboard");
      }}
    />
  );
}
  if (
    currentUser.role === "volunteer" &&
    currentUser.volunteer_status === "approved"
  ) {
    return (
      <VolunteerDashboard
       currentUser={currentUser}
       onLogout={handleLogout}
     />
    );
  }
  if (currentUser.role === "parent") {
  return (
    <ParentDashboard
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
}
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
        <div className="brand-logo">
         <span>✳</span>
       </div>
    <div>
    <strong>SAFEGUARD<span className="brand-dot">.</span></strong>
    <small>INTELLIGENT SAFETY SYSTEM</small>
  </div>
</div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavButton active={activeSection === "dashboard"} onClick={() => goTo("dashboard")} icon="▦">Dashboard</NavButton>
          <NavButton
  active={activeSection === "profile"}
  onClick={() => goTo("profile")}
  icon="♙"
>
  My Profile
</NavButton>
          <NavButton active={activeSection === "location"} onClick={() => goTo("location")} icon="⌖">Live Location</NavButton>
          <NavButton active={activeSection === "alerts"} onClick={() => goTo("alerts")} icon="♧">Emergency Alerts</NavButton>
          <NavButton active={activeSection === "sensors"} onClick={() => goTo("sensors")} icon="⌁">Sensor Monitoring</NavButton>
          <NavButton active={activeSection === "history"} onClick={() => goTo("history")} icon="◷">Alert History</NavButton>
          <NavButton active={activeSection === "device"} onClick={() => goTo("device")} icon="▣">Device</NavButton>
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-logout" onClick={handleLogout}><span>↪</span> Log out</button>
      </aside>

      <main className="main-area" id="dashboard">
        <header className="topbar">
          <div><div className="breadcrumb">WORKSPACE <span>/</span> OVERVIEW</div><h1>Dashboard</h1><p className="page-subtitle">Real-time environmental and safety monitoring</p></div>
          <div className="topbar-right"><div className={`system-pill ${error ? "is-offline" : ""}`}><span className="system-dot" />{error ? "Sensor API Offline" : "System Online"}</div><div className="user-chip"><div className="avatar">{(currentUser.username || "U").slice(0,1).toUpperCase()}</div><div><strong>{currentUser.username}</strong><small>{currentUser.role || "User"} account</small></div></div></div>
        </header>

        {error && <div className="connection-banner"><span>!</span><div><strong>Sensor connection issue</strong><p>{error}. The dashboard will retry automatically.</p></div></div>}

        <section className="metric-grid" aria-label="Safety metrics">
          <MetricCard tone="coral" icon="♨" label="Temperature" value={loading ? "--" : "28.5 °C"} status="Demo value" caption="Environmental reading" />
          <MetricCard tone="blue" icon="◖))" label="Sound Level" value={loading ? "--" : "52 dB"} status="Demo value" caption="Ambient sound level" />
          <MetricCard tone="violet" icon="⌁" label="Vibration" value={vibration} status={sensor ? "Sensor data" : "Waiting"} caption="Acceleration magnitude" />
          <MetricCard tone={safety.status === "DANGER" ? "coral" : "mint"} icon="✓" label="Safety Status" value={safety.status} status={safety.status === "SAFE" ? "Within range" : "Check reading"} caption={safety.message} />
        </section>

        <section className="primary-grid">
          {isApprovedVolunteer && (
            <article className="panel volunteer-panel" id="volunteer-inbox">
              <div className="panel-heading">
                <div className="heading-icon red-icon">♧</div>
                <div>
                  <h2>Volunteer Emergency Inbox</h2>
                  <p>Active SOS alerts awaiting a response</p>
                </div>
                <span className="panel-kicker">
                  {activeEmergencies.length} ACTIVE
                </span>
              </div>

              {volunteerMessage && (
                <p className="inline-feedback" role="status">
                 {volunteerMessage}
               </p>
          )}

    {emergenciesLoading && activeEmergencies.length === 0 ? (
      <p>Loading emergency alerts…</p>
    ) : activeEmergencies.length === 0 ? (
      <p className="volunteer-empty">
        No unassigned emergencies right now. This inbox refreshes every
        5 seconds.
      </p>
    ) : (
      <div className="volunteer-emergency-list">
        {activeEmergencies.map((emergency) => (
          <div className="volunteer-emergency" key={emergency.id}>
            <div>
              <strong>Emergency #{emergency.id}</strong>
              <p>
                {emergency.description || "No additional details provided."}
              </p>
              <small>
                Status: {emergency.status}
                {emergency.created_at &&
                  ` · ${new Date(emergency.created_at).toLocaleString()}`}
              </small>

              {emergency.latitude != null &&
                emergency.longitude != null && (
                  <p>
                    Location: {emergency.latitude}, {emergency.longitude}
                  </p>
                )}
            </div>

            <button
              className="accept-emergency-button"
              onClick={() => handleAcceptEmergency(emergency.id)}
              disabled={acceptingEmergencyId !== null}
            >
              {acceptingEmergencyId === emergency.id
                ? "ACCEPTING…"
                : "ACCEPT ALERT"}
            </button>
          </div>
        ))}
      </div>
    )}
  </article>
)}
          
<article className="panel sos-panel" id="alerts">
  <div className="panel-heading">
    <div className="heading-icon red-icon">♧</div>
    <div>
      <h2>Emergency SOS</h2>
      <p>Send an emergency alert to the response system.</p>
    </div>
    <span className="panel-kicker">SOS</span>
  </div>

  <button
    className={`sos-button ${sosActive ? "sos-active" : ""}`}
    onClick={handleSOS}
    disabled={
      sosLoading ||
      sosActive ||
      currentUser.role !== "user"
    }
  >
    <span className="sos-symbol">♧</span>
    {sosLoading
      ? "SENDING ALERT…"
      : sosActive
      ? "SOS ALERT SENT"
      : "ACTIVATE EMERGENCY SOS"}
  </button>

  <div className={`sos-status-line ${sosActive ? "sent" : ""}`}>
    <span className="status-bullet" />
    {sosActive
      ? `Emergency #${emergencyId} created`
      : currentUser.role !== "user"
      ? "SOS is available to user accounts"
      : "No active emergency signal"}
  </div>

  {sosActive && (
    <button
      type="button"
      onClick={handleCancelSOS}
      disabled={sosLoading}
      style={{
        marginTop: "12px",
        width: "100%",
        padding: "12px 16px",
        borderRadius: "10px",
        border: "1px solid #fecaca",
        background: "#fff1f2",
        color: "#be123c",
        fontWeight: 700,
        cursor: sosLoading ? "not-allowed" : "pointer",
      }}
    >
      {sosLoading ? "PLEASE WAIT…" : "CANCEL SOS"}
    </button>
  )}

  {sosMessage && (
    <p className="inline-feedback" role="status">
      {sosMessage}
    </p>
  )}

  <p className="sos-footnote">
    Prototype only. Automatic simulated falls can create an SOS record
    for the logged-in user.
  </p>
</article>

          <article className="panel fall-panel">
            <div className="panel-heading"><div className="heading-icon blue-icon">↯</div><div><h2>Fall Detection</h2><p>Accelerometer-based impact indicator</p></div><span className={`status-tag ${fallDetected ? "tag-danger" : "tag-safe"}`}>{fallDetected ? "ALERT" : sensor ? "MONITORING" : "NO DATA"}</span></div>
            <div className={`fall-banner ${fallDetected ? "fall-banner-danger" : ""}`}><div className="fall-pulse">{fallDetected ? "!" : "✓"}</div><div><strong>{fallDetected ? "Potential fall detected" : sensor ? "No fall detected" : "Waiting for sensor data"}</strong><p>{fallDetected ? "Review the movement reading and check on the person." : "Movement is below the configured fall threshold."}</p></div></div>
            <div className="fall-stats"><div><span>Acceleration magnitude</span><strong>{magnitude.toFixed(2)}</strong></div><div><span>Demo threshold</span><strong>18.00</strong></div></div>
            <p className="fine-print">Prototype indicator only; not a certified emergency detection system.</p>
          </article>

          
<article className="panel simulation-panel" id="simulation">
  <div className="panel-heading">
    <div className="heading-icon blue-icon">⌁</div>
    <div>
      <h2>Hardware Simulator</h2>
      <p>Automatic simulated sensors, GPS movement, fall detection and SOS alerts.</p>
    </div>
    <span className="status-tag tag-demo">SIMULATION</span>
  </div>

  <div className="simulation-actions">
    
<button
  type="button"
  onClick={() => setAutoSimulation((previous) => !previous)}
  style={{
    background: autoSimulation ? "#fff1f2" : "#eafaf3",
    color: autoSimulation ? "#be123c" : "#047857",
    border: "1px solid",
    borderColor: autoSimulation ? "#fecdd3" : "#a7f3d0",
  }}
>
  {autoSimulation
    ? "Stop Automatic Simulation"
    : "Start Automatic Simulation"}
</button>

  </div>

  <p className="fine-print">Automatic mode: {autoSimulation ? "RUNNING" : "STOPPED"} · New simulated reading every 3 seconds.</p>

  {simulationLoading && <p>Submitting simulated reading…</p>}

  {simulationMessage && (
    <p className="inline-feedback" role="status">
      {simulationMessage}
    </p>
  )}

  <p className="fine-print">
    Test data only. GPS and SMS are simulated; no physical sensor or SMS service is connected.
  </p>
</article>

          <article className="panel location-panel" id="location">
            <div className="panel-heading"><div className="heading-icon blue-icon">⌖</div><div><h2>Live Location</h2><p>Location preview</p></div><span className="status-tag tag-demo">SIMULATED</span></div>
            <div className="map-preview" role="img" aria-label="Illustrative map preview; no live GPS coordinates connected"><div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" /><div className="map-park park-a" /><div className="map-park park-b" /><div className="map-pin">●</div><span className="map-label label-a">PARK</span><span className="map-label label-b">MAIN ROAD</span><div className="map-overlay-note">SIMULATED GPS</div></div>
            <div className="location-details"><span>GPS status</span><strong>{autoSimulation ? "Simulating movement" : "Simulation ready"}</strong></div><div className="location-details"><span>Latitude</span><strong>{simulatedLocation.latitude}</strong></div><div className="location-details"><span>Longitude</span><strong>{simulatedLocation.longitude}</strong></div><p className="fine-print">Demo coordinates only; this is not live GPS.</p>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel chart-panel" id="sensors"><div className="panel-heading"><div className="heading-icon blue-icon">⌁</div><div><h2>Sensor Readings</h2><p>Latest accelerometer values</p></div><span className="chart-live">{sensor ? "LATEST RECORD" : "WAITING"}</span></div><div className="chart-legend"><span><i className="legend-blue" />X axis</span><span><i className="legend-violet" />Y axis</span><span><i className="legend-teal" />Z axis</span></div><SensorChart sensor={sensor} /><div className="chart-footer"><span>Device: {sensor?.device_id || "TRACKER001"}</span><span>Updated: {getLatestTime(sensorData)}</span></div></article>
          <article className="panel recent-panel" id="history"><div className="panel-heading"><div className="heading-icon red-icon">♧</div><div><h2>Recent Alerts</h2><p>Current sensor assessment</p></div></div><div className="alert-list">
            {error ? <AlertRow icon="!" tone="coral" title="Sensor API unavailable" detail="Check the backend connection" time="Now" /> : fallDetected ? <AlertRow icon="!" tone="coral" title="Potential fall detected" detail={`Magnitude ${magnitude.toFixed(2)} reached the demo threshold`} time="Now" /> : safety.status === "WARNING" || safety.status === "DANGER" ? <AlertRow icon="!" tone="amber" title={`${safety.status} movement reading`} detail={safety.message} time="Now" /> : <AlertRow icon="✓" tone="mint" title="No current movement alert" detail={sensor ? "Latest reading is below configured thresholds" : "Waiting for sensor readings"} time={sensor ? "Latest" : "Pending"} />}
            {sosActive && <AlertRow icon="SOS" tone="coral" title="SOS alert created" detail={`Emergency ID ${emergencyId}`} time="This session" />}
            <AlertRow icon="↻" tone="blue" title="Monitoring active" detail="Sensor endpoint refreshes every 5 seconds" time="Live" />
          </div><p className="fine-print">Current session summary; persistent alert history is not connected yet.</p></article>
          <article className="panel device-panel" id="device"><div className="panel-heading"><div className="heading-icon blue-icon">▣</div><div><h2>Device Information</h2><p>Tracker status overview</p></div></div><div className="device-grid"><DeviceTile icon="▣" label="Device ID" value={sensor?.device_id || "TRACKER001"} /><DeviceTile icon="⌁" label="Controller" value="ESP32-S3" /><DeviceTile icon="◉" label="Sensor API" value={error ? "Offline" : loading ? "Connecting…" : "Reachable"} tone={error ? "coral" : "mint"} /><DeviceTile icon="◷" label="Refresh interval" value="5 seconds" /></div></article>
          <article className="panel score-panel"><div className="panel-heading"><div className="heading-icon blue-icon">✦</div><div><h2>Safety Overview</h2><p>Rule-based status, not a validated score</p></div></div><div className="score-content"><div className={`score-ring ${safety.status === "DANGER" ? "score-ring-danger" : ""}`}><div><strong>{safety.status === "SAFE" ? "OK" : safety.status === "NO DATA" ? "--" : "!"}</strong><span>{safety.status}</span></div></div><div className="score-summary"><strong>{safety.status === "SAFE" ? "Within configured range" : safety.status === "NO DATA" ? "Waiting for readings" : "Attention recommended"}</strong><p>{safety.message}</p><div className="score-track"><span style={{ width: safety.status === "SAFE" ? "100%" : safety.status === "NO DATA" ? "8%" : "35%" }} /></div><small>Based on current accelerometer magnitude</small></div></div></article>
          <article className="panel quick-panel"><div className="panel-heading"><div className="heading-icon blue-icon">✦</div><div><h2>Quick Actions</h2><p>Jump to a dashboard section</p></div></div><div className="quick-actions"><button onClick={() => goTo("location")}><span>⌖</span><strong>Location</strong><small>View preview</small></button><button onClick={() => goTo("alerts")}><span className="quick-red">♧</span><strong>Emergency</strong><small>SOS panel</small></button><button onClick={() => goTo("history")}><span>◷</span><strong>Alert status</strong><small>View current</small></button><button onClick={() => goTo("device")}><span>▣</span><strong>Device</strong><small>Device details</small></button></div></article>
        </section>
        <footer className="dashboard-footer"><span>SAFEGUARD</span><span>Prototype dashboard · Sensor refresh every 5 seconds</span></footer>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, children }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span>{icon}</span>{children}</button>;
}
function MetricCard({ tone, icon, label, value, status, caption }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-top"><div className="metric-icon">{icon}</div><span className="metric-status">{status}</span></div><p className="metric-label">{label}</p><strong className="metric-value">{value}</strong><p className="metric-caption">{caption}</p><div className="metric-decoration" /></article>;
}
function AlertRow({ icon, tone, title, detail, time }) {
  return <div className="alert-row"><div className={`alert-icon alert-${tone}`}>{icon}</div><div className="alert-copy"><strong>{title}</strong><p>{detail}</p></div><time>{time}</time></div>;
}
function DeviceTile({ icon, label, value, tone = "blue" }) {
  return <div className="device-tile"><div className={`device-icon device-${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>;
}
function SensorChart({ sensor }) {
  const values = sensor ? [Number(sensor.acceleration_x || 0), Number(sensor.acceleration_y || 0), Number(sensor.acceleration_z || 0)] : [0, 0, 0];
  const max = Math.max(2, ...values.map(v => Math.abs(v))) * 1.25;
  const paths = values.map((value, i) => {
    const y = 65 - (value / max) * 42;
    const baseline = 62 + i * 3;
    return `M 12 ${baseline} C 48 ${baseline - 8}, 60 ${y}, 95 ${y} S 150 ${baseline + 8}, 190 ${baseline} S 245 ${y - 5}, 290 ${y} S 345 ${baseline - 4}, 388 ${baseline}`;
  });
  return <div className="chart-wrap"><div className="chart-y-labels"><span>{max.toFixed(1)}</span><span>{(max / 2).toFixed(1)}</span><span>0</span><span>{(-max / 2).toFixed(1)}</span><span>{(-max).toFixed(1)}</span></div><svg className="sensor-chart" viewBox="0 0 400 130" role="img" aria-label="Trend illustration derived from the latest sensor values; historical samples are unavailable">{[20,42,64,86,108].map(y => <line key={y} x1="10" y1={y} x2="390" y2={y} className="chart-gridline" />)}{[20,95,170,245,320,390].map(x => <line key={x} x1={x} y1="10" x2={x} y2="112" className="chart-gridline vertical" />)}{paths.map((path,i) => <path key={i} d={path} className={`chart-line chart-line-${i}`} />)}</svg><div className="chart-x-labels"><span>Latest</span><span>Accelerometer</span><span>Sample</span></div></div>;
}
function getLatestRecord(data) {
  if (!data) return null;
  if (Array.isArray(data.results)) return data.results[0] || null;
  if (Array.isArray(data)) return data[0] || null;
  return data;
}
function getLatestTime(data) {
  const record = getLatestRecord(data);
  if (!record) return "--";
  const time = record.timestamp || record.created_at || record.created || record.date;
  return time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
}
function getSafetyStatus(sensor) {
  if (!sensor) return { status: "NO DATA", className: "unknown", message: "Waiting for sensor data" };
  const ax = Number(sensor.acceleration_x || 0), ay = Number(sensor.acceleration_y || 0), az = Number(sensor.acceleration_z || 0);
  const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
  if (magnitude > 12) return { status: "DANGER", className: "danger", message: "Possible high-impact movement detected" };
  if (magnitude > 10.5) return { status: "WARNING", className: "warning", message: "Unusual movement detected" };
  return { status: "SAFE", className: "safe", message: "Normal movement detected" };
}
function detectFall(sensor) {
  if (!sensor) return false;
  const ax = Number(sensor.acceleration_x || 0), ay = Number(sensor.acceleration_y || 0), az = Number(sensor.acceleration_z || 0);
  return Math.sqrt(ax * ax + ay * ay + az * az) >= 18;
}
function getAccelerationMagnitude(sensor) {
  if (!sensor) return 0;
  const ax = Number(sensor.acceleration_x || 0), ay = Number(sensor.acceleration_y || 0), az = Number(sensor.acceleration_z || 0);
  return Math.sqrt(ax * ax + ay * ay + az * az);
}
export default App;
