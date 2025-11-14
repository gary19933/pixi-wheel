import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Service URLs
const GAMEPLAY_URL = process.env.GAMEPLAY_URL || 'http://localhost:3001';
const PROBABILITY_URL = process.env.PROBABILITY_URL || 'http://localhost:3002';
const SYSTEM_URL = process.env.SYSTEM_URL || process.env.MONITORING_URL || process.env.IT_URL || 'http://localhost:3003';

app.use(cors());
app.use(express.json());

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

