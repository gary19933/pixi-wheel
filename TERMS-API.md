# Terms & Conditions API Documentation

## Overview

Terms & Conditions are now stored in the database and can be managed by the 3rd party team through the API.

---

## 📋 API Endpoints

### Get Terms & Conditions

```http
GET /api/gameplay/terms?template=default
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

---

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

---

### Get Full Config (includes Terms)

```http
GET /api/gameplay/config?template=default
```

**Response includes:**
```json
{
  "config": {
    "prizes": [...],
    "guaranteedPrize": "...",
    "termsAndConditions": "...",
    ...
  }
}
```

---

### Update Full Config (includes Terms)

```http
POST /api/gameplay/config
Content-Type: application/json

{
  "template": "default",
  "prizes": [...],
  "termsAndConditions": "Your terms here...",
  ...
}
```

---

## 📝 Example Usage

### cURL Examples

**Get Terms:**
```bash
curl https://[GATEWAY-URL]/api/gameplay/terms?template=default \
  -H "ngrok-skip-browser-warning: true"
```

**Update Terms:**
```bash
curl -X PUT https://[GATEWAY-URL]/api/gameplay/terms \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "template": "default",
    "termsAndConditions": "By participating you agree:\n• One spin per session.\n• Prizes are non-transferable."
  }'
```

---

### JavaScript Example

```javascript
const GATEWAY_URL = 'https://[your-ngrok-url].ngrok-free.app';

// Get Terms
async function getTerms(template = 'default') {
  const response = await fetch(`${GATEWAY_URL}/api/gameplay/terms?template=${template}`, {
    headers: {
      'ngrok-skip-browser-warning': 'true'
    }
  });
  const data = await response.json();
  return data.termsAndConditions;
}

// Update Terms
async function updateTerms(terms, template = 'default') {
  const response = await fetch(`${GATEWAY_URL}/api/gameplay/terms`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({
      template: template,
      termsAndConditions: terms
    })
  });
  const data = await response.json();
  return data;
}

// Usage
const terms = await getTerms('default');
console.log('Current terms:', terms);

await updateTerms('New terms and conditions...', 'default');
```

---

## 🗄️ Database Storage

Terms & Conditions are stored in the `game_config` table:

- **Column:** `terms_and_conditions` (TEXT)
- **Per Template:** Each template can have its own terms
- **Nullable:** Can be null if not set

---

## ✅ Features

- ✅ Store terms in database
- ✅ Per-template terms support
- ✅ Dedicated GET/PUT endpoints
- ✅ Included in full config endpoint
- ✅ Accessible via Gateway
- ✅ 3rd party team can edit via API

---

## 📌 Notes

1. **Template Support:** Terms are stored per template, allowing different terms for different game configurations
2. **Text Format:** Terms are stored as plain text (supports newlines with `\n`)
3. **Frontend Integration:** The frontend automatically syncs terms when saving templates
4. **Default Template:** If no template is specified, uses `'default'`

---

**Last Updated:** 2024-11-25

