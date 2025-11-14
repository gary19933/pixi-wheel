import express from 'express';
import cors from 'cors';
import os from 'os';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'system', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// System information
app.get('/system', (req, res) => {
  try {
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown'
      },
      loadAverage: os.loadavg(),
      hostname: os.hostname(),
      timestamp: new Date().toISOString()
    };

    res.json(systemInfo);
  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Service status check (checks other microservices)
app.get('/services/status', async (req, res) => {
  const services = {
    gameplay: process.env.GAMEPLAY_URL || 'http://localhost:3001',
    probability: process.env.PROBABILITY_URL || 'http://localhost:3002',
    gateway: process.env.GATEWAY_URL || 'http://localhost:3000'
  };

  const status = {};

  for (const [name, url] of Object.entries(services)) {
    try {
      const response = await fetch(`${url}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      status[name] = {
        url,
        status: response.ok ? 'online' : 'error',
        statusCode: response.status
      };
    } catch (error) {
      status[name] = {
        url,
        status: 'offline',
        error: error.message
      };
    }
  }

  res.json({
    services: status,
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = {
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    system: {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg()
    },
    timestamp: new Date().toISOString()
  };

  res.json(metrics);
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    pong: true, 
    timestamp: new Date().toISOString(),
    service: 'system'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🖥️ System service running on http://localhost:${PORT}`);
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

