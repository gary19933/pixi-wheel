import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { UAParser } from 'ua-parser-js';
import { initDatabase, createTables, db, isDatabaseAvailable } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Trust proxy for accurate IP detection (important if behind reverse proxy/load balancer)
app.set('trust proxy', true);

// Function to extract device information from request
function getDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || '';
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  // Detect if it's a mobile app (custom header or user agent pattern)
  const isApp = req.headers['x-app-version'] || req.headers['x-app-name'] || 
                userAgent.includes('MyApp') || userAgent.includes('AppName');
  
  return {
    userAgent: userAgent,
    device: {
      type: result.device.type || 'desktop', // mobile, tablet, desktop, etc.
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

// In-memory storage (fallback if database not available)
const gameHistory = [];
const gameSessions = new Map();

// Initialize database on startup
(async () => {
  try {
    const pool = initDatabase();
    if (pool) {
      await createTables();
      console.log('✅ Using Neon database for storage');
    } else {
      console.log('⚠️  Using in-memory storage (DATABASE_URL not set)');
    }
  } catch (error) {
    console.error('❌ Database initialization failed, using in-memory storage:', error.message);
  }
})();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'gameplay', 
    database: isDatabaseAvailable() ? 'connected' : 'in-memory',
    timestamp: new Date().toISOString() 
  });
});

// Store game configuration (in-memory fallback)
let gameConfig = {
  prizes: [],
  guaranteedPrize: null,
  guaranteedPrizeEnabled: false,
  guaranteedSpinCount: 5,
  guaranteedPrizeSequence: []
};

// Update game configuration endpoint
app.post('/config', async (req, res) => {
  try {
    const { prizes, guaranteedPrize, guaranteedPrizeEnabled, guaranteedSpinCount, guaranteedPrizeSequence } = req.body;
    
    const configUpdate = {
      prizes: prizes && Array.isArray(prizes) ? prizes : gameConfig.prizes,
      guaranteedPrize: guaranteedPrize !== undefined ? guaranteedPrize : gameConfig.guaranteedPrize,
      guaranteedPrizeEnabled: guaranteedPrizeEnabled !== undefined ? guaranteedPrizeEnabled : gameConfig.guaranteedPrizeEnabled,
      guaranteedSpinCount: guaranteedSpinCount !== undefined 
        ? Math.max(2, Math.min(prizes?.length || 100, guaranteedSpinCount)) 
        : gameConfig.guaranteedSpinCount,
      guaranteedPrizeSequence: guaranteedPrizeSequence !== undefined ? guaranteedPrizeSequence : gameConfig.guaranteedPrizeSequence
    };
    
    if (isDatabaseAvailable()) {
      await db.updateConfig(configUpdate);
      const updatedConfig = await db.getConfig();
      res.json({ success: true, config: updatedConfig });
    } else {
      // In-memory fallback
      gameConfig = { ...gameConfig, ...configUpdate };
      res.json({ success: true, config: gameConfig });
    }
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get game configuration endpoint
app.get('/config', async (req, res) => {
  try {
    if (isDatabaseAvailable()) {
      const config = await db.getConfig();
      res.json({
        config: config,
        timestamp: new Date().toISOString()
      });
    } else {
      // In-memory fallback
      res.json({
        config: gameConfig,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Config get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Spin endpoint - receives spin request and returns result
app.post('/spin', async (req, res) => {
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
        // Enhanced mode: use sequence or guaranteed prize on Nth spin
        const targetSpin = guaranteedSpinCount || 5;
        const currentSpin = spinCount || 1;
        const positionInCycle = ((currentSpin - 1) % targetSpin);
        
        // Check if we have a sequence defined
        const sequence = guaranteedPrizeSequence || [];
        const hasSequence = sequence && Array.isArray(sequence) && sequence.length > 0 && 
                           sequence.some(v => v && typeof v === 'string' && v.trim());
        
        if (hasSequence) {
          // Use sequence prize for positions 0 to (targetSpin-2)
          if (positionInCycle < targetSpin - 1) {
            const sequencePrizeId = sequence[positionInCycle];
            if (sequencePrizeId && typeof sequencePrizeId === 'string' && sequencePrizeId.trim()) {
              useSequencePrize = sequencePrizeId;
            }
          } else {
            // Last position in cycle: use guaranteed prize
            useGuaranteedPrize = true;
          }
        } else {
          // No sequence defined: use guaranteed prize only on Nth spin
          useGuaranteedPrize = (currentSpin % targetSpin === 0);
        }
      } else {
        // Original mode: every spin
        useGuaranteedPrize = true;
      }
    }

    // Filter out guaranteed prize from prizes array if in enhanced mode and doing random selection
    const excludeGuaranteed = guaranteedPrizeEnabled && hasGuaranteedPrize && !useSequencePrize && !useGuaranteedPrize;
    const prizesToUse = excludeGuaranteed 
      ? prizes.filter(p => p.id !== guaranteedPrize)
      : prizes;

    // Determine which prize ID to use
    const prizeIdToUse = useSequencePrize || (useGuaranteedPrize ? guaranteedPrize : null);

    // Call probability service to get weighted selection
    const PROBABILITY_URL = process.env.PROBABILITY_URL || 'http://localhost:3002';
    const probabilityResponse = await fetch(`${PROBABILITY_URL}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        items: prizesToUse, 
        guaranteedId: prizeIdToUse 
      })
    });

    if (!probabilityResponse.ok) {
      throw new Error('Probability service unavailable');
    }

    const { selected, probability } = await probabilityResponse.json();

    // Calculate spin animation parameters
    const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full spins
    const duration = 4.25 + Math.random() * 0.9; // 4.25-5.15 seconds

    // Get device info from request
    const deviceInfo = getDeviceInfo(req);
    
    const result = {
      prize: selected,
      sessionId: sessionId || `session_${Date.now()}`,
      timestamp: new Date().toISOString(),
      animation: {
        fullSpins,
        duration: Math.round(duration * 100) / 100
      },
      probability: probability,
      spinCount: currentSpin,
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
        // Fallback to in-memory
        gameHistory.push(result);
        if (gameHistory.length > 10000) {
          gameHistory.shift();
        }
      }
    } else {
      // In-memory fallback
      gameHistory.push(result);
      if (gameHistory.length > 10000) {
        gameHistory.shift(); // Keep last 10k spins
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Spin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim prize endpoint
app.post('/claim', async (req, res) => {
  try {
    const { id, prize, weight, ts, template, sessionId, prizes } = req.body;

    // Calculate probability if prizes array is provided
    let probability = null;
    let probabilityDecimal = null;
    
    if (prizes && Array.isArray(prizes) && prizes.length > 0) {
      const totalWeight = prizes.reduce((sum, p) => sum + (p.weight || 1), 0);
      const prizeWeight = weight || 1;
      probabilityDecimal = prizeWeight / totalWeight;
      probability = probabilityDecimal * 100;
    }

    // Get device info from request
    const deviceInfo = getDeviceInfo(req);
    
    const claim = {
      id,
      prize,
      weight,
      probability: probability ? Math.round(probability * 100) / 100 : null, // Round to 2 decimals
      probabilityDecimal: probabilityDecimal ? Math.round(probabilityDecimal * 10000) / 10000 : null, // Round to 4 decimals
      timestamp: ts || new Date().toISOString(),
      template: template || 'default',
      sessionId: sessionId || `session_${Date.now()}`,
      claimedAt: new Date().toISOString(),
      device: deviceInfo
    };

    // Store claim
    if (isDatabaseAvailable()) {
      try {
        await db.saveClaim(claim);
      } catch (dbError) {
        console.error('Database save error, using in-memory:', dbError);
        // Fallback to in-memory
        gameHistory.push({ ...claim, type: 'claim' });
      }
    } else {
      // In-memory fallback
      gameHistory.push({ ...claim, type: 'claim' });
    }

    res.json({ success: true, claim });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get game history
app.get('/history', async (req, res) => {
  try {
    const { limit = 100, sessionId } = req.query;
    
    if (isDatabaseAvailable()) {
      const history = await db.getHistory(parseInt(limit), sessionId || null);
      res.json({
        count: history.length,
        history: history
      });
    } else {
      // In-memory fallback
      let history = gameHistory;
      if (sessionId) {
        history = history.filter(h => h.sessionId === sessionId);
      }
      res.json({
        count: history.length,
        history: history.slice(-parseInt(limit))
      });
    }
  } catch (error) {
    console.error('History get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get game statistics
app.get('/stats', async (req, res) => {
  try {
    let stats;
    
    if (isDatabaseAvailable()) {
      // Get basic stats from database
      const dbStats = await db.getStats();
      
      // Get device stats from database
      const history = await db.getHistory(10000); // Get large sample for stats
      
      const deviceStats = {
        byDeviceType: {},
        byOS: {},
        byBrowser: {},
        byApp: { app: 0, web: 0 }
      };
      
      history.forEach(entry => {
        if (entry.device && typeof entry.device === 'object') {
          const device = entry.device;
          // Count by device type
          const deviceType = device.device?.type || 'unknown';
          deviceStats.byDeviceType[deviceType] = (deviceStats.byDeviceType[deviceType] || 0) + 1;
          
          // Count by OS
          const osName = device.os?.name || 'unknown';
          deviceStats.byOS[osName] = (deviceStats.byOS[osName] || 0) + 1;
          
          // Count by browser
          const browserName = device.browser?.name || 'unknown';
          deviceStats.byBrowser[browserName] = (deviceStats.byBrowser[browserName] || 0) + 1;
          
          // Count app vs web
          if (device.isApp) {
            deviceStats.byApp.app++;
          } else {
            deviceStats.byApp.web++;
          }
        }
      });
      
      stats = {
        totalSpins: dbStats.totalSpins,
        totalClaims: dbStats.totalClaims,
        activeSessions: dbStats.activeSessions,
        deviceStats: deviceStats,
        timestamp: new Date().toISOString()
      };
    } else {
      // In-memory fallback
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
app.post('/session', async (req, res) => {
  try {
    const deviceInfo = getDeviceInfo(req);
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      spins: 0,
      claims: [],
      device: deviceInfo
    };

    if (isDatabaseAvailable()) {
      try {
        await db.saveSession(session);
      } catch (dbError) {
        console.error('Database save error, using in-memory:', dbError);
        // Fallback to in-memory
        gameSessions.set(sessionId, session);
      }
    } else {
      // In-memory fallback
      gameSessions.set(sessionId, session);
    }

    res.json(session);
  } catch (error) {
    console.error('Session create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session info
app.get('/session/:sessionId', async (req, res) => {
  try {
    let session;
    
    if (isDatabaseAvailable()) {
      session = await db.getSession(req.params.sessionId);
    } else {
      // In-memory fallback
      session = gameSessions.get(req.params.sessionId);
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

const server = app.listen(PORT, () => {
  console.log(`🎮 Gameplay service running on http://localhost:${PORT}`);
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

