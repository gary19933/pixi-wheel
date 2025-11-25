# 🚀 Quick Start Guide - Microservices Demo

## For 3rd Party Team

This guide will help you quickly test and integrate with our microservices.

---

## Step 1: Start the Demo

The development team will run:
```bash
npm run demo
```

This will:
- ✅ Start all 4 microservices (Gateway, Gameplay, Probability, System)
- ✅ Create a public ngrok URL for the Gateway
- ✅ Display all API endpoints and URLs

**You will receive:**
- A public Gateway URL (e.g., `https://xxxx-xxxx.ngrok-free.app`)
- API documentation (this file + API-DEMO.md)

---

## Step 2: Test the API

### Quick Health Check
```bash
curl https://[GATEWAY-URL]/health
```

### Test a Complete Flow

1. **Create a Session**
```bash
curl -X POST https://[GATEWAY-URL]/api/gameplay/session \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"template": "default", "playerId": "test_player_123"}'
```

2. **Spin the Wheel**
```bash
curl -X POST https://[GATEWAY-URL]/api/gameplay/spin \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "sessionId": "session_123",
    "prizes": [
      {"id": "prize1", "name": "Gold", "weight": 10},
      {"id": "prize2", "name": "Silver", "weight": 20},
      {"id": "prize3", "name": "Bronze", "weight": 30}
    ],
    "spinCount": 1
  }'
```

3. **Claim the Prize**
```bash
curl -X POST https://[GATEWAY-URL]/api/gameplay/claim \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "id": "prize1",
    "prize": "Gold",
    "weight": 10,
    "sessionId": "session_123",
    "playerId": "test_player_123"
  }'
```

---

## Step 3: Integration Points

### For 3rd Party Backend Integration

**Set Player Spin Limits:**
```bash
curl -X POST https://[GATEWAY-URL]/api/gameplay/player/player_123/spins \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "maxSpins": 10,
    "template": "default"
  }'
```

**Check Player Spin Status:**
```bash
curl https://[GATEWAY-URL]/api/gameplay/player/player_123/spins?template=default \
  -H "ngrok-skip-browser-warning: true"
```

---

## 📋 Important Notes

1. **Always use the Gateway URL** - Don't call microservices directly
2. **Add the header** `ngrok-skip-browser-warning: true` to bypass ngrok warning page
3. **All requests go through Gateway** - The Gateway routes to appropriate services automatically
4. **See API-DEMO.md** for complete API documentation

---

## 🏗️ Architecture Overview

```
Your App/Backend
      ↓
Gateway (Public URL) ← You connect here
      ↓
   Routes to:
   ├─ Gameplay Service (game logic)
   ├─ Probability Service (weighted selection)
   └─ System Service (monitoring)
```

---

## 📞 Questions?

Contact the development team for:
- API access issues
- Integration questions
- Custom requirements

---

**Ready to integrate!** 🎉

