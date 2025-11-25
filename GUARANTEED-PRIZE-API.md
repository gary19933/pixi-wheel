# Guaranteed Prize API - 3rd Party Integration Guide

## Overview

This guide explains how 3rd party teams can configure guaranteed prize settings:
- **Guaranteed Prize** - Which prize to guarantee
- **Guaranteed Spin Count** - After how many spins the guaranteed prize is awarded
- **Guaranteed Prize Enabled** - Enable/disable the guaranteed prize feature
- **Guaranteed Prize Sequence** - Optional sequence of prizes before the guaranteed prize

---

## 🎯 GET GUARANTEED PRIZE SETTINGS

```http
GET /api/gameplay/guaranteed-prize?template=default
```

**Response:**
```json
{
  "success": true,
  "template": "default",
  "guaranteedPrize": "prize1",
  "guaranteedPrizeEnabled": true,
  "guaranteedSpinCount": 5,
  "guaranteedPrizeSequence": ["prize2", "prize3", "prize4", null],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Parameters:**
- `template` (optional) - Template name, defaults to "default"

**Response Fields:**
- `guaranteedPrize` (string|null) - The prize ID that will be guaranteed
- `guaranteedPrizeEnabled` (boolean) - Whether guaranteed prize is enabled
- `guaranteedSpinCount` (number) - After how many spins the guaranteed prize is awarded
- `guaranteedPrizeSequence` (array) - Optional sequence of prizes before guaranteed prize

---

## 🎯 UPDATE GUARANTEED PRIZE SETTINGS

```http
PUT /api/gameplay/guaranteed-prize
Content-Type: application/json

{
  "template": "default",
  "guaranteedPrize": "prize1",
  "guaranteedPrizeEnabled": true,
  "guaranteedSpinCount": 5,
  "guaranteedPrizeSequence": ["prize2", "prize3", "prize4", null]
}
```

**Request Body:**
- `template` (optional) - Template name, defaults to "default"
- `guaranteedPrize` (string|null) - Prize ID to guarantee. Use `null` to disable
- `guaranteedPrizeEnabled` (boolean) - Enable/disable guaranteed prize feature
- `guaranteedSpinCount` (number) - Number of spins before guaranteed prize (min: 2, max: 100)
- `guaranteedPrizeSequence` (array, optional) - Sequence of prizes before guaranteed prize

**Response:**
```json
{
  "success": true,
  "template": "default",
  "guaranteedPrize": "prize1",
  "guaranteedPrizeEnabled": true,
  "guaranteedSpinCount": 5,
  "guaranteedPrizeSequence": ["prize2", "prize3", "prize4", null],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 📋 HOW IT WORKS

### Basic Guaranteed Prize (Every Nth Spin)

**Example:** Guarantee "iPhone 15 Pro" every 5 spins

```json
{
  "guaranteedPrize": "prize1",
  "guaranteedPrizeEnabled": true,
  "guaranteedSpinCount": 5,
  "guaranteedPrizeSequence": []
}
```

**Behavior:**
- Spins 1-4: Random prizes (guaranteed prize excluded)
- Spin 5: Guaranteed prize "prize1"
- Spins 6-9: Random prizes (guaranteed prize excluded)
- Spin 10: Guaranteed prize "prize1"
- And so on...

---

### Guaranteed Prize with Sequence

**Example:** Guarantee "iPhone 15 Pro" every 5 spins, with a sequence before it

```json
{
  "guaranteedPrize": "prize1",
  "guaranteedPrizeEnabled": true,
  "guaranteedSpinCount": 5,
  "guaranteedPrizeSequence": ["prize2", "prize3", "prize4", null]
}
```

**Behavior:**
- Spin 1: "prize2" (from sequence)
- Spin 2: "prize3" (from sequence)
- Spin 3: "prize4" (from sequence)
- Spin 4: Random prize (null in sequence = random)
- Spin 5: Guaranteed prize "prize1"
- Spins 6-10: Repeat sequence...

**Sequence Rules:**
- Array length should be `guaranteedSpinCount - 1`
- Use `null` in sequence for random prize at that position
- Use prize ID string for specific prize at that position

---

### Disable Guaranteed Prize

```json
{
  "guaranteedPrize": null,
  "guaranteedPrizeEnabled": false,
  "guaranteedSpinCount": 5,
  "guaranteedPrizeSequence": []
}
```

---

## 🔄 COMPLETE EXAMPLES

### Example 1: Set Guaranteed Prize Every 10 Spins

```bash
curl -X PUT https://[GATEWAY-URL]/api/gameplay/guaranteed-prize \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "template": "default",
    "guaranteedPrize": "iphone_15_pro",
    "guaranteedPrizeEnabled": true,
    "guaranteedSpinCount": 10
  }'
```

### Example 2: Set Guaranteed Prize with Sequence

```bash
curl -X PUT https://[GATEWAY-URL]/api/gameplay/guaranteed-prize \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "template": "default",
    "guaranteedPrize": "mega_prize",
    "guaranteedPrizeEnabled": true,
    "guaranteedSpinCount": 5,
    "guaranteedPrizeSequence": ["small_prize", "medium_prize", "small_prize", null]
  }'
```

### Example 3: Get Current Settings

```bash
curl https://[GATEWAY-URL]/api/gameplay/guaranteed-prize?template=default \
  -H "ngrok-skip-browser-warning: true"
```

### Example 4: Disable Guaranteed Prize

```bash
curl -X PUT https://[GATEWAY-URL]/api/gameplay/guaranteed-prize \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "template": "default",
    "guaranteedPrizeEnabled": false
  }'
```

---

## 💻 JavaScript Integration Example

```javascript
const GATEWAY_URL = 'https://[your-ngrok-url].ngrok-free.app';

class GuaranteedPrizeManager {
  constructor(gatewayUrl) {
    this.gatewayUrl = gatewayUrl;
  }

  // Get current guaranteed prize settings
  async getSettings(template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/guaranteed-prize?template=${template}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    return await response.json();
  }

  // Set guaranteed prize every N spins
  async setGuaranteedPrize(prizeId, spinCount, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/guaranteed-prize`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        template,
        guaranteedPrize: prizeId,
        guaranteedPrizeEnabled: true,
        guaranteedSpinCount: spinCount,
        guaranteedPrizeSequence: []
      })
    });
    return await response.json();
  }

  // Set guaranteed prize with sequence
  async setGuaranteedPrizeWithSequence(prizeId, spinCount, sequence, template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/guaranteed-prize`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        template,
        guaranteedPrize: prizeId,
        guaranteedPrizeEnabled: true,
        guaranteedSpinCount: spinCount,
        guaranteedPrizeSequence: sequence
      })
    });
    return await response.json();
  }

  // Disable guaranteed prize
  async disableGuaranteedPrize(template = 'default') {
    const response = await fetch(`${this.gatewayUrl}/api/gameplay/guaranteed-prize`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        template,
        guaranteedPrizeEnabled: false
      })
    });
    return await response.json();
  }
}

// Usage
const manager = new GuaranteedPrizeManager(GATEWAY_URL);

// Set guaranteed prize every 5 spins
await manager.setGuaranteedPrize('iphone_15_pro', 5);

// Set guaranteed prize with sequence
await manager.setGuaranteedPrizeWithSequence(
  'mega_prize',
  5,
  ['small_prize', 'medium_prize', 'small_prize', null]
);

// Get current settings
const settings = await manager.getSettings();
console.log('Current settings:', settings);

// Disable
await manager.disableGuaranteedPrize();
```

---

## 🎯 KEY POINTS

### Guaranteed Prize Settings
- ✅ **guaranteedPrize** - Prize ID to guarantee (must exist in prizes list)
- ✅ **guaranteedPrizeEnabled** - Enable/disable the feature
- ✅ **guaranteedSpinCount** - After how many spins (min: 2, max: 100)
- ✅ **guaranteedPrizeSequence** - Optional sequence before guaranteed prize

### How It Works
1. **When enabled:** Guaranteed prize is excluded from random selection until it's time
2. **Every Nth spin:** Guaranteed prize is awarded
3. **With sequence:** Sequence plays before guaranteed prize
4. **Cycle repeats:** Pattern repeats every N spins

### Important Notes
- Guaranteed prize must exist in the prizes list
- `guaranteedSpinCount` must be at least 2
- Sequence array length should be `guaranteedSpinCount - 1`
- Use `null` in sequence for random prize at that position
- Settings are stored per template

---

## 🔄 Alternative: Use Full Config Endpoint

You can also update guaranteed prize settings via the full config endpoint:

```http
POST /api/gameplay/config
Content-Type: application/json

{
  "template": "default",
  "guaranteedPrize": "prize1",
  "guaranteedPrizeEnabled": true,
  "guaranteedSpinCount": 5,
  "guaranteedPrizeSequence": []
}
```

The dedicated `/guaranteed-prize` endpoint is recommended for easier management.

---

**Last Updated:** 2024-11-25

