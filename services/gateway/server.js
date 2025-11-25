import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Service URLs
const GAMEPLAY_URL = process.env.GAMEPLAY_URL || 'http://localhost:3001';
const PROBABILITY_URL = process.env.PROBABILITY_URL || 'http://localhost:3002';
const SYSTEM_URL = process.env.SYSTEM_URL || process.env.MONITORING_URL || process.env.IT_URL || 'http://localhost:3003';

// CORS configuration - allow frontend domain in production
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*', // Allow all in development, restrict in production
  credentials: true
}));
app.use(express.json());

// Root route - API information page
app.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pixi Wheel API Gateway</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 800px;
          width: 100%;
          padding: 40px;
        }
        h1 {
          color: #667eea;
          margin-bottom: 10px;
          font-size: 32px;
        }
        .subtitle {
          color: #666;
          margin-bottom: 30px;
          font-size: 16px;
        }
        .status {
          background: #4CAF50;
          color: white;
          padding: 12px 20px;
          border-radius: 6px;
          display: inline-block;
          margin-bottom: 30px;
          font-weight: 600;
        }
        .section {
          margin: 30px 0;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }
        .section h2 {
          color: #333;
          margin-bottom: 15px;
          font-size: 20px;
        }
        .endpoint {
          background: white;
          padding: 12px;
          margin: 8px 0;
          border-radius: 4px;
          border-left: 4px solid #667eea;
          font-family: 'Courier New', monospace;
          font-size: 14px;
        }
        .endpoint a {
          color: #667eea;
          text-decoration: none;
        }
        .endpoint a:hover {
          text-decoration: underline;
        }
        .btn {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          margin: 10px 10px 10px 0;
          font-weight: 600;
          transition: background 0.3s;
        }
        .btn:hover {
          background: #5568d3;
        }
        .btn-secondary {
          background: #4CAF50;
        }
        .btn-secondary:hover {
          background: #45a049;
        }
        .info {
          background: #e3f2fd;
          border-left: 4px solid #2196F3;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎮 Pixi Wheel API Gateway</h1>
        <p class="subtitle">Microservices API Gateway - Ready for Integration</p>
        <div class="status">✅ Service Online</div>
        
        <div class="section">
          <h2>📡 Quick Links</h2>
          <a href="${baseUrl}/health" class="btn">Health Check</a>
          <a href="${baseUrl}/api/gameplay/stats" class="btn btn-secondary">View Stats</a>
          <a href="${baseUrl}/api/gameplay/history?limit=50" class="btn btn-secondary">View History</a>
        </div>
        
        <div class="section">
          <h2>🔗 API Endpoints</h2>
          <div class="endpoint">
            <strong>GET</strong> <a href="${baseUrl}/health">/health</a> - Service health check
          </div>
          <div class="endpoint">
            <strong>GET</strong> <a href="${baseUrl}/api/gameplay/config">/api/gameplay/config</a> - Get game configuration
          </div>
          <div class="endpoint">
            <strong>POST</strong> /api/gameplay/spin - Spin the wheel
          </div>
          <div class="endpoint">
            <strong>POST</strong> /api/gameplay/claim - Claim a prize
          </div>
          <div class="endpoint">
            <strong>GET</strong> <a href="${baseUrl}/api/gameplay/history?limit=50">/api/gameplay/history</a> - Get game history
          </div>
          <div class="endpoint">
            <strong>GET</strong> <a href="${baseUrl}/api/gameplay/stats">/api/gameplay/stats</a> - Get statistics
          </div>
          <div class="endpoint">
            <strong>POST</strong> /api/probability/select - Select weighted item
          </div>
          <div class="endpoint">
            <strong>GET</strong> <a href="${baseUrl}/api/system/system">/api/system/system</a> - System information
          </div>
        </div>
        
        <div class="info">
          <strong>💡 Note:</strong> This is the API Gateway. For the full game interface, you need to access the frontend application.
          <br><br>
          <strong>For 3rd Party Integration:</strong> All API calls should go through this Gateway URL.
          <br><br>
          <strong>Headers:</strong> Add <code>ngrok-skip-browser-warning: true</code> to bypass ngrok warning page.
        </div>
        
        <div class="section">
          <h2>📚 Documentation</h2>
          <p>See <code>API-DEMO.md</code> for complete API documentation with examples.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

// Gameplay routes
app.use('/api/gameplay', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${GAMEPLAY_URL}${req.path}`,
      data: req.body,
      params: req.query,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: 'gameplay'
    });
  }
});

// Probability routes
app.use('/api/probability', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${PROBABILITY_URL}${req.path}`,
      data: req.body,
      params: req.query,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: 'probability'
    });
  }
});

// System routes (backward compatible with /api/monitoring and /api/it)
app.use('/api/system', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${SYSTEM_URL}${req.path}`,
      data: req.body,
      params: req.query,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: 'system'
    });
  }
});

// Backward compatibility: redirect /api/monitoring to /api/system
app.use('/api/monitoring', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${SYSTEM_URL}${req.path}`,
      data: req.body,
      params: req.query,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: 'system'
    });
  }
});

// Backward compatibility: redirect /api/it to /api/system
app.use('/api/it', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${SYSTEM_URL}${req.path}`,
      data: req.body,
      params: req.query,
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.message,
      service: 'system'
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Gateway service running on http://localhost:${PORT}`);
  console.log(`   Gameplay: ${GAMEPLAY_URL}`);
  console.log(`   Probability: ${PROBABILITY_URL}`);
  console.log(`   System: ${SYSTEM_URL}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Please stop the process using this port or run: npm run services:kill`);
    console.error(`   To find the process: netstat -ano | findstr :${PORT}\n`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

