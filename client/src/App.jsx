import React, { useEffect, useRef, useState } from "react";
import EmergencyMap from "./EmergencyMap";
import "./App.css";

// CHANGE THESE IF YOUR BACKEND USES ANOTHER PORT OR ROUTE
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const ANALYZE_PATH = "/api/analyze";

const STORAGE_KEY = "saferoute-incidents";

const DEFAULT_LOCATION = {
  latitude: 17.385,
  longitude: 78.4867,
};

function readIncidents() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function fallbackAnalysis(description = "", source = "manual") {
  if (source === "guardian") {
    return {
      type: "Missed Safety Check-in",
      severity: "high",
      responders: ["Emergency Response Team"],
      reason: "The user missed three safety warnings.",
      advice: ["Verify the user's safety and last known location."],
      analyzedBy: "guardian",
    };
  }

  const text = description.toLowerCase();
  const responders = new Set();
  const categories = [];

  const fire =
    /\b(fire|smoke|flames|burning|explosion)\b/.test(text) &&
    !/\b(no fire|not a fire|no smoke)\b/.test(text);

  const medical =
    /\b(unconscious|fainted|collapsed|heart attack|not breathing|struggling to breathe|injured|bleeding|medical)\b/.test(
      text
    );

  const accident =
    /\b(accident|crash|collision|vehicle accident)\b/.test(text);

  const crime =
    /\b(attack|robbery|assault|violence|kidnap|threatening|stabbing)\b/.test(
      text
    );

  if (fire) {
    categories.push("Fire");
    responders.add("Fire Department");
  }

  if (medical) {
    categories.push("Medical");
    responders.add("Ambulance");
  }

  if (accident) {
    categories.push("Road Accident");
    responders.add("Police");
    responders.add("Ambulance");
  }

  if (crime) {
    categories.push("Security");
    responders.add("Police");
  }

  if (responders.size === 0) {
    responders.add("Emergency Response Team");
  }

  return {
    type:
      categories.length > 0
        ? `${categories.join(" + ")} Emergency`
        : "General Emergency",
    severity: fire || medical ? "critical" : "high",
    responders: [...responders],
    reason: "Basic rule-based classification; AI unavailable.",
    advice: [],
    analyzedBy: "fallback",
  };
}

async function analyzeEmergency(description, source = "manual") {
  if (source === "guardian") {
    return fallbackAnalysis(description, source);
  }

  try {
    const response = await fetch(
      `${API_BASE}${ANALYZE_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description }),
      }
    );

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const data = await response.json();

    const result = data.analysis || data;

    const responders =
      result.responders ||
      result.suggestedResponders ||
      [];

    if (!Array.isArray(responders) || responders.length === 0) {
      throw new Error("Invalid AI response");
    }

    const allowedSeverities = [
      "low",
      "medium",
      "high",
      "critical",
    ];

    const severity = String(
      result.severity || "high"
    ).toLowerCase();

    return {
      type:
        result.type ||
        result.emergencyType ||
        result.category ||
        "General Emergency",
      severity: allowedSeverities.includes(severity)
        ? severity
        : "high",
      responders,
      reason:
        result.reason ||
        result.explanation ||
        "AI analyzed the reported situation.",
      advice: Array.isArray(result.advice)
        ? result.advice
        : [],
      analyzedBy: "gemini",
    };
  } catch (error) {
    console.error("Gemini analysis unavailable:", error);
    return fallbackAnalysis(description, source);
  }
}

function playGuardianAlarm() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.12;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);

    oscillator.onended = () => {
      context.close().catch(() => {});
    };
  } catch (error) {
    console.error("Alarm unavailable:", error);
  }
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
}

function normalizeStoredIncident(incident) {
  return {
    ...incident,
    responders: Array.isArray(incident.responders)
      ? incident.responders
      : Array.isArray(incident.suggestedResponders)
      ? incident.suggestedResponders
      : ["Emergency Response Team"],
    advice: Array.isArray(incident.advice)
      ? incident.advice
      : [],
  };
}

export default function App() {
  const [page, setPage] = useState("home");

  const [incidents, setIncidents] = useState(() =>
    readIncidents().map(normalizeStoredIncident)
  );

  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const [location, setLocation] = useState(DEFAULT_LOCATION);

  const locationRef = useRef(DEFAULT_LOCATION);

  const [guardianActive, setGuardianActive] = useState(false);
  const [guardianEscalating, setGuardianEscalating] =
    useState(false);

  const [guardianAlertCount, setGuardianAlertCount] =
    useState(0);

  const [guardianDuration, setGuardianDuration] = useState(1);
  const [guardianUnit, setGuardianUnit] = useState("minutes");

  const [guardianRemaining, setGuardianRemaining] =
    useState(60);

  const [guardianMessage, setGuardianMessage] = useState("");

  const guardianDeadlineRef = useRef(null);
  const guardianTimersRef = useRef([]);
  const guardianCancelledRef = useRef(true);
  const guardianExpiredRef = useRef(false);
  const guardianSOSCreatedRef = useRef(false);
  const guardianSessionRef = useRef(0);
  const guardianActiveRef = useRef(false);
  const guardianDurationRef = useRef(60);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(incidents)
    );
  }, [incidents]);

  function getLocation() {
    if (!navigator.geolocation) {
      setMessage("GPS unavailable. Using demo location.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const updated = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        locationRef.current = updated;
        setLocation(updated);

        setMessage("📍 GPS location updated.");
      },
      () => {
        setMessage(
          "GPS permission unavailable. Using demo location."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function createSOS(source = "manual") {
    const emergencyText =
      source === "guardian"
        ? "Possible emergency: user missed Guardian safety check-in after three warnings."
        : description.trim() || "Emergency SOS activated.";

    if (source === "manual") {
      setAnalyzing(true);
      setMessage("🧠 Analyzing emergency with AI...");
    }

    let detected;

    try {
      detected = await analyzeEmergency(
        emergencyText,
        source
      );
    } finally {
      if (source === "manual") {
        setAnalyzing(false);
      }
    }

    const currentLocation = locationRef.current;

    const incident = {
      id: `demo-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,

      type: detected.type,
      category: detected.type,
      severity: detected.severity,

      responders: detected.responders,
      suggestedResponders: detected.responders,

      reason: detected.reason,
      advice: detected.advice,
      analyzedBy: detected.analyzedBy,

      source,
      status: "new",

      description: emergencyText,

      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,

      location: `${currentLocation.latitude}, ${currentLocation.longitude}`,

      createdAt: new Date().toISOString(),

      simulated: true,
      verificationStatus: "unconfirmed",
      notificationStatus: "demo-notified",
    };

    setIncidents((previous) => [incident, ...previous]);

    setMessage(
      `🚨 ${detected.type} — Suggested responders: ${detected.responders.join(
        ", "
      )}. Demo alert created.`
    );

    return incident;
  }

  function updateIncidentStatus(id, status) {
    setIncidents((previous) =>
      previous.map((incident) =>
        incident.id === id
          ? { ...incident, status }
          : incident
      )
    );
  }

  function clearGuardianTimers() {
    guardianTimersRef.current.forEach(clearTimeout);
    guardianTimersRef.current = [];
  }

  function cancelGuardianEscalation() {
    guardianSessionRef.current += 1;
    guardianCancelledRef.current = true;
    guardianActiveRef.current = false;
    guardianDeadlineRef.current = null;

    clearGuardianTimers();
  }

  function scheduleNextCheckIn() {
    clearGuardianTimers();

    guardianSessionRef.current += 1;
    guardianCancelledRef.current = false;
    guardianActiveRef.current = true;
    guardianExpiredRef.current = false;
    guardianSOSCreatedRef.current = false;

    const seconds = guardianDurationRef.current;

    guardianDeadlineRef.current =
      Date.now() + seconds * 1000;

    setGuardianRemaining(seconds);
    setGuardianEscalating(false);
    setGuardianAlertCount(0);
    setGuardianActive(true);

    setGuardianMessage(
      "🛡️ Guardian monitoring active. Your next safety check-in is scheduled."
    );
  }

  function startGuardian() {
    const amount = Math.max(
      1,
      Number(guardianDuration) || 1
    );

    const seconds =
      guardianUnit === "hours"
        ? amount * 3600
        : amount * 60;

    guardianDurationRef.current = seconds;

    scheduleNextCheckIn();
  }

  function confirmSafe() {
    if (!guardianActiveRef.current) return;

    scheduleNextCheckIn();

    setGuardianMessage(
      "✅ Safety confirmed! Monitoring continues. Next check-in timer started."
    );
  }

  function stopGuardian() {
    cancelGuardianEscalation();

    setGuardianActive(false);
    setGuardianEscalating(false);
    setGuardianAlertCount(0);
    setGuardianRemaining(0);

    setGuardianMessage(
      "Guardian Mode stopped. No further demo alerts will be created."
    );
  }

  function startGuardianEscalation() {
    if (
      guardianCancelledRef.current ||
      !guardianActiveRef.current
    ) {
      return;
    }

    const session = guardianSessionRef.current;

    const isCurrentSession = () =>
      guardianSessionRef.current === session &&
      !guardianCancelledRef.current &&
      guardianActiveRef.current;

    setGuardianEscalating(true);
    setGuardianAlertCount(1);

    playGuardianAlarm();

    setGuardianMessage(
      "⚠️ Alert 1/3: Safety check-in due. Click I'm Safe!"
    );

    const secondAlarm = setTimeout(() => {
      if (!isCurrentSession()) return;

      setGuardianAlertCount(2);
      playGuardianAlarm();

      setGuardianMessage(
        "⚠️ Alert 2/3: Please confirm you are safe!"
      );
    }, 15000);

    const thirdAlarm = setTimeout(() => {
      if (!isCurrentSession()) return;

      setGuardianAlertCount(3);
      playGuardianAlarm();

      setGuardianMessage(
        "🚨 Alert 3/3: Final warning! Demo SOS in 15 seconds."
      );
    }, 30000);

    const automaticSOS = setTimeout(async () => {
      if (
        !isCurrentSession() ||
        guardianSOSCreatedRef.current
      ) {
        return;
      }

      guardianSOSCreatedRef.current = true;

      // Stop monitoring before creating the incident.
      cancelGuardianEscalation();

      setGuardianActive(false);
      setGuardianEscalating(false);
      setGuardianAlertCount(0);

      await createSOS("guardian");

      setGuardianMessage(
        "🚨 No safety confirmation received. Automatic demo SOS created."
      );
    }, 45000);

    guardianTimersRef.current = [
      secondAlarm,
      thirdAlarm,
      automaticSOS,
    ];
  }

  useEffect(() => {
    if (!guardianActive) return;

    const timer = setInterval(() => {
      if (!guardianDeadlineRef.current) return;

      const remaining = Math.max(
        0,
        Math.ceil(
          (guardianDeadlineRef.current - Date.now()) /
            1000
        )
      );

      setGuardianRemaining(remaining);

      if (
        remaining === 0 &&
        !guardianExpiredRef.current
      ) {
        guardianExpiredRef.current = true;
        startGuardianEscalation();
      }
    }, 250);

    return () => clearInterval(timer);
  }, [guardianActive]);

  useEffect(() => {
    return () => {
      guardianSessionRef.current += 1;
      guardianTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Voice recognition is unavailable in this browser."
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      setDescription(event.results[0][0].transcript);

      setMessage(
        "🎤 Voice description captured successfully."
      );
    };

    recognition.onerror = () => {
      setMessage(
        "Voice recognition failed. Please try again."
      );
    };

    recognition.start();
  }

  const activeIncidents = incidents.filter(
    (incident) => incident.status !== "resolved"
  ).length;

  const resolvedIncidents = incidents.filter(
    (incident) => incident.status === "resolved"
  ).length;

  return (
    <div className="saferoute-app">
      <header className="sr-header">
        <div className="sr-header-inner">
          <div className="sr-brand">
            <div className="sr-brand-icon">🚨</div>

            <div>
              <h1>SafeRoute AI</h1>
              <span>
                Intelligent Emergency Response
              </span>
            </div>
          </div>

          <div className="sr-live-badge">
            <span className="sr-live-dot"></span>
            DEMO SYSTEM ONLINE
          </div>
        </div>

        <nav className="sr-nav">
          <button
            className={page === "home" ? "active" : ""}
            onClick={() => setPage("home")}
          >
            🏠 Home
          </button>

          <button
            className={page === "sos" ? "active" : ""}
            onClick={() => setPage("sos")}
          >
            🚨 Emergency SOS
          </button>

          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => setPage("dashboard")}
          >
            📊 Responder Dashboard
          </button>

          <button
            className={page === "guardian" ? "active" : ""}
            onClick={() => setPage("guardian")}
          >
            🛡️ Guardian Mode
          </button>
        </nav>
      </header>

      <main className="sr-main">
        {message && (
          <div className="sr-notification">
            <span>🔔</span>
            <span>{message}</span>

            <button onClick={() => setMessage("")}>
              ✕
            </button>
          </div>
        )}

        {page === "home" && (
          <>
            <section className="sr-hero">
              <div className="sr-hero-content">
                <div className="sr-hero-badge">
                  ✨ SMART SAFETY PLATFORM
                </div>

                <h2>
                  Your Safety.
                  <br />
                  <span>Our Priority.</span>
                </h2>

                <p>
                  Intelligent emergency reporting,
                  AI-assisted incident analysis,
                  responder suggestions, and
                  continuous personal safety monitoring.
                </p>

                <div className="sr-hero-actions">
                  <button
                    className="sr-btn sr-btn-danger"
                    onClick={() => setPage("sos")}
                  >
                    🚨 Report Emergency
                  </button>

                  <button
                    className="sr-btn sr-btn-outline"
                    onClick={() => setPage("guardian")}
                  >
                    🛡️ Activate Guardian
                  </button>
                </div>
              </div>

              <div className="sr-hero-visual">
                <div className="sr-shield">🛡️</div>
                <div className="sr-orbit sr-orbit-one"></div>
                <div className="sr-orbit sr-orbit-two"></div>
              </div>
            </section>

            <section className="sr-stats">
              <div className="sr-stat-card">
                <span>📋</span>
                <div>
                  <h3>{incidents.length}</h3>
                  <p>Total Incidents</p>
                </div>
              </div>

              <div className="sr-stat-card">
                <span>🚨</span>
                <div>
                  <h3>{activeIncidents}</h3>
                  <p>Active Emergencies</p>
                </div>
              </div>

              <div className="sr-stat-card">
                <span>✅</span>
                <div>
                  <h3>{resolvedIncidents}</h3>
                  <p>Resolved Cases</p>
                </div>
              </div>

              <div className="sr-stat-card">
                <span>🛡️</span>
                <div>
                  <h3>{guardianActive ? "ON" : "OFF"}</h3>
                  <p>Guardian Status</p>
                </div>
              </div>
            </section>

            <div className="sr-section-heading">
              <h2>Explore Safety Features</h2>
              <p>
                Everything you need for emergency
                preparedness.
              </p>
            </div>

            <section className="sr-feature-grid">
              <div className="sr-feature-card">
                <div className="sr-feature-icon red">
                  🚨
                </div>

                <h3>AI Emergency SOS</h3>

                <p>
                  Analyze emergency descriptions,
                  suggest responders, and record
                  incident locations.
                </p>

                <button onClick={() => setPage("sos")}>
                  Report Emergency →
                </button>
              </div>

              <div className="sr-feature-card">
                <div className="sr-feature-icon blue">
                  📊
                </div>

                <h3>Responder Dashboard</h3>

                <p>
                  View incident classifications,
                  suggested response teams, statuses,
                  and map locations.
                </p>

                <button
                  onClick={() => setPage("dashboard")}
                >
                  View Dashboard →
                </button>
              </div>

              <div className="sr-feature-card">
                <div className="sr-feature-icon purple">
                  🛡️
                </div>

                <h3>Continuous Guardian Mode</h3>

                <p>
                  Repeating check-ins, three warning
                  alarms, and automatic demo SOS
                  escalation.
                </p>

                <button
                  onClick={() => setPage("guardian")}
                >
                  Activate Guardian →
                </button>
              </div>
            </section>
          </>
        )}

        {page === "sos" && (
          <section className="sr-page-card">
            <div className="sr-page-heading">
              <div className="sr-heading-icon red">
                🚨
              </div>

              <div>
                <h2>Emergency SOS</h2>
                <p>
                  Describe the full situation for
                  AI-assisted emergency analysis.
                </p>
              </div>
            </div>

            <div className="sr-form-group">
              <label>
                Describe Your Emergency
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={6}
                placeholder="Example: My father collapsed and is struggling to breathe. There is also smoke coming from the kitchen..."
              />
            </div>

            <div className="sr-button-row">
              <button
                className="sr-btn sr-btn-secondary"
                onClick={startVoiceInput}
              >
                🎤 Voice Input
              </button>

              <button
                className="sr-btn sr-btn-secondary"
                onClick={getLocation}
              >
                📍 Detect Location
              </button>
            </div>

            <div className="sr-location-box">
              <div>
                <strong>
                  📍 Current Location
                </strong>

                <p>
                  {location.latitude},{" "}
                  {location.longitude}
                </p>
              </div>

              <span className="sr-location-status">
                DEMO LOCATION READY
              </span>
            </div>

            <button
              className="sr-btn sr-btn-danger sr-full-width"
              disabled={analyzing}
              onClick={() => createSOS("manual")}
            >
              {analyzing
                ? "🧠 ANALYZING EMERGENCY..."
                : "🚨 ANALYZE & SEND DEMO SOS"}
            </button>

            <p className="sr-disclaimer">
              Demo only. No actual emergency services
              are contacted. AI suggestions may be
              incorrect and require human verification.
            </p>
          </section>
        )}

        {page === "guardian" && (
          <section className="sr-page-card sr-guardian-card">
            <div className="sr-page-heading">
              <div className="sr-heading-icon purple">
                🛡️
              </div>

              <div>
                <h2>Guardian Mode</h2>

                <p>
                  Continuous safety monitoring with
                  repeating check-ins.
                </p>
              </div>
            </div>

            <div
              className={`sr-guardian-status ${
                guardianActive ? "running" : ""
              }`}
            >
              <span className="sr-status-dot"></span>

              {guardianActive
                ? "GUARDIAN MODE ACTIVE"
                : "GUARDIAN MODE INACTIVE"}
            </div>

            <div className="sr-form-group">
              <label>
                Check-in Interval
              </label>

              <div className="sr-button-row">
                <input
                  type="number"
                  min="1"
                  value={guardianDuration}
                  disabled={guardianActive}
                  onChange={(event) =>
                    setGuardianDuration(
                      event.target.value
                    )
                  }
                />

                <select
                  value={guardianUnit}
                  disabled={guardianActive}
                  onChange={(event) =>
                    setGuardianUnit(
                      event.target.value
                    )
                  }
                >
                  <option value="minutes">
                    Minutes
                  </option>

                  <option value="hours">
                    Hours
                  </option>
                </select>
              </div>
            </div>

            <div className="sr-timer-display">
              <span>TIME REMAINING</span>

              <h2>
                {formatTime(guardianRemaining)}
              </h2>

              <p>
                {guardianEscalating
                  ? "Safety confirmation required"
                  : guardianActive
                  ? "Monitoring until your next check-in"
                  : "Start Guardian Mode to begin"}
              </p>
            </div>

            {guardianEscalating && (
              <div className="sr-guardian-message">
                🚨 Safety Check-in Required —
                Warning {guardianAlertCount}/3
              </div>
            )}

            {guardianMessage && (
              <div className="sr-guardian-message">
                {guardianMessage}
              </div>
            )}

            <div className="sr-button-row">
              {!guardianActive ? (
                <button
                  className="sr-btn sr-btn-primary"
                  onClick={startGuardian}
                >
                  ▶️ Start Guardian Mode
                </button>
              ) : (
                <>
                  <button
                    className="sr-btn sr-btn-success"
                    onClick={confirmSafe}
                  >
                    ✅ I'm Safe — Continue Monitoring
                  </button>

                  <button
                    className="sr-btn sr-btn-danger"
                    onClick={stopGuardian}
                  >
                    ⏹ Stop Guardian Mode
                  </button>
                </>
              )}

              <button
                className="sr-btn sr-btn-secondary"
                onClick={() => setPage("sos")}
              >
                🚨 Emergency SOS →
              </button>
            </div>

            <div className="sr-info-box">
              <strong>
                How Continuous Guardian Mode Works
              </strong>

              <p>
                The countdown runs for your selected
                interval. When it ends, three alarms
                play at 15-second intervals.
              </p>

              <p>
                Clicking I'm Safe cancels the pending
                warnings and starts the next countdown.
                If there is no confirmation within
                45 seconds after the first alarm,
                one automatic demo SOS is created.
              </p>
            </div>

            <p className="sr-disclaimer">
              Keep this browser tab open. Browser
              timers and sounds may be delayed.
              This demo does not detect actual
              unconsciousness or contact emergency
              services.
            </p>
          </section>
        )}

        {page === "dashboard" && (
          <>
            <div className="sr-dashboard-header">
              <div>
                <h2>
                  Responder Dashboard
                </h2>

                <p>
                  AI-assisted incident analysis and
                  simulated responder coordination.
                </p>
              </div>

              <div className="sr-live-badge dark">
                <span className="sr-live-dot"></span>
                DEMO MONITORING
              </div>
            </div>

            <section className="sr-stats">
              <div className="sr-stat-card">
                <span>📋</span>

                <div>
                  <h3>{incidents.length}</h3>
                  <p>Total Incidents</p>
                </div>
              </div>

              <div className="sr-stat-card">
                <span>🚨</span>

                <div>
                  <h3>{activeIncidents}</h3>
                  <p>Active Incidents</p>
                </div>
              </div>

              <div className="sr-stat-card">
                <span>✅</span>

                <div>
                  <h3>{resolvedIncidents}</h3>
                  <p>Resolved</p>
                </div>
              </div>
            </section>

            <section className="sr-dashboard-section">
              <h3>
                🚨 Reported Incidents
              </h3>

              {incidents.length === 0 ? (
                <div className="sr-empty-state">
                  <span>📭</span>

                  <h3>No Incidents Yet</h3>

                  <p>
                    Emergency reports will appear here.
                  </p>
                </div>
              ) : (
                <div className="sr-incidents-grid">
                  {incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="sr-incident-card"
                    >
                      <div className="sr-incident-header">
                        <h4>
                          🚨 {incident.type}
                        </h4>

                        <span
                          className={`sr-status-badge ${
                            incident.status === "resolved"
                              ? "resolved"
                              : "pending"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </div>

                      <p>
                        {incident.description}
                      </p>

                      <div className="sr-responder-alert">
                        <strong>
                          🧠 Emergency Analysis
                        </strong>

                        <p>
                          <strong>
                            Category:
                          </strong>{" "}
                          {incident.type}
                        </p>

                        <p>
                          <strong>
                            Severity:
                          </strong>{" "}
                          {incident.severity}
                        </p>

                        <p>
                          <strong>
                            Suggested Responders:
                          </strong>{" "}
                          {incident.responders?.join(
                            ", "
                          ) ||
                            "Emergency Response Team"}
                        </p>

                        {incident.reason && (
                          <p>
                            <strong>
                              Reason:
                            </strong>{" "}
                            {incident.reason}
                          </p>
                        )}

                        {incident.advice?.length > 0 && (
                          <div>
                            <strong>
                              Immediate Safety Guidance:
                            </strong>

                            <ul>
                              {incident.advice.map(
                                (item, index) => (
                                  <li key={index}>
                                    {item}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                        <p>
                          <strong>
                            Analysis Source:
                          </strong>{" "}
                          {incident.analyzedBy ||
                            "unknown"}
                        </p>

                        <span>
                          📡 Simulated responder alert —
                          not actually dispatched
                        </span>
                      </div>

                      <div className="sr-incident-meta">
                        <span>
                          📍 {incident.location}
                        </span>

                        <span>
                          🕒{" "}
                          {new Date(
                            incident.createdAt
                          ).toLocaleString()}
                        </span>

                        <span>
                          ⚡ Severity:{" "}
                          {incident.severity}
                        </span>
                      </div>

                      <select
                        value={incident.status}
                        onChange={(event) =>
                          updateIncidentStatus(
                            incident.id,
                            event.target.value
                          )
                        }
                      >
                        <option value="new">
                          New
                        </option>

                        <option value="in-progress">
                          In Progress
                        </option>

                        <option value="resolved">
                          Resolved
                        </option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="sr-map-section">
              <h3>
                🗺️ Emergency Incident Map
              </h3>

              <EmergencyMap
                latitude={location.latitude}
                longitude={location.longitude}
                incidents={incidents}
              />
            </section>
          </>
        )}
      </main>

      <footer className="sr-footer">
        <p>
          🚨 SafeRoute AI © 2026 — Intelligent
          Emergency Response Platform
        </p>

        <span>
          Built for Safety • Powered by Innovation
        </span>
      </footer>
    </div>
  );
}