# 📊 How to View Your Game Data

When you play on your ngrok URL (`https://016df2a20130.ngrok-free.app`), here are **3 ways** to see the data:

---

## 🖥️ Method 1: Server Console Logs (Terminal)

**Where:** In the terminal where you ran `npm run demo`

**What you'll see:**
- Database connection status
- API requests being received
- Errors (if any)
- Database save confirmations

**Example output:**
```
✅ Connected to Neon database
✅ Database tables initialized
POST /api/gameplay/spin 200
✅ Claim saved to database: 123
```

---

## 🌐 Method 2: Browser Console (F12)

**How to access:**
1. Open your game URL: `https://016df2a20130.ngrok-free.app`
2. Press **F12** (or Right-click → Inspect)
3. Go to the **Console** tab

**What you'll see:**
- Frontend JavaScript logs
- API request/response data
- Errors from the frontend
- Network requests (in Network tab)

**To see API responses:**
1. Open **Network** tab in DevTools
2. Play the game (spin the wheel)
3. Click on the API request (e.g., `/api/gameplay/spin`)
4. View the **Response** tab to see the data returned

---

## 📊 Method 3: Data Viewer Page (Recommended!)

I've created a **Data Viewer** page for you!

### How to use:

1. **Open the viewer:**
   - Local: Open `view-data.html` in your browser
   - Or visit: `https://016df2a20130.ngrok-free.app/view-data.html` (if you serve it)

2. **Set your Gateway URL:**
   - Enter: `https://016df2a20130.ngrok-free.app`
   - Click "Set URL"

3. **View data:**
   - Click **"📊 Load Stats"** to see statistics
   - Click **"📜 Load History"** to see game history
   - Select how many records to show (10, 50, 100, 500)

### What you can see:

- **Total Spins** - How many times the wheel was spun
- **Total Claims** - How many prizes were claimed
- **Active Sessions** - Current game sessions
- **Device Stats** - Mobile vs Web users
- **Game History** - All spins and claims with:
  - Session ID
  - Prize won
  - Timestamp
  - Device information

---

## 🔗 Method 4: Direct API Calls

You can also call the API directly:

### View Stats:
```bash
curl https://016df2a20130.ngrok-free.app/api/gameplay/stats \
  -H "ngrok-skip-browser-warning: true"
```

### View History:
```bash
curl https://016df2a20130.ngrok-free.app/api/gameplay/history?limit=50 \
  -H "ngrok-skip-browser-warning: true"
```

### In Browser:
Just open these URLs:
- Stats: `https://016df2a20130.ngrok-free.app/api/gameplay/stats`
- History: `https://016df2a20130.ngrok-free.app/api/gameplay/history?limit=50`

**Note:** Add the header `ngrok-skip-browser-warning: true` to bypass ngrok warning page.

---

## 📝 Quick Test

1. **Play the game** on your ngrok URL
2. **Spin the wheel** a few times
3. **Open the Data Viewer** (`view-data.html`)
4. **Click "Load History"** - you should see your spins!

---

## 🎯 Recommended Workflow

1. **During development:** Use **Browser Console (F12)** to debug
2. **To view all data:** Use **Data Viewer page** (`view-data.html`)
3. **To monitor server:** Watch the **terminal console** where `npm run demo` is running

---

## ❓ Troubleshooting

### "No data showing"
- Make sure you've actually played the game (spun the wheel)
- Check that the database connection is working (look for "✅ Connected to Neon database" in terminal)
- Verify the Gateway URL is correct

### "CORS error"
- Make sure you're using the Gateway URL, not direct service URLs
- Check that `ALLOWED_ORIGINS=*` is set in `backend/.env`

### "ngrok warning page"
- Add header: `ngrok-skip-browser-warning: true`
- Or use a browser extension like ModHeader

---

**Happy viewing!** 🎉

