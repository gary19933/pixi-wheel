# Prizes & Spin Limits API - 3rd Party Integration Guide

## Overview

This guide explains how 3rd party teams can:
1. **Manage Prizes** - Set and update prizes via API
2. **Integrate Coin System** - Control spins using their own coin/currency system

---

## 🎁 PRIZE MANAGEMENT

### Get Prizes

```http
GET /api/gameplay/prizes?template=default
```

**Response:**
```json
{
  "success": true,
  "template": "default",
  "prizes": [
    {
      "id": "prize1",
      "label": "iPhone 15 Pro",
      "weight": 1,
      "color": "#25c77a"
    },
    {
      "id": "prize2",
      "label": "RM 50 Credit",
      "weight": 2,
      "color": "#E9FFF7"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### Update Prizes

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
    },
    {
      "id": "prize2",
      "label": "RM 50 Credit",
      "weight": 2,
      "color": "#E9FFF7"
    },
    {
      "id": "prize3",
      "label": "Free Spin",
      "weight": 3,
      "color": "#25c77a"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "template": "default",
  "prizes": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Prize Format:**
- `id` (string, required) - Unique identifier
- `label` (string, required) - Display name
- `weight` (number, required) - Probability weight (higher = more likely)
- `color` (string, optional) - Hex color code

---

## 🪙 SPIN LIMIT MANAGEMENT (Coin System Integration)

### Set Player Spin Limit

**When to use:** When a player earns spins (e.g., purchases coins, completes tasks)

```http
POST /api/gameplay/player/:playerId/spins
Content-Type: application/json

{
  "maxSpins": 10,
  "template": "default"
}
```

**Response:**
```json
{
  "success": true,
  "playerId": "player_123",
  "maxSpins": 10,
  "template": "default",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Parameters:**
- `maxSpins` (number or null) - Number of spins allowed. Use `null` for unlimited
- `template` (string, optional) - Template name, or null for all templates

---

### Get Player Spin Status

**When to use:** Check how many spins a player has remaining

```http
GET /api/gameplay/player/:playerId/spins?template=default
```

**Response:**
```json
{
  "playerId": "player_123",
  "maxSpins": 10,
  "currentSpins": 3,
  "remainingSpins": 7,
  "template": "default"
}
```

---

### Grant Spins (Add to Existing)

**When to use:** Player earns more spins (e.g., purchases more coins)

```http
POST /api/gameplay/player/:playerId/spins/grant
Content-Type: application/json

{
  "template": "default",
  "additionalSpins": 5
}
```

**Response:**
```json
{
  "success": true,
  "playerId": "player_123",
  "previousMaxSpins": 10,
  "additionalSpins": 5,
  "newMaxSpins": 15,
  "template": "default",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Check if Player Can Spin

**When to use:** Before allowing player to spin (check if they have spins available)

```http
GET /api/gameplay/player/:playerId/spins?template=default
```

Then check:
- If `remainingSpins > 0` or `maxSpins === null` → Player can spin
- If `remainingSpins === 0` → Player cannot spin

---

## 🔄 Complete Coin System Integration Flow

### Example: User Purchases Coins

```javascript
// 1. User purchases 10 coins in your system
const coinsPurchased = 10;
const coinsPerSpin = 1; // 1 coin = 1 spin
const spinsToGrant = coinsPurchased / coinsPerSpin; // 10 spins

// 2. Grant spins to player
const response = await fetch(`${GATEWAY_URL}/api/gameplay/player/${userId}/spins/grant`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
  body: JSON.stringify({
    template: 'default',
    additionalSpins: spinsToGrant
  })
});

const result = await response.json();
console.log(`✅ Granted ${spinsToGrant} spins. New total: ${result.newMaxSpins}`);
```

### Example: User Spins the Wheel

```javascript
// 1. Check if player can spin
const statusResponse = await fetch(`${GATEWAY_URL}/api/gameplay/player/${userId}/spins?template=default`, {
  headers: { 'ngrok-skip-browser-warning': 'true' }
});
const status = await statusResponse.json();

if (status.remainingSpins === 0 && status.maxSpins !== null) {
  // Player has no spins left
  return { error: 'No spins remaining. Please purchase more coins.' };
}

// 2. Player spins (spin is automatically deducted when prize is claimed)
// The spin count increments automatically on claim
```

### Example: Reset Spins (Daily Reset, etc.)

```javascript
// Reset player spins to 0 (they need to earn more)
await fetch(`${GATEWAY_URL}/api/gameplay/player/${userId}/spins`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
  body: JSON.stringify({
    maxSpins: 0, // Set to 0
    template: 'default'
  })
});

// Or grant new daily spins
await fetch(`${GATEWAY_URL}/api/gameplay/player/${userId}/spins/grant`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
  body: JSON.stringify({
    template: 'default',
    additionalSpins: 5 // Daily free spins
  })
});
```

---

## 📋 Complete Integration Example

```javascript
const GATEWAY_URL = 'https://[your-ngrok-url].ngrok-free.app';

class CoinSystemIntegration {
  constructor(gatewayUrl) {
    this.gatewayUrl = gatewayUrl;
  }

  // Set up prizes (one-time or when prizes change)
  async setPrizes(prizes, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/prizes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ template, prizes })
    });
    return await response.json();
  }

  // Get current prizes
  async getPrizes(template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/prizes?template=${template}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    return await response.json();
  }

  // Grant spins when user purchases coins
  async grantSpinsFromCoins(playerId, coins, coinsPerSpin = 1, template = 'default') {
    const spins = Math.floor(coins / coinsPerSpin);
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/player/${playerId}/spins/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ template, additionalSpins: spins })
    });
    return await response.json();
  }

  // Check if player can spin
  async canPlayerSpin(playerId, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/player/${playerId}/spins?template=${template}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    const status = await response.json();
    return {
      canSpin: status.maxSpins === null || status.remainingSpins > 0,
      remainingSpins: status.remainingSpins,
      maxSpins: status.maxSpins
    };
  }

  // Set spin limit directly
  async setSpinLimit(playerId, maxSpins, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/player/${playerId}/spins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ maxSpins, template })
    });
    return await response.json();
  }
}

// Usage
const coinSystem = new CoinSystemIntegration(GATEWAY_URL);

// Set up prizes
await coinSystem.setPrizes([
  { id: 'prize1', label: 'iPhone 15 Pro', weight: 1, color: '#25c77a' },
  { id: 'prize2', label: 'RM 50 Credit', weight: 2, color: '#E9FFF7' }
]);

// User purchases 100 coins (1 coin = 1 spin)
await coinSystem.grantSpinsFromCoins('user_123', 100, 1);

// Check if user can spin
const status = await coinSystem.canPlayerSpin('user_123');
if (status.canSpin) {
  console.log(`User can spin! ${status.remainingSpins} spins remaining`);
}
```

---

## 🎯 Key Points

### Prizes
- ✅ Can be updated via API
- ✅ Stored per template
- ✅ Format: `{ id, label, weight, color }`
- ✅ Weight determines probability (higher = more likely)

### Spin Limits
- ✅ Controlled by 3rd party backend
- ✅ Per-player, per-template
- ✅ Automatically decremented on claim
- ✅ Can grant additional spins
- ✅ `null` = unlimited spins

### Integration Flow
1. **User earns coins** → Call `grant` endpoint
2. **User wants to spin** → Check `remainingSpins`
3. **User spins** → Spin happens, count increments on claim
4. **User runs out** → Show "Purchase more coins" message

---

## 📝 Notes

- **Spin Deduction:** Spins are automatically deducted when a prize is claimed (via `/api/gameplay/claim`)
- **Template Support:** All operations support templates for multiple game configurations
- **Database Required:** Spin limits require database (won't work with in-memory storage)
- **Unlimited Spins:** Set `maxSpins: null` for unlimited spins

---

**Last Updated:** 2024-11-25

