# 🚨 SafeRoute AI
### Intelligent Emergency Response & Personal Safety Platform

SafeRoute AI is an AI-powered emergency response platform designed to help users identify emergencies, recommend appropriate responders, and monitor personal safety.

Built for a hackathon using React, Node.js, Express, and Google Gemini AI.

## 🎯 Problem Statement

During emergencies, people may panic, struggle to explain their situation, or become unable to request help.

SafeRoute AI aims to simplify emergency reporting through intelligent emergency analysis, GPS tracking, and automated safety check-ins.

## 🚀 Key Features

### 🤖 AI-Powered Emergency Analysis
- Uses Google Gemini AI to analyze emergency descriptions.
- Detects medical emergencies, fires, accidents, and multiple simultaneous emergencies.
- Classifies emergency severity.
- Recommends appropriate emergency responders.

### 🚨 Emergency SOS
- Allows users to submit emergency descriptions.
- Supports GPS location capture.
- Creates demo emergency incidents.

### 🛡️ Guardian Mode
- Provides personal safety check-in timers.
- Supports safety confirmation.
- Designed to trigger demo emergency alerts when check-ins are missed.

### 🗺️ Emergency Map
- Displays incident locations using an interactive map.
- Helps visualize reported emergencies.

### 📊 Responder Dashboard
- Displays emergency incidents.
- Tracks incident status.
- Supports emergency monitoring.

## 🛠️ Technology Stack

**Frontend**
- React
- Vite
- JavaScript
- CSS
- Leaflet

**Backend**
- Node.js
- Express

**AI**
- Google Gemini AI

**Version Control**
- Git and GitHub

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourscloud777-commits/-SafeRoute-AI.git
cd -SafeRoute-AI
```

### 2. Start the backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` folder:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_available_gemini_model
PORT=3000
```

Start the backend:

```bash
npm start
```

### 3. Start the frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL displayed by Vite.

## 🧪 Example AI Analysis

**Emergency description:**

"My father is unconscious and our kitchen is on fire."

**Expected classification:**
- Emergency: Fire and Medical Emergency
- Severity: Critical
- Suggested responders: Fire Department and Ambulance

## ⚠️ Disclaimer

SafeRoute AI is a hackathon demonstration.

Emergency alerts, responder recommendations, and incident tracking are simulated. The application does not automatically contact real police, fire departments, or ambulance services.

In a real emergency, contact your local emergency services directly.

## 👨‍💻 Project

SafeRoute AI — Built for innovation in emergency response and personal safety.