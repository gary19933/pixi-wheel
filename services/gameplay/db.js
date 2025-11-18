import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

// Initialize database connection
export function initDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not set, using in-memory storage');
    return null;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Neon
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    pool.on('connect', () => {
      console.log('✅ Connected to Neon database');
    });

    pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
    });

    return pool;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    return null;
  }
}

// Create tables if they don't exist
export async function createTables() {
  if (!pool) return;

  try {
    // Game history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_history (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255),
        prize_id VARCHAR(255),
        prize_label VARCHAR(255),
        weight DECIMAL,
        probability DECIMAL,
        timestamp TIMESTAMP DEFAULT NOW(),
        claimed_at TIMESTAMP,
        template VARCHAR(255),
        device_info JSONB,
        type VARCHAR(50) DEFAULT 'spin',
        animation JSONB,
        spin_count INTEGER,
        used_sequence BOOLEAN DEFAULT false,
        used_guaranteed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_game_history_session_id 
      ON game_history(session_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_game_history_created_at 
      ON game_history(created_at DESC)
    `);

    // Sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW(),
        spins INTEGER DEFAULT 0,
        claims JSONB DEFAULT '[]'::jsonb,
        device_info JSONB
      )
    `);

    // Game config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        prizes JSONB DEFAULT '[]'::jsonb,
        guaranteed_prize VARCHAR(255),
        guaranteed_prize_enabled BOOLEAN DEFAULT false,
        guaranteed_spin_count INTEGER DEFAULT 5,
        guaranteed_prize_sequence JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert default config if not exists
    await pool.query(`
      INSERT INTO game_config (id, prizes)
      VALUES (1, '[]'::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

// Database helper functions
export const db = {
  // Save spin result
  async saveSpinResult(result) {
    if (!pool) return null;
    
    try {
      const query = `
        INSERT INTO game_history 
        (session_id, prize_id, prize_label, weight, probability, timestamp, 
         device_info, type, animation, spin_count, used_sequence, used_guaranteed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
      
      const values = [
        result.sessionId,
        result.prize?.id || result.prizeId,
        result.prize?.label || result.prizeLabel,
        result.prize?.weight || result.weight,
        result.probability,
        result.timestamp || new Date().toISOString(),
        JSON.stringify(result.device || {}),
        'spin',
        JSON.stringify(result.animation || {}),
        result.spinCount || null,
        result.usedSequence || false,
        result.usedGuaranteed || false
      ];

      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      console.error('Error saving spin result:', error);
      throw error;
    }
  },

  // Save claim
  async saveClaim(claim) {
    if (!pool) return null;
    
    try {
      const query = `
        INSERT INTO game_history 
        (session_id, prize_id, prize_label, weight, probability, timestamp, 
         claimed_at, template, device_info, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;
      
      const values = [
        claim.sessionId,
        claim.id,
        claim.prize,
        claim.weight,
        claim.probability,
        claim.timestamp || new Date().toISOString(),
        claim.claimedAt || new Date().toISOString(),
        claim.template || 'default',
        JSON.stringify(claim.device || {}),
        'claim'
      ];

      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      console.error('Error saving claim:', error);
      throw error;
    }
  },

  // Get history
  async getHistory(limit = 100, sessionId = null) {
    if (!pool) return [];
    
    try {
      let query, values;
      
      if (sessionId) {
        query = `
          SELECT * FROM game_history 
          WHERE session_id = $1 
          ORDER BY created_at DESC 
          LIMIT $2
        `;
        values = [sessionId, limit];
      } else {
        query = `
          SELECT * FROM game_history 
          ORDER BY created_at DESC 
          LIMIT $1
        `;
        values = [limit];
      }

      const res = await pool.query(query, values);
      return res.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        prize: {
          id: row.prize_id,
          label: row.prize_label,
          weight: parseFloat(row.weight)
        },
        weight: parseFloat(row.weight),
        probability: parseFloat(row.probability),
        timestamp: row.timestamp,
        claimedAt: row.claimed_at,
        template: row.template,
        device: row.device_info,
        type: row.type,
        animation: row.animation,
        spinCount: row.spin_count,
        usedSequence: row.used_sequence,
        usedGuaranteed: row.used_guaranteed
      }));
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  },

  // Save session
  async saveSession(session) {
    if (!pool) return null;
    
    try {
      const query = `
        INSERT INTO game_sessions (id, created_at, spins, device_info)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
        SET spins = $3, device_info = $4
        RETURNING *
      `;
      
      const values = [
        session.id,
        session.createdAt || new Date().toISOString(),
        session.spins || 0,
        JSON.stringify(session.device || {})
      ];

      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  },

  // Get session
  async getSession(sessionId) {
    if (!pool) return null;
    
    try {
      const res = await pool.query(
        'SELECT * FROM game_sessions WHERE id = $1',
        [sessionId]
      );
      
      if (res.rows.length === 0) return null;
      
      const row = res.rows[0];
      return {
        id: row.id,
        createdAt: row.created_at,
        spins: row.spins,
        claims: row.claims || [],
        device: row.device_info
      };
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Get all sessions count
  async getSessionsCount() {
    if (!pool) return 0;
    
    try {
      const res = await pool.query('SELECT COUNT(*) FROM game_sessions');
      return parseInt(res.rows[0].count);
    } catch (error) {
      console.error('Error getting sessions count:', error);
      return 0;
    }
  },

  // Get config
  async getConfig() {
    if (!pool) {
      return {
        prizes: [],
        guaranteedPrize: null,
        guaranteedPrizeEnabled: false,
        guaranteedSpinCount: 5,
        guaranteedPrizeSequence: []
      };
    }
    
    try {
      const res = await pool.query('SELECT * FROM game_config WHERE id = 1');
      
      if (res.rows.length === 0) {
        return {
          prizes: [],
          guaranteedPrize: null,
          guaranteedPrizeEnabled: false,
          guaranteedSpinCount: 5,
          guaranteedPrizeSequence: []
        };
      }
      
      const row = res.rows[0];
      return {
        prizes: row.prizes || [],
        guaranteedPrize: row.guaranteed_prize,
        guaranteedPrizeEnabled: row.guaranteed_prize_enabled || false,
        guaranteedSpinCount: row.guaranteed_spin_count || 5,
        guaranteedPrizeSequence: row.guaranteed_prize_sequence || []
      };
    } catch (error) {
      console.error('Error getting config:', error);
      return {
        prizes: [],
        guaranteedPrize: null,
        guaranteedPrizeEnabled: false,
        guaranteedSpinCount: 5,
        guaranteedPrizeSequence: []
      };
    }
  },

  // Update config
  async updateConfig(config) {
    if (!pool) return null;
    
    try {
      const query = `
        UPDATE game_config SET
        prizes = $1,
        guaranteed_prize = $2,
        guaranteed_prize_enabled = $3,
        guaranteed_spin_count = $4,
        guaranteed_prize_sequence = $5,
        updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `;
      
      const values = [
        JSON.stringify(config.prizes || []),
        config.guaranteedPrize || null,
        config.guaranteedPrizeEnabled || false,
        config.guaranteedSpinCount || 5,
        JSON.stringify(config.guaranteedPrizeSequence || [])
      ];

      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  },

  // Get stats
  async getStats() {
    if (!pool) {
      return {
        totalSpins: 0,
        totalClaims: 0,
        activeSessions: 0
      };
    }
    
    try {
      const spinsRes = await pool.query(
        "SELECT COUNT(*) FROM game_history WHERE type = 'spin'"
      );
      const claimsRes = await pool.query(
        "SELECT COUNT(*) FROM game_history WHERE type = 'claim'"
      );
      const sessionsRes = await pool.query(
        'SELECT COUNT(*) FROM game_sessions'
      );

      return {
        totalSpins: parseInt(spinsRes.rows[0].count),
        totalClaims: parseInt(claimsRes.rows[0].count),
        activeSessions: parseInt(sessionsRes.rows[0].count)
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalSpins: 0,
        totalClaims: 0,
        activeSessions: 0
      };
    }
  }
};

// Check if database is available
export function isDatabaseAvailable() {
  return pool !== null;
}

