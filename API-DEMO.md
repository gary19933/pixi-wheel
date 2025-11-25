# Microservices API Documentation for 3rd Party Integration

## 🎯 Overview

This document provides API documentation for the Pixi Wheel microservices architecture. All APIs are accessible through the **Gateway Service** which acts as the main entry point.

## 📡 Base URL

**Gateway URL (Public):** `https://[your-ngrok-url].ngrok-free.app`

**Important:** All API requests should go through the Gateway URL. The Gateway automatically routes requests to the appropriate microservice.

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Gateway       │  Port 3000 (Main Entry Point)
│   (API Gateway) │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┬────────────┐
    │         │              │            │
┌───▼───┐ ┌──▼──────┐ ┌──────▼─────┐ ┌───▼────┐
│Gameplay│ │Probability│ │  System  │ │ ...   │
│ :3001  │ │  :3002    │ │  :3003   │ │        │
└────────┘ └──────────┘ └──────────┘ └────────┘
```

---

## 🔍 Health Checks

### Gateway Health
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "gateway",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Service Health Checks
```http
GET /api/gameplay/health
GET /api/probability/health
GET /api/system/health
```

---

## 🎮 Gameplay API

### Get Game Configuration
```http
GET /api/gameplay/config?template=default
```

**Response:**
```json
{
  "config": {
    "prizes": [...],
    "guaranteedPrize": null,
    "guaranteedPrizeEnabled": false,
    "guaranteedSpinCount": 5
  },
  "template": "default",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Update Game Configuration
```http
POST /api/gameplay/config
Content-Type: application/json

{
  "template": "default",
  "prizes": [
    {
      "id": "prize1",
      "name": "Prize 1",
      "weight": 10
    }
  ],
  "guaranteedPrize": "prize1",
  "guaranteedPrizeEnabled": true,
  "guaranteedSpinCount": 5,
  "termsAndConditions": "By participating you agree:\n• One spin per session.\n• Prizes are non-transferable."
}
```

### Spin the Wheel
```http
POST /api/gameplay/spin
Content-Type: application/json

{
  "sessionId": "session_123",
  "prizes": [
    {
      "id": "prize1",
      "name": "Prize 1",
      "weight": 10
    }
  ],
  "spinCount": 1
}
```

**Response:**
```json
{
  "prize": {
    "id": "prize1",
    "name": "Prize 1",
    "weight": 10
  },
  "sessionId": "session_123",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "animation": {
    "fullSpins": 5,
    "duration": 4.5
  },
  "probability": 50.0,
  "spinCount": 1
}
```

### Claim Prize
```http
POST /api/gameplay/claim
Content-Type: application/json

{
  "id": "prize1",
  "prize": "Prize 1",
  "weight": 10,
  "sessionId": "session_123",
  "template": "default",
  "playerId": "player_123"
}
```

**Response:**
```json
{
  "success": true,
  "claim": {
    "id": "prize1",
    "prize": "Prize 1",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "session": {
    "spins": 1,
    "maxSpins": null,
    "remainingSpins": null
  },
  "player": {
    "playerId": "player_123",
    "maxSpins": 10,
    "currentSpins": 1,
    "remainingSpins": 9
  }
}
```

### Get Game History
```http
GET /api/gameplay/history?limit=100&sessionId=session_123&template=default
```

**Response includes guaranteed prize settings:**
```json
{
  "count": 10,
  "history": [
    {
      "id": 1,
      "sessionId": "session_123",
      "prize": {
        "id": "prize1",
        "label": "iPhone 15 Pro",
        "weight": 1
      },
      "spinCount": 5,
      "usedGuaranteed": true,
      "usedSequence": false,
      "guaranteedPrize": "prize1",
      "guaranteedPrizeEnabled": true,
      "guaranteedSpinCount": 5,
      "guaranteedPrizeSequence": [],
      "configSnapshot": {
        "guaranteedPrize": "prize1",
        "guaranteedPrizeEnabled": true,
        "guaranteedSpinCount": 5,
        "guaranteedPrizeSequence": []
      },
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "template": "default"
}
```

### Get Game Statistics
```http
GET /api/gameplay/stats?template=default
```

### Create Game Session
```http
POST /api/gameplay/session
Content-Type: application/json

{
  "template": "default",
  "playerId": "player_123"
}
```

### Get Session Info
```http
GET /api/gameplay/session/:sessionId
```

### Get Terms & Conditions
```http
GET /api/gameplay/terms?template=default
```

**Response:**
```json
{
  "success": true,
  "termsAndConditions": "By participating you agree:\n• One spin per session.\n• Prizes are non-transferable.",
  "template": "default",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Update Terms & Conditions
```http
PUT /api/gameplay/terms
Content-Type: application/json

{
  "template": "default",
  "termsAndConditions": "By participating you agree:\n• One spin per session.\n• Prizes are non-transferable.\n• Organizer reserves the right to modify terms."
}
```

**Response:**
```json
{
  "success": true,
  "termsAndConditions": "By participating you agree:\n• One spin per session.\n• Prizes are non-transferable.\n• Organizer reserves the right to modify terms.",
  "template": "default",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Check if Session Can Spin
```http
GET /api/gameplay/session/:sessionId/can-spin
```

### Prize Management (for 3rd Party Backend)
```http
GET /api/gameplay/prizes?template=default
```

```http
PUT /api/gameplay/prizes
Content-Type: application/json

{
  "template": "default",
  "prizes": [
    {
      "id": "prize1",
      "label": "iPhone 15 Pro",
      "weight": 1,
      "color": "#25c77a"
    }
  ]
}
```

### Player Spin Management (for 3rd Party Backend / Coin System)
```http
POST /api/gameplay/player/:playerId/spins
Content-Type: application/json

{
  "maxSpins": 10,
  "template": "default"
}
```

```http
GET /api/gameplay/player/:playerId/spins?template=default
```

**Grant Additional Spins (for coin purchases):**
```http
POST /api/gameplay/player/:playerId/spins/grant
Content-Type: application/json

{
  "template": "default",
  "additionalSpins": 5
}
```

---

## 🎲 Probability API

### Select Weighted Item
```http
POST /api/probability/select
Content-Type: application/json

{
  "items": [
    {
      "id": "prize1",
      "name": "Prize 1",
      "weight": 10
    },
    {
      "id": "prize2",
      "name": "Prize 2",
      "weight": 5
    }
  ],
  "guaranteedId": null
}
```

**Response:**
```json
{
  "selected": {
    "id": "prize1",
    "name": "Prize 1",
    "weight": 10
  },
  "probabilities": [
    {
      "id": "prize1",
      "name": "Prize 1",
      "weight": 10,
      "probability": 66.67,
      "probabilityDecimal": 0.6667
    },
    {
      "id": "prize2",
      "name": "Prize 2",
      "weight": 5,
      "probability": 33.33,
      "probabilityDecimal": 0.3333
    }
  ]
}
```

### Calculate Probabilities
```http
POST /api/probability/calculate
Content-Type: application/json

{
  "items": [
    {
      "id": "prize1",
      "weight": 10
    },
    {
      "id": "prize2",
      "weight": 5
    }
  ]
}
```

---

## 🖥️ System API

### Get System Information
```http
GET /api/system/system
```

**Response:**
```json
{
  "platform": "win32",
  "arch": "x64",
  "nodeVersion": "v20.0.0",
  "uptime": 3600,
  "memory": {
    "total": 8589934592,
    "free": 4294967296,
    "used": 4294967296,
    "usagePercent": "50.00"
  },
  "cpu": {
    "count": 8,
    "model": "Intel Core i7"
  }
}
```

### Get Service Status
```http
GET /api/system/status
```

---

## 🔐 Headers

### Required Headers
- `Content-Type: application/json` (for POST requests)

### Optional Headers (for ngrok)
- `ngrok-skip-browser-warning: true` (to bypass ngrok warning page)

### Custom Headers (for App Detection)
- `x-app-version`: App version
- `x-app-name`: App name
- `x-app-platform`: Platform (ios/android)

---

## 📝 Example Integration (cURL)

```bash
# Health Check
curl -X GET https://[your-ngrok-url].ngrok-free.app/health

# Create Session
curl -X POST https://[your-ngrok-url].ngrok-free.app/api/gameplay/session \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"template": "default", "playerId": "player_123"}'

# Spin the Wheel
curl -X POST https://[your-ngrok-url].ngrok-free.app/api/gameplay/spin \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "sessionId": "session_123",
    "prizes": [
      {"id": "prize1", "name": "Prize 1", "weight": 10},
      {"id": "prize2", "name": "Prize 2", "weight": 5}
    ],
    "spinCount": 1
  }'

# Claim Prize
curl -X POST https://[your-ngrok-url].ngrok-free.app/api/gameplay/claim \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "id": "prize1",
    "prize": "Prize 1",
    "weight": 10,
    "sessionId": "session_123",
    "playerId": "player_123"
  }'
```

---

## 📝 Example Integration (JavaScript/Node.js)

```javascript
const BASE_URL = 'https://[your-ngrok-url].ngrok-free.app';

// Health Check
async function checkHealth() {
  const response = await fetch(`${BASE_URL}/health`);
  return await response.json();
}

// Create Session
async function createSession(playerId, template = 'default') {
  const response = await fetch(`${BASE_URL}/api/gameplay/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ playerId, template })
  });
  return await response.json();
}

// Spin the Wheel
async function spin(sessionId, prizes, spinCount = 1) {
  const response = await fetch(`${BASE_URL}/api/gameplay/spin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ sessionId, prizes, spinCount })
  });
  return await response.json();
}

// Claim Prize
async function claimPrize(prize, sessionId, playerId) {
  const response = await fetch(`${BASE_URL}/api/gameplay/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({
      id: prize.id,
      prize: prize.name,
      weight: prize.weight,
      sessionId,
      playerId
    })
  });
  return await response.json();
}
```

---

## 🚨 Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "service": "service-name" // Optional, only if error from specific service
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request
- `403` - Forbidden (e.g., spin limit reached)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## 📞 Support

For questions or issues during the demo, please contact the development team.

---

**Last Updated:** 2024-01-01

