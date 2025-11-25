# Environment Setup Guide

## ✅ Environment Files Created

Your Neon database connection has been configured in the following files:

### 📁 Files Created:

1. **`.env`** (root directory)
   - Frontend environment variables
   - VITE_API_GATEWAY configuration

2. **`backend/.env`**
   - Backend service database connection
   - Port configuration
   - CORS settings

3. **`services/gameplay/.env`**
   - Gameplay service database connection
   - Port configuration

---

## 🔗 Database Connection

**Neon Database URL:**
```
postgresql://neondb_owner:npg_laZj2NdrwgS0@ep-wandering-rice-a101715o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

**Note:** 
- `channel_binding=require` is automatically removed by the code
- SSL mode is set to `require` for secure connections
- Connection pooling is enabled

---

## 🧪 Testing the Connection

### Test Backend Connection:
```bash
cd backend
npm start
```

You should see:
```
✅ Connected to Neon database
✅ Using Neon database for storage
```

### Test Gameplay Service Connection:
```bash
cd services/gameplay
node server.js
```

You should see:
```
✅ Connected to Neon database
```

---

## 📝 Environment Variables Reference

### Backend Service (`backend/.env`)
```env
DATABASE_URL=postgresql://neondb_owner:password@host/database?sslmode=require
PORT=3000
ALLOWED_ORIGINS=*
```

### Gameplay Service (`services/gameplay/.env`)
```env
DATABASE_URL=postgresql://neondb_owner:password@host/database?sslmode=require
PORT=3001
```

### Frontend (`.env`)
```env
VITE_API_GATEWAY=http://localhost:3000
VITE_USE_MICROSERVICE_FOR_SPIN=false
```

---

## 🔒 Security Notes

1. **`.env` files are in `.gitignore`** - They won't be committed to git
2. **Never commit database credentials** to version control
3. **Use different credentials** for production environments
4. **Rotate passwords** regularly

---

## 🚀 Next Steps

1. **Start your services:**
   ```bash
   npm run demo
   ```

2. **Verify database connection:**
   - Check console logs for "✅ Connected to Neon database"
   - If you see "⚠️ Using in-memory storage", check your `.env` files

3. **Test API endpoints:**
   - Health check: `GET /health`
   - Gameplay: `GET /api/gameplay/config`

---

## ❓ Troubleshooting

### Issue: "DATABASE_URL not set"
- **Solution:** Make sure `.env` files exist in the correct directories
- Check that `dotenv` package is installed: `npm install dotenv`

### Issue: "Connection timeout"
- **Solution:** Check your internet connection
- Verify the database URL is correct
- Check Neon dashboard for database status

### Issue: "SSL connection error"
- **Solution:** The code automatically sets `rejectUnauthorized: false` for Neon
- Make sure `sslmode=require` is in your connection string

---

**Last Updated:** 2024-11-25

