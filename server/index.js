require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

// In-memory demo incident storage
let incidents = [];

// --------------------------------------
// BASIC EMERGENCY ANALYSIS FALLBACK
// --------------------------------------

function classifyEmergency(description = "") {
  const text = String(description).toLowerCase();

  const responders = new Set();
  const categories = [];

  const fire =
    /\b(fire|smoke|flames|burning|explosion)\b/.test(text) &&
    !/\b(no fire|not a fire|no smoke)\b/.test(text);

  const medical =
    /\b(unconscious|collapsed|fainted|heart attack|not breathing|difficulty breathing|struggling to breathe|injured|bleeding|seizure)\b/.test(
      text
    );

  const accident =
    /\b(accident|crash|collision|hit by car|road accident)\b/.test(
      text
    );

  const crime =
    /\b(attack|assault|robbery|threat|kidnap|violence|stabbing|gunshot)\b/.test(
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

    category:
      categories.length > 0
        ? categories.join(" + ")
        : "General Emergency",

    severity: fire || medical ? "critical" : "high",

    responders: [...responders],

    reason:
      "Basic emergency classification used because AI analysis was unavailable.",

    advice: [
      "Move to a safe location if possible.",
      "Contact local emergency services directly if there is immediate danger.",
    ],

    analyzedBy: "fallback",
  };
}

// --------------------------------------
// GEMINI AI EMERGENCY ANALYSIS
// --------------------------------------

async function analyzeEmergency(description) {
  if (!ai) {
    return classifyEmergency(description);
  }

  const prompt = `
You are SafeRoute AI, an emergency situation classification assistant.

Analyze the ENTIRE reported situation carefully.

USER REPORT:
${JSON.stringify(description)}

IMPORTANT RULES:
1. Understand the meaning of the full description.
2. Identify multiple simultaneous emergencies.
3. Consider negation. "There is no fire" must not be classified as a fire.
4. Do not assume unverified details are confirmed.
5. Recommend ALL relevant responder teams.
6. Do not claim that emergency responders were contacted.
7. Provide brief immediate safety guidance.
8. Return ONLY valid JSON.

Allowed responder teams:
- Police
- Fire Department
- Ambulance
- Emergency Response Team

Allowed severity values:
- low
- medium
- high
- critical

Return exactly this JSON structure:

{
  "type": "Short emergency category",
  "category": "Short emergency category",
  "severity": "critical",
  "responders": ["Ambulance", "Fire Department"],
  "reason": "Why these responders are suggested",
  "advice": [
    "First immediate safety step",
    "Second immediate safety step"
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model:
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash",

      contents: prompt,

      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response");
    }

    const result = JSON.parse(response.text);

    const allowedResponders = [
      "Police",
      "Fire Department",
      "Ambulance",
      "Emergency Response Team",
    ];

    const allowedSeverities = [
      "low",
      "medium",
      "high",
      "critical",
    ];

    const responders = Array.isArray(result.responders)
      ? result.responders.filter((team) =>
          allowedResponders.includes(team)
        )
      : [];

    const severity = String(
      result.severity || "high"
    ).toLowerCase();

    const category = String(
      result.category ||
      result.type ||
      "General Emergency"
    );

    return {
      type: String(result.type || category),
      category,

      severity: allowedSeverities.includes(severity)
        ? severity
        : "high",

      responders:
        responders.length > 0
          ? responders
          : ["Emergency Response Team"],

      reason: String(
        result.reason ||
        "AI analyzed the reported emergency."
      ),

      advice: Array.isArray(result.advice)
        ? result.advice.map(String).slice(0, 5)
        : [],

      analyzedBy: "gemini",
    };
  } catch (error) {
    console.error(
      "Gemini analysis failed:",
      error.message
    );

    return classifyEmergency(description);
  }
}

// --------------------------------------
// HEALTH CHECK
// --------------------------------------

app.get("/", (req, res) => {
  res.json({
    name: "SafeRoute AI",
    status: "running",
    geminiConfigured: Boolean(ai),
    message: "Emergency response demo backend",
  });
});

// --------------------------------------
// AI ANALYSIS API
// --------------------------------------

app.post("/api/analyze", async (req, res) => {
  try {
    const description = String(
      req.body?.description || ""
    ).trim();

    if (!description) {
      return res.status(400).json({
        error: "Emergency description is required",
      });
    }

    const analysis = await analyzeEmergency(
      description
    );

    res.json({
      success: true,
      ...analysis,
    });
  } catch (error) {
    console.error(
      "Analyze endpoint error:",
      error.message
    );

    res.status(500).json({
      error: "Emergency analysis failed",
    });
  }
});

// --------------------------------------
// CREATE EMERGENCY INCIDENT
// --------------------------------------

app.post("/api/incidents", async (req, res) => {
  try {
    const body = req.body || {};

    const description = String(
      body.description || "Emergency SOS activated"
    );

    const source = String(body.source || "manual");

    const analysis =
      source === "guardian"
        ? {
            type: "Missed Safety Check-in",
            category: "Guardian Emergency",
            severity: "high",
            responders: ["Emergency Response Team"],
            reason:
              "The user missed repeated Guardian Mode safety alerts.",
            advice: [
              "Verify the user's safety and last known location.",
            ],
            analyzedBy: "guardian",
          }
        : await analyzeEmergency(description);

    const incident = {
      id: `incident-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,

      description,
      source,

      type: analysis.type,
      category: analysis.category,
      severity: analysis.severity,

      responders: analysis.responders,
      suggestedResponders: analysis.responders,

      reason: analysis.reason,
      advice: analysis.advice,
      analyzedBy: analysis.analyzedBy,

      latitude:
        Number(body.latitude) || 17.385,

      longitude:
        Number(body.longitude) || 78.4867,

      status: "new",
      createdAt: new Date().toISOString(),

      simulated: true,
      notificationStatus: "demo-notified",
    };

    incidents.unshift(incident);

    res.status(201).json({
      success: true,
      incident,
    });
  } catch (error) {
    console.error(
      "Create incident error:",
      error.message
    );

    res.status(500).json({
      error: "Could not create incident",
    });
  }
});

// --------------------------------------
// GET ALL INCIDENTS
// --------------------------------------

app.get("/api/incidents", (req, res) => {
  res.json({
    success: true,
    incidents,
  });
});

// --------------------------------------
// UPDATE INCIDENT STATUS
// --------------------------------------

app.patch("/api/incidents/:id", (req, res) => {
  const incident = incidents.find(
    (item) => item.id === req.params.id
  );

  if (!incident) {
    return res.status(404).json({
      error: "Incident not found",
    });
  }

  const allowedStatuses = [
    "new",
    "in-progress",
    "resolved",
  ];

  const status = String(
    req.body?.status || ""
  );

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid incident status",
    });
  }

  incident.status = status;

  res.json({
    success: true,
    incident,
  });
});

// --------------------------------------
// GUARDIAN AUTOMATIC SOS
// --------------------------------------

app.post("/api/guardian/sos", (req, res) => {
  const body = req.body || {};

  const incident = {
    id: `guardian-${Date.now()}`,

    type: "Missed Safety Check-in",
    category: "Guardian Emergency",
    severity: "high",

    responders: ["Emergency Response Team"],
    suggestedResponders: ["Emergency Response Team"],

    description:
      "Automatic demo SOS: user did not confirm safety after three warnings.",

    reason:
      "Guardian Mode check-in expired without safety confirmation.",

    advice: [
      "Verify the user's safety and last known location.",
    ],

    analyzedBy: "guardian",

    latitude:
      Number(body.latitude) || 17.385,

    longitude:
      Number(body.longitude) || 78.4867,

    source: "guardian",
    status: "new",

    createdAt: new Date().toISOString(),

    simulated: true,
    notificationStatus: "demo-notified",
  };

  incidents.unshift(incident);

  res.status(201).json({
    success: true,
    incident,
  });
});

// --------------------------------------
// START SERVER
// --------------------------------------

app.listen(PORT, () => {
  console.log(`
========================================
🚨 SAFEROUTE AI BACKEND RUNNING
========================================
🌐 Server: http://localhost:${PORT}
🚨 SOS API: READY
🛡️ Guardian Mode: READY
📊 Responder Dashboard: READY
🤖 Gemini AI: ${ai ? "CONFIGURED" : "NOT CONFIGURED"}
========================================
`);
});