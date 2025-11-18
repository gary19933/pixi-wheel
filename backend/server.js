import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { UAParser } from 'ua-parser-js';
import { initDatabase, createTables, db, isDatabaseAvailable } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*',
  credentials: true
}));
app.use(express.json());

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// In-memory storage (fallback if database not available)
const gameHistory = [];
const gameSessions = new Map();

// Initialize database on startup
(async () => {
  try {
    const pool = initDatabase();
    if (pool) {
      // Test connection first
      try {
        await pool.query('SELECT 1');
        await createTables();
        console.log('✅ Using Neon database for storage');
      } catch (dbError) {
        console.error('❌ Database connection test failed:', dbError.message);
        console.log('⚠️  Falling back to in-memory storage');
        pool.end().catch(() => {}); // Close the pool
      }
    } else {
      console.log('⚠️  Using in-memory storage (DATABASE_URL not set)');
    }
  } catch (error) {
    console.error('❌ Database initialization failed, using in-memory storage:', error.message);
  }
})();

// Device info extraction
function getDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || '';
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  const isApp = req.headers['x-app-version'] || req.headers['x-app-name'] || 
                userAgent.includes('MyApp') || userAgent.includes('AppName');
  
  return {
    userAgent: userAgent,
    device: {
      type: result.device.type || 'desktop',
      vendor: result.device.vendor || null,
      model: result.device.model || null
    },
    os: {
      name: result.os.name || 'Unknown',
      version: result.os.version || null
    },
    browser: {
      name: result.browser.name || 'Unknown',
      version: result.browser.version || null
    },
    engine: {
      name: result.engine.name || null,
      version: result.engine.version || null
    },
    cpu: {
      architecture: result.cpu.architecture || null
    },
    isApp: !!isApp,
    appInfo: isApp ? {
      name: req.headers['x-app-name'] || null,
      version: req.headers['x-app-version'] || null,
      platform: req.headers['x-app-platform'] || null
    } : null,
    ip: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || null
  };
}

// Probability functions (built-in, no separate service needed)
function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let random = Math.random() * total;
  
  for (const item of items) {
    random -= (item.weight || 1);
    if (random <= 0) {
      return item;
    }
  }
  
  return items[items.length - 1];
}

function calculateProbabilities(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  
  return items.map(item => ({
    ...item,
    probability: ((item.weight || 1) / total) * 100,
    probabilityDecimal: (item.weight || 1) / total
  }));
}

// Game config
let gameConfig = {
  prizes: [],
  guaranteedPrize: null,
  guaranteedPrizeEnabled: false,
  guaranteedSpinCount: 5,
  guaranteedPrizeSequence: []
};

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'pixi-wheel-api',
    database: isDatabaseAvailable() ? 'connected' : 'in-memory',
    timestamp: new Date().toISOString() 
  });
});

// Get/Update game configuration (by template)
app.get('/api/gameplay/config', async (req, res) => {
  try {
    const templateName = req.query.template || 'default';
    
    if (isDatabaseAvailable()) {
      const config = await db.getConfig(templateName);
      res.json({
        config: config,
        template: templateName,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        config: { ...gameConfig, templateName },
        template: templateName,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Config get error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gameplay/config', async (req, res) => {
  try {
    const { 
      template = 'default',
      prizes, 
      guaranteedPrize, 
      guaranteedPrizeEnabled, 
      guaranteedSpinCount, 
      guaranteedPrizeSequence,
      designConfig,
      displayName,
      description
    } = req.body;
    
    const configUpdate = {
      prizes: prizes && Array.isArray(prizes) ? prizes : gameConfig.prizes,
      guaranteedPrize: guaranteedPrize !== undefined ? guaranteedPrize : gameConfig.guaranteedPrize,
      guaranteedPrizeEnabled: guaranteedPrizeEnabled !== undefined ? guaranteedPrizeEnabled : gameConfig.guaranteedPrizeEnabled,
      guaranteedSpinCount: guaranteedSpinCount !== undefined 
        ? Math.max(2, Math.min(prizes?.length || 100, guaranteedSpinCount)) 
        : gameConfig.guaranteedSpinCount,
      guaranteedPrizeSequence: guaranteedPrizeSequence !== undefined ? guaranteedPrizeSequence : gameConfig.guaranteedPrizeSequence,
      designConfig: designConfig || {},
      displayName: displayName,
      description: description
    };
    
    if (isDatabaseAvailable()) {
      await db.updateConfig(configUpdate, template);
      const updatedConfig = await db.getConfig(template);
      res.json({ success: true, config: updatedConfig, template });
    } else {
      gameConfig = { ...gameConfig, ...configUpdate };
      res.json({ success: true, config: gameConfig, template });
    }
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Template management endpoints
app.get('/api/templates', async (req, res) => {
  try {
    if (isDatabaseAvailable()) {
      const templates = await db.getTemplates();
      res.json({ templates, count: templates.length });
    } else {
      res.json({ templates: [{ name: 'default', displayName: 'Default Template' }], count: 1 });
    }
  } catch (error) {
    console.error('Templates get error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const { name, displayName, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    
    if (isDatabaseAvailable()) {
      const template = await db.createTemplate({ name, displayName, description });
      res.json({ success: true, template });
    } else {
      res.status(503).json({ error: 'Database not available' });
    }
  } catch (error) {
    console.error('Template create error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    if (name === 'default') {
      return res.status(400).json({ error: 'Cannot delete default template' });
    }
    
    if (isDatabaseAvailable()) {
      const deleted = await db.deleteTemplate(name);
      if (deleted) {
        res.json({ success: true, message: `Template ${name} deleted` });
      } else {
        res.status(404).json({ error: 'Template not found' });
      }
    } else {
      res.status(503).json({ error: 'Database not available' });
    }
  } catch (error) {
    console.error('Template delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Spin endpoint
app.post('/api/gameplay/spin', async (req, res) => {
  try {
    const { 
      sessionId, 
      prizes, 
      guaranteedPrize, 
      guaranteedPrizeEnabled, 
      guaranteedSpinCount, 
      guaranteedPrizeSequence,
      spinCount 
    } = req.body;

    if (!prizes || !Array.isArray(prizes) || prizes.length === 0) {
      return res.status(400).json({ error: 'Invalid prizes array' });
    }

    // Determine which prize to use this spin
    let useGuaranteedPrize = false;
    let useSequencePrize = null;
    const hasGuaranteedPrize = guaranteedPrize && typeof guaranteedPrize === 'string' && guaranteedPrize.trim();
    
    if (hasGuaranteedPrize) {
      if (guaranteedPrizeEnabled) {
        const targetSpin = guaranteedSpinCount || 5;
        const currentSpin = spinCount || 1;
        const positionInCycle = ((currentSpin - 1) % targetSpin);
        
        const sequence = guaranteedPrizeSequence || [];
        const hasSequence = sequence && Array.isArray(sequence) && sequence.length > 0 && 
                           sequence.some(v => v && typeof v === 'string' && v.trim());
        
        if (hasSequence) {
          if (positionInCycle < targetSpin - 1) {
            const sequencePrizeId = sequence[positionInCycle];
            if (sequencePrizeId && typeof sequencePrizeId === 'string' && sequencePrizeId.trim()) {
              useSequencePrize = sequencePrizeId;
            }
          } else {
            useGuaranteedPrize = true;
          }
        } else {
          useGuaranteedPrize = (currentSpin % targetSpin === 0);
        }
      } else {
        useGuaranteedPrize = true;
      }
    }

    const excludeGuaranteed = guaranteedPrizeEnabled && hasGuaranteedPrize && !useSequencePrize && !useGuaranteedPrize;
    const prizesToUse = excludeGuaranteed 
      ? prizes.filter(p => p.id !== guaranteedPrize)
      : prizes;

    const prizeIdToUse = useSequencePrize || (useGuaranteedPrize ? guaranteedPrize : null);

    // Use built-in probability function (no separate service needed)
    let selected;
    if (prizeIdToUse) {
      selected = prizesToUse.find(item => item.id === prizeIdToUse);
      if (!selected) {
        selected = pickWeighted(prizesToUse);
      }
    } else {
      selected = pickWeighted(prizesToUse);
    }

    const probabilities = calculateProbabilities(prizesToUse);
    const selectedProbability = probabilities.find(p => p.id === selected.id);

    // Calculate spin animation parameters
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const duration = 4.25 + Math.random() * 0.9;

    const deviceInfo = getDeviceInfo(req);
    
    const result = {
      prize: selected,
      sessionId: sessionId || `session_${Date.now()}`,
      timestamp: new Date().toISOString(),
      animation: {
        fullSpins,
        duration: Math.round(duration * 100) / 100
      },
      probability: selectedProbability ? selectedProbability.probability : 0,
      spinCount: spinCount || 1,
      usedSequence: useSequencePrize ? true : false,
      usedGuaranteed: useGuaranteedPrize,
      device: deviceInfo
    };

    // Store in history
    if (isDatabaseAvailable()) {
      try {
        await db.saveSpinResult(result);
      } catch (dbError) {
        console.error('Database save error, using in-memory:', dbError);
        gameHistory.push(result);
        if (gameHistory.length > 10000) {
          gameHistory.shift();
        }
      }
    } else {
      gameHistory.push(result);
      if (gameHistory.length > 10000) {
        gameHistory.shift();
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Spin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim prize endpoint
app.post('/api/gameplay/claim', async (req, res) => {
  try {
    const { id, prize, weight, ts, template, sessionId, prizes, playerId } = req.body;
    
    // Check spin limit if playerId or sessionId provided
    let session = null;
    if (sessionId) {
      if (isDatabaseAvailable()) {
        session = await db.getSession(sessionId);
      } else {
        session = gameSessions.get(sessionId);
      }
    }
    
    // Check player spin limit (from 3rd party backend) - priority
    if (playerId && isDatabaseAvailable()) {
      try {
        const playerLimit = await db.getPlayerSpinLimit(playerId, template);
        if (playerLimit && playerLimit.max_spins !== null) {
          const currentCount = await db.getPlayerSpinCount(playerId, template);
          if (currentCount >= playerLimit.max_spins) {
            return res.status(403).json({ 
              error: 'Spin limit reached', 
              playerId,
              currentSpins: currentCount,
              maxSpins: playerLimit.max_spins,
              remainingSpins: 0
            });
          }
        }
      } catch (e) {
        console.warn('Failed to check player spin limit:', e.message);
      }
    }
    
    // Also check session limit as fallback
    if (session && session.maxSpins !== null) {
      const currentSpins = session.spins || 0;
      if (currentSpins >= session.maxSpins) {
        return res.status(403).json({ 
          error: 'Spin limit reached', 
          spins: currentSpins,
          maxSpins: session.maxSpins,
          remainingSpins: 0
        });
      }
    }

    let probability = null;
    let probabilityDecimal = null;
    
    if (prizes && Array.isArray(prizes) && prizes.length > 0) {
      const totalWeight = prizes.reduce((sum, p) => sum + (p.weight || 1), 0);
      const prizeWeight = weight || 1;
      probabilityDecimal = prizeWeight / totalWeight;
      probability = probabilityDecimal * 100;
    }

    const deviceInfo = getDeviceInfo(req);
    
    const claim = {
      id,
      prize,
      weight,
      probability: probability ? Math.round(probability * 100) / 100 : null,
      probabilityDecimal: probabilityDecimal ? Math.round(probabilityDecimal * 10000) / 10000 : null,
      timestamp: ts || new Date().toISOString(),
      template: template || 'default',
      sessionId: sessionId || `session_${Date.now()}`,
      claimedAt: new Date().toISOString(),
      device: deviceInfo
    };

    // Increment session spin count
    if (sessionId) {
      if (isDatabaseAvailable()) {
        try {
          await db.incrementSessionSpins(sessionId);
        } catch (e) {
          console.warn('Failed to increment session spins:', e.message);
        }
      } else {
        const memSession = gameSessions.get(sessionId);
        if (memSession) {
          memSession.spins = (memSession.spins || 0) + 1;
        }
      }
    }
    
    // Update session with playerId if provided
    if (playerId && sessionId && isDatabaseAvailable()) {
      try {
        await db.updateSessionPlayerId(sessionId, playerId);
      } catch (e) {
        console.warn('Failed to update session playerId:', e.message);
      }
    }
    
    // Store claim
    if (isDatabaseAvailable()) {
      try {
        const saved = await db.saveClaim(claim);
        console.log('✅ Claim saved to database:', saved?.id || 'success');
      } catch (dbError) {
        console.error('❌ Database save error:', dbError.message);
        console.error('   Falling back to in-memory storage');
        gameHistory.push({ ...claim, type: 'claim' });
      }
    } else {
      console.log('⚠️  Using in-memory storage (database not available)');
      gameHistory.push({ ...claim, type: 'claim' });
    }
    
    // Get updated session info and player spin info
    let sessionInfo = null;
    let playerSpinInfo = null;
    
    if (sessionId) {
      if (isDatabaseAvailable()) {
        sessionInfo = await db.getSession(sessionId);
      } else {
        const memSession = gameSessions.get(sessionId);
        if (memSession) {
          sessionInfo = {
            ...memSession,
            remainingSpins: memSession.maxSpins 
              ? Math.max(0, memSession.maxSpins - (memSession.spins || 0)) 
              : null
          };
        }
      }
    }
    
    // Get player spin info if playerId provided
    if (playerId && isDatabaseAvailable()) {
      try {
        const limit = await db.getPlayerSpinLimit(playerId, template);
        const currentCount = await db.getPlayerSpinCount(playerId, template);
        const maxSpins = limit ? limit.max_spins : null;
        const remainingSpins = maxSpins !== null ? Math.max(0, maxSpins - currentCount) : null;
        
        playerSpinInfo = {
          playerId,
          maxSpins,
          currentSpins: currentCount,
          remainingSpins
        };
      } catch (e) {
        console.warn('Failed to get player spin info:', e.message);
      }
    }

    res.json({ 
      success: true, 
      claim,
      session: sessionInfo ? {
        spins: sessionInfo.spins || 0,
        maxSpins: sessionInfo.maxSpins,
        remainingSpins: sessionInfo.remainingSpins
      } : null,
      player: playerSpinInfo
    });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get game history (optionally filter by template)
app.get('/api/gameplay/history', async (req, res) => {
  try {
    const { limit = 100, sessionId, template } = req.query;
    
    if (isDatabaseAvailable()) {
      const history = await db.getHistory(
        parseInt(limit), 
        sessionId || null,
        template || null
      );
      res.json({
        count: history.length,
        history: history,
        template: template || 'all'
      });
    } else {
      let history = gameHistory;
      if (sessionId) {
        history = history.filter(h => h.sessionId === sessionId);
      }
      if (template) {
        history = history.filter(h => h.template === template);
      }
      res.json({
        count: history.length,
        history: history.slice(-parseInt(limit)),
        template: template || 'all'
      });
    }
  } catch (error) {
    console.error('History get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get game statistics (optionally filter by template)
app.get('/api/gameplay/stats', async (req, res) => {
  try {
    const { template } = req.query;
    let stats;
    
    if (isDatabaseAvailable()) {
      const dbStats = await db.getStats(template || null);
      const history = await db.getHistory(10000, null, template || null);
      
      const deviceStats = {
        byDeviceType: {},
        byOS: {},
        byBrowser: {},
        byApp: { app: 0, web: 0 }
      };
      
      history.forEach(entry => {
        if (entry.device && typeof entry.device === 'object') {
          const device = entry.device;
          const deviceType = device.device?.type || 'unknown';
          deviceStats.byDeviceType[deviceType] = (deviceStats.byDeviceType[deviceType] || 0) + 1;
          
          const osName = device.os?.name || 'unknown';
          deviceStats.byOS[osName] = (deviceStats.byOS[osName] || 0) + 1;
          
          const browserName = device.browser?.name || 'unknown';
          deviceStats.byBrowser[browserName] = (deviceStats.byBrowser[browserName] || 0) + 1;
          
          if (device.isApp) {
            deviceStats.byApp.app++;
          } else {
            deviceStats.byApp.web++;
          }
        }
      });
      
      stats = {
        template: template || 'all',
        totalSpins: dbStats.totalSpins,
        totalClaims: dbStats.totalClaims,
        activeSessions: dbStats.activeSessions,
        deviceStats: deviceStats,
        timestamp: new Date().toISOString()
      };
    } else {
      const spins = gameHistory.filter(h => h.prize);
      const claims = gameHistory.filter(h => h.type === 'claim');
      
      const deviceStats = {
        byDeviceType: {},
        byOS: {},
        byBrowser: {},
        byApp: { app: 0, web: 0 }
      };
      
      [...spins, ...claims].forEach(entry => {
        if (entry.device) {
          const deviceType = entry.device.device?.type || 'unknown';
          deviceStats.byDeviceType[deviceType] = (deviceStats.byDeviceType[deviceType] || 0) + 1;
          
          const osName = entry.device.os?.name || 'unknown';
          deviceStats.byOS[osName] = (deviceStats.byOS[osName] || 0) + 1;
          
          const browserName = entry.device.browser?.name || 'unknown';
          deviceStats.byBrowser[browserName] = (deviceStats.byBrowser[browserName] || 0) + 1;
          
          if (entry.device.isApp) {
            deviceStats.byApp.app++;
          } else {
            deviceStats.byApp.web++;
          }
        }
      });
      
      stats = {
        totalSpins: spins.length,
        totalClaims: claims.length,
        activeSessions: gameSessions.size,
        deviceStats: deviceStats,
        timestamp: new Date().toISOString()
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Stats get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create game session
app.post('/api/gameplay/session', async (req, res) => {
  try {
    const { template, playerId } = req.body;
    const deviceInfo = getDeviceInfo(req);
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get max spins from player limits (3rd party backend controlled)
    let sessionMaxSpins = null;
    if (playerId && isDatabaseAvailable()) {
      try {
        const playerLimit = await db.getPlayerSpinLimit(playerId, template);
        if (playerLimit) {
          sessionMaxSpins = playerLimit.max_spins;
        }
      } catch (e) {
        console.warn('Failed to get player spin limit:', e.message);
      }
    }
    
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      spins: 0,
      maxSpins: sessionMaxSpins,
      claims: [],
      device: deviceInfo,
      template: template || null,
      playerId: playerId || null
    };

    if (isDatabaseAvailable()) {
      try {
        await db.saveSession(session);
      } catch (dbError) {
        console.error('Database save error, using in-memory:', dbError);
        gameSessions.set(sessionId, session);
      }
    } else {
      gameSessions.set(sessionId, session);
    }

    res.json(session);
  } catch (error) {
    console.error('Session create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 3RD PARTY BACKEND API ENDPOINTS ==========

// Set player spin limit (for URewards/3rd party backend)
app.post('/api/gameplay/player/:playerId/spins', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { maxSpins, template } = req.body;
    
    if (maxSpins !== null && maxSpins !== undefined && (typeof maxSpins !== 'number' || maxSpins < 0)) {
      return res.status(400).json({ error: 'maxSpins must be a non-negative number or null' });
    }
    
    if (!isDatabaseAvailable()) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const result = await db.setPlayerSpinLimit(playerId, maxSpins, template || null);
    
    res.json({
      success: true,
      playerId,
      maxSpins: result.max_spins,
      template: result.template,
      updatedAt: result.updated_at
    });
  } catch (error) {
    console.error('Set player spin limit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get player spin limit and current count
app.get('/api/gameplay/player/:playerId/spins', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { template } = req.query;
    
    if (!isDatabaseAvailable()) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const limit = await db.getPlayerSpinLimit(playerId, template || null);
    const currentCount = await db.getPlayerSpinCount(playerId, template || null);
    
    const maxSpins = limit ? limit.max_spins : null;
    const remainingSpins = maxSpins !== null ? Math.max(0, maxSpins - currentCount) : null;
    
    res.json({
      playerId,
      maxSpins,
      currentSpins: currentCount,
      remainingSpins,
      template: limit?.template || template || null
    });
  } catch (error) {
    console.error('Get player spin limit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session info
app.get('/api/gameplay/session/:sessionId', async (req, res) => {
  try {
    let session;
    
    if (isDatabaseAvailable()) {
      session = await db.getSession(req.params.sessionId);
    } else {
      const memSession = gameSessions.get(req.params.sessionId);
      if (memSession) {
        session = {
          ...memSession,
          remainingSpins: memSession.maxSpins 
            ? Math.max(0, memSession.maxSpins - (memSession.spins || 0)) 
            : null
        };
      }
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Session get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if session can spin
app.get('/api/gameplay/session/:sessionId/can-spin', async (req, res) => {
  try {
    let session;
    
    if (isDatabaseAvailable()) {
      session = await db.getSession(req.params.sessionId);
    } else {
      const memSession = gameSessions.get(req.params.sessionId);
      if (memSession) {
        session = {
          ...memSession,
          remainingSpins: memSession.maxSpins 
            ? Math.max(0, memSession.maxSpins - (memSession.spins || 0)) 
            : null
        };
      }
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found', canSpin: false });
    }
    
    const canSpin = session.maxSpins === null || (session.spins || 0) < session.maxSpins;
    const remainingSpins = session.maxSpins 
      ? Math.max(0, session.maxSpins - (session.spins || 0))
      : null;
    
    res.json({
      canSpin,
      spins: session.spins || 0,
      maxSpins: session.maxSpins,
      remainingSpins
    });
  } catch (error) {
    console.error('Can spin check error:', error);
    res.status(500).json({ error: error.message, canSpin: false });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Pixi Wheel API running on http://localhost:${PORT}`);
  console.log(`   Database: ${isDatabaseAvailable() ? 'Neon (connected)' : 'In-memory'}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

