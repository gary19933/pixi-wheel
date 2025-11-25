# Session Management API - 3rd Party Integration Guide

## Overview

This guide explains how 3rd party teams should handle session management when integrating the Pixi Wheel game into their platform. Sessions track individual game plays, and can be linked to players for proper tracking and spin limit management.

---

## 🎯 RECOMMENDED FLOW

### Option 1: Let Frontend Handle Sessions (Recommended)

**Simplest approach** - The frontend automatically creates and manages sessions. You just need to pass the `playerId`.

**How it works:**
1. 3rd party embeds the game with `playerId` in URL: `https://game-url.com?playerId=user_123`
2. Frontend automatically creates a session and links it to the player
3. All spins are tracked per session
4. Spin limits are enforced per player (not per session)

**Example:**
```html
<!-- Embed in 3rd party site -->
<iframe src="https://your-game-url.com?playerId=user_123&template=default"></iframe>
```

**Pros:**
- ✅ No session management needed from 3rd party
- ✅ Automatic session creation
- ✅ Works out of the box

**Cons:**
- ❌ Less control over session lifecycle
- ❌ New session created on each page load

---

### Option 2: 3rd Party Manages Sessions (Advanced)

**More control** - 3rd party creates sessions via API and passes `sessionId` to frontend.

**How it works:**
1. 3rd party creates session via API: `POST /api/gameplay/session`
2. Gets `sessionId` from response
3. Embeds game with `sessionId`: `https://game-url.com?sessionId=session_123`
4. Frontend uses existing session

**Example:**
```javascript
// 1. Create session
const sessionResponse = await fetch('https://gateway-url/api/gameplay/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template: 'default',
    playerId: 'user_123'
  })
});
const session = await sessionResponse.json();

// 2. Embed game with sessionId
const gameUrl = `https://game-url.com?sessionId=${session.id}&playerId=user_123`;
```

**Pros:**
- ✅ Full control over session lifecycle
- ✅ Can reuse sessions
- ✅ Better for tracking

**Cons:**
- ❌ More complex integration
- ❌ Need to manage session state

---

## 📋 API ENDPOINTS

### Create Session

```http
POST /api/gameplay/session
Content-Type: application/json

{
  "template": "default",
  "playerId": "user_123"
}
```

**Response:**
```json
{
  "id": "session_1234567890_abc123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "spins": 0,
  "maxSpins": 10,
  "remainingSpins": 10,
  "claims": [],
  "device": {...},
  "template": "default",
  "playerId": "user_123"
}
```

---

### Get Session by ID

```http
GET /api/gameplay/session/:sessionId
```

**Response:**
```json
{
  "id": "session_1234567890_abc123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "spins": 3,
  "maxSpins": 10,
  "remainingSpins": 7,
  "claims": [...],
  "device": {...},
  "template": "default"
}
```

---

### Get Player's Sessions (All)

```http
GET /api/gameplay/player/:playerId/sessions?template=default
```

**Response:**
```json
{
  "playerId": "user_123",
  "count": 3,
  "sessions": [
    {
      "id": "session_1",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "spins": 5,
      "maxSpins": 10,
      "remainingSpins": 5,
      "template": "default",
      "playerId": "user_123"
    },
    {
      "id": "session_2",
      "createdAt": "2024-01-01T01:00:00.000Z",
      "spins": 2,
      "maxSpins": 10,
      "remainingSpins": 8,
      "template": "default",
      "playerId": "user_123"
    }
  ],
  "template": "default"
}
```

---

### Get Player's Active Session (Most Recent)

```http
GET /api/gameplay/player/:playerId/session?template=default
```

**Response:**
```json
{
  "id": "session_1234567890_abc123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "spins": 3,
  "maxSpins": 10,
  "remainingSpins": 7,
  "claims": [...],
  "device": {...},
  "template": "default",
  "playerId": "user_123"
}
```

**Returns 404 if no session found.**

---

## 🔄 COMPLETE INTEGRATION EXAMPLES

### Example 1: Simple Integration (Recommended)

**3rd Party Site:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>My Game Site</title>
</head>
<body>
  <h1>Welcome, User!</h1>
  
  <!-- Embed game with playerId -->
  <iframe 
    src="https://your-game-url.com?playerId=user_123&template=default"
    width="800"
    height="600"
    frameborder="0">
  </iframe>
</body>
</html>
```

**That's it!** The frontend handles everything.

---

### Example 2: Advanced Integration with Session Management

**3rd Party Backend:**
```javascript
const GATEWAY_URL = 'https://your-gateway-url.ngrok-free.app';

class GameSessionManager {
  constructor(gatewayUrl) {
    this.gatewayUrl = gatewayUrl;
  }

  // Create session for player
  async createSession(playerId, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ template, playerId })
    });
    return await response.json();
  }

  // Get player's active session
  async getActiveSession(playerId, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/player/${playerId}/session?template=${template}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (response.status === 404) {
      return null; // No active session
    }
    
    return await response.json();
  }

  // Get all player sessions
  async getPlayerSessions(playerId, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/player/${playerId}/sessions?template=${template}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    return await response.json();
  }

  // Get or create session for player
  async getOrCreateSession(playerId, template = 'default') {
    // Try to get existing active session
    let session = await this.getActiveSession(playerId, template);
    
    // If no session, create new one
    if (!session) {
      session = await this.createSession(playerId, template);
    }
    
    return session;
  }
}

// Usage
const sessionManager = new GameSessionManager(GATEWAY_URL);

// When user opens game page
app.get('/game/:userId', async (req, res) => {
  const { userId } = req.params;
  
  // Get or create session
  const session = await sessionManager.getOrCreateSession(userId, 'default');
  
  // Render page with sessionId
  res.render('game', {
    gameUrl: `https://your-game-url.com?sessionId=${session.id}&playerId=${userId}`
  });
});
```

---

## 🎯 KEY CONCEPTS

### Session vs Player

- **Session** = One game play instance (can have multiple spins)
- **Player** = User account (can have multiple sessions)

### Session Lifecycle

1. **Created** - When game page loads (or via API)
2. **Active** - While user is playing
3. **Tracked** - All spins stored with sessionId
4. **Linked** - Session linked to playerId for spin limits

### Spin Limits

- **Per Player** - Spin limits are enforced per `playerId` (not per session)
- **Across Sessions** - If player has 10 spins, they can use them across multiple sessions
- **Session Tracking** - Each session tracks its own spins, but limits are global per player

---

## 📊 TRACKING & ANALYTICS

### Get Player's Game History

```http
GET /api/gameplay/history?playerId=user_123&limit=100
```

**Note:** History entries include `sessionId`, so you can filter by session or player.

### Get Player's Spin Status

```http
GET /api/gameplay/player/:playerId/spins?template=default
```

Returns:
- `maxSpins` - Total spins allowed
- `currentSpins` - Spins used across all sessions
- `remainingSpins` - Spins remaining

---

## ✅ RECOMMENDATION

**For most 3rd party integrations, use Option 1 (Simple):**

1. ✅ Just pass `playerId` in URL
2. ✅ Frontend handles session creation
3. ✅ Spin limits work automatically
4. ✅ No extra API calls needed

**Use Option 2 (Advanced) only if:**
- You need to track sessions server-side
- You want to reuse sessions
- You need custom session management

---

## 🔍 FAQ

**Q: Do I need to manage sessions?**  
A: No! The simplest approach is to just pass `playerId` in the URL. The frontend will handle session creation automatically.

**Q: Can one player have multiple sessions?**  
A: Yes! Each game play creates a new session, but spin limits are shared across all sessions for the same player.

**Q: How do I know which session a player is using?**  
A: Use `GET /api/gameplay/player/:playerId/session` to get their most recent active session.

**Q: What if player refreshes the page?**  
A: A new session is created, but spin limits are still enforced per player (not per session).

**Q: How do I track all spins for a player?**  
A: Use `GET /api/gameplay/history?playerId=user_123` to get all spins across all sessions.

---

**Last Updated:** 2024-11-25

