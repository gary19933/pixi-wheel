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
    // Clean up connection string (remove psql command if present)
    let connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      // Remove 'psql' prefix and quotes if present
      connectionString = connectionString.replace(/^psql\s+['"]?/, '').replace(/['"]\s*$/, '');
      // Remove channel_binding=require if present (can cause issues)
      connectionString = connectionString.replace(/[&?]channel_binding=require/g, '');
    }
    
    pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false // Required for Neon
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased timeout
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

// Migrate old game_config table to new structure
async function migrateOldConfig() {
  if (!pool) return;
  
  try {
    // Check if old structure exists (has 'id' as INTEGER PRIMARY KEY without template_id)
    const checkOld = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'game_config' 
      AND column_name = 'id'
      AND data_type = 'integer'
    `);
    
    if (checkOld.rows.length > 0) {
      console.log('🔄 Migrating old game_config table structure...');
      
      // Check if templates table exists
      const checkTemplates = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'templates'
        )
      `);
      
      if (!checkTemplates.rows[0].exists) {
        // Create templates table first
        await pool.query(`
          CREATE TABLE IF NOT EXISTS templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            display_name VARCHAR(255),
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true
          )
        `);
      }
      
      // Get old config data
      const oldConfig = await pool.query('SELECT * FROM game_config WHERE id = 1');
      
      // Create default template
      await pool.query(`
        INSERT INTO templates (name, display_name, description)
        VALUES ('default', 'Default Template', 'Default spin wheel template')
        ON CONFLICT (name) DO NOTHING
      `);
      
      const defaultTemplate = await pool.query(`
        SELECT id FROM templates WHERE name = 'default'
      `);
      const templateId = defaultTemplate.rows[0]?.id;
      
      // Drop old table
      await pool.query('DROP TABLE IF EXISTS game_config CASCADE');
      
      // Create new table structure
      await pool.query(`
        CREATE TABLE game_config (
          id SERIAL PRIMARY KEY,
          template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
          template_name VARCHAR(255) NOT NULL,
          prizes JSONB DEFAULT '[]'::jsonb,
          guaranteed_prize VARCHAR(255),
          guaranteed_prize_enabled BOOLEAN DEFAULT false,
          guaranteed_spin_count INTEGER DEFAULT 5,
          guaranteed_prize_sequence JSONB DEFAULT '[]'::jsonb,
          design_config JSONB DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(template_id, template_name)
        )
      `);
      
      // Migrate old data if exists
      if (oldConfig.rows.length > 0 && templateId) {
        const old = oldConfig.rows[0];
        
        // Convert old data to proper format
        const prizes = old.prizes ? (typeof old.prizes === 'string' ? old.prizes : JSON.stringify(old.prizes)) : '[]';
        const sequence = old.guaranteed_prize_sequence ? (typeof old.guaranteed_prize_sequence === 'string' ? old.guaranteed_prize_sequence : JSON.stringify(old.guaranteed_prize_sequence)) : '[]';
        
        await pool.query(`
          INSERT INTO game_config (
            template_id, template_name, prizes, guaranteed_prize,
            guaranteed_prize_enabled, guaranteed_spin_count,
            guaranteed_prize_sequence, updated_at
          ) VALUES ($1, 'default', $2::jsonb, $3, $4, $5, $6::jsonb, NOW())
        `, [
          templateId,
          prizes,
          old.guaranteed_prize || null,
          old.guaranteed_prize_enabled || false,
          old.guaranteed_spin_count || 5,
          sequence
        ]);
        console.log('✅ Migrated old config data to new structure');
      }
      
      console.log('✅ Migration completed');
    }
  } catch (error) {
    console.error('⚠️  Migration error (continuing anyway):', error.message);
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
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_game_history_template 
      ON game_history(template)
    `);

    // Sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW(),
        spins INTEGER DEFAULT 0,
        max_spins INTEGER DEFAULT NULL,
        claims JSONB DEFAULT '[]'::jsonb,
        device_info JSONB,
        template VARCHAR(255),
        player_id VARCHAR(255)
      )
    `);
    
    // Player spin limits table (for 3rd party backend control)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_spin_limits (
        player_id VARCHAR(255) PRIMARY KEY,
        max_spins INTEGER DEFAULT NULL,
        template VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_player_spin_limits_template 
      ON player_spin_limits(template)
    `);

    // Migrate old config structure if needed
    await migrateOldConfig();

    // Templates table (stores template metadata)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      )
    `);

    // Game config table (one per template) - only create if doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_config (
        id SERIAL PRIMARY KEY,
        template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
        template_name VARCHAR(255) NOT NULL,
        prizes JSONB DEFAULT '[]'::jsonb,
        guaranteed_prize VARCHAR(255),
        guaranteed_prize_enabled BOOLEAN DEFAULT false,
        guaranteed_spin_count INTEGER DEFAULT 5,
        guaranteed_prize_sequence JSONB DEFAULT '[]'::jsonb,
        design_config JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(template_id, template_name)
      )
    `);

    // Create indexes for template queries (only if they don't exist)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_game_config_template_id 
      ON game_config(template_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_game_config_template_name 
      ON game_config(template_name)
    `);

    // Insert default template if not exists
    await pool.query(`
      INSERT INTO templates (name, display_name, description)
      VALUES ('default', 'Default Template', 'Default spin wheel template')
      ON CONFLICT (name) DO NOTHING
    `);
    
    // Insert default config for default template
    await pool.query(`
      INSERT INTO game_config (template_id, template_name, prizes)
      SELECT id, 'default', '[]'::jsonb
      FROM templates WHERE name = 'default'
      ON CONFLICT (template_id, template_name) DO NOTHING
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
      // Convert timestamp to proper format
      let timestamp = claim.timestamp;
      if (typeof timestamp === 'number') {
        // If it's a Unix timestamp in milliseconds, convert to ISO string
        timestamp = new Date(timestamp).toISOString();
      } else if (!timestamp) {
        timestamp = new Date().toISOString();
      }
      
      let claimedAt = claim.claimedAt;
      if (!claimedAt) {
        claimedAt = new Date().toISOString();
      }
      
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
        timestamp,
        claimedAt,
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

  // Get history (optionally filter by template)
  async getHistory(limit = 100, sessionId = null, templateName = null) {
    if (!pool) return [];
    
    try {
      let query, values;
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (sessionId) {
        conditions.push(`session_id = $${paramIndex}`);
        params.push(sessionId);
        paramIndex++;
      }
      
      if (templateName) {
        conditions.push(`template = $${paramIndex}`);
        params.push(templateName);
        paramIndex++;
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      params.push(limit);
      
      query = `
        SELECT * FROM game_history 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramIndex}
      `;
      values = params;

      const res = await pool.query(query, values);
      return res.rows.map(row => {
        // Parse device_info if it's a string
        let device = row.device_info;
        if (typeof device === 'string') {
          try {
            device = JSON.parse(device);
          } catch (e) {
            device = {};
          }
        }
        
        // Parse animation if it's a string
        let animation = row.animation;
        if (typeof animation === 'string') {
          try {
            animation = JSON.parse(animation);
          } catch (e) {
            animation = null;
          }
        }
        
        return {
          id: row.id,
          sessionId: row.session_id,
          prize: {
            id: row.prize_id,
            label: row.prize_label,
            weight: parseFloat(row.weight || 0)
          },
          weight: parseFloat(row.weight || 0),
          probability: parseFloat(row.probability || 0),
          timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : null,
          claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
          template: row.template,
          device: device,
          type: row.type || 'claim',
          animation: animation,
          spinCount: row.spin_count,
          usedSequence: row.used_sequence,
          usedGuaranteed: row.used_guaranteed
        };
      });
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
        INSERT INTO game_sessions (id, created_at, spins, max_spins, device_info, template, player_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE
        SET spins = $3, max_spins = $4, device_info = $5, template = $6, player_id = $7
        RETURNING *
      `;
      
      const values = [
        session.id,
        session.createdAt || new Date().toISOString(),
        session.spins || 0,
        session.maxSpins || null,
        JSON.stringify(session.device || {}),
        session.template || null,
        session.playerId || null
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
        spins: row.spins || 0,
        maxSpins: row.max_spins,
        remainingSpins: row.max_spins ? Math.max(0, row.max_spins - (row.spins || 0)) : null,
        claims: row.claims || [],
        device: row.device_info,
        template: row.template
      };
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },
  
  // Increment session spin count
  async incrementSessionSpins(sessionId) {
    if (!pool) return null;
    
    try {
      const res = await pool.query(
        'UPDATE game_sessions SET spins = spins + 1 WHERE id = $1 RETURNING *',
        [sessionId]
      );
      
      if (res.rows.length === 0) return null;
      
      const row = res.rows[0];
      return {
        spins: row.spins || 0,
        maxSpins: row.max_spins,
        remainingSpins: row.max_spins ? Math.max(0, row.max_spins - (row.spins || 0)) : null
      };
    } catch (error) {
      console.error('Error incrementing session spins:', error);
      return null;
    }
  },
  
  // Update session player ID
  async updateSessionPlayerId(sessionId, playerId) {
    if (!pool) return null;
    
    try {
      await pool.query(
        'UPDATE game_sessions SET player_id = $1 WHERE id = $2',
        [playerId, sessionId]
      );
      return true;
    } catch (error) {
      console.error('Error updating session playerId:', error);
      return false;
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

  // Get config by template name
  async getConfig(templateName = 'default') {
    if (!pool) {
      return {
        templateName: templateName,
        prizes: [],
        guaranteedPrize: null,
        guaranteedPrizeEnabled: false,
        guaranteedSpinCount: 5,
        guaranteedPrizeSequence: [],
        designConfig: {}
      };
    }
    
    try {
      const res = await pool.query(
        'SELECT * FROM game_config WHERE template_name = $1 ORDER BY updated_at DESC LIMIT 1',
        [templateName]
      );
      
      if (res.rows.length === 0) {
        return {
          templateName: templateName,
          prizes: [],
          guaranteedPrize: null,
          guaranteedPrizeEnabled: false,
          guaranteedSpinCount: 5,
          guaranteedPrizeSequence: [],
          designConfig: {}
        };
      }
      
      const row = res.rows[0];
      return {
        templateName: row.template_name,
        prizes: row.prizes || [],
        guaranteedPrize: row.guaranteed_prize,
        guaranteedPrizeEnabled: row.guaranteed_prize_enabled || false,
        guaranteedSpinCount: row.guaranteed_spin_count || 5,
        guaranteedPrizeSequence: row.guaranteed_prize_sequence || [],
        designConfig: row.design_config || {}
      };
    } catch (error) {
      console.error('Error getting config:', error);
      return {
        templateName: templateName,
        prizes: [],
        guaranteedPrize: null,
        guaranteedPrizeEnabled: false,
        guaranteedSpinCount: 5,
        guaranteedPrizeSequence: [],
        designConfig: {}
      };
    }
  },

  // Update config by template name
  async updateConfig(config, templateName = 'default') {
    if (!pool) return null;
    
    try {
      // Get or create template
      let templateRes = await pool.query(
        'SELECT id FROM templates WHERE name = $1',
        [templateName]
      );
      
      let templateId;
      if (templateRes.rows.length === 0) {
        // Create new template
        const newTemplate = await pool.query(
          'INSERT INTO templates (name, display_name) VALUES ($1, $2) RETURNING id',
          [templateName, config.displayName || templateName]
        );
        templateId = newTemplate.rows[0].id;
      } else {
        templateId = templateRes.rows[0].id;
      }
      
      const query = `
        INSERT INTO game_config (template_id, template_name, prizes, guaranteed_prize, 
                                guaranteed_prize_enabled, guaranteed_spin_count, 
                                guaranteed_prize_sequence, design_config, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (template_id, template_name) DO UPDATE
        SET prizes = $3,
            guaranteed_prize = $4,
            guaranteed_prize_enabled = $5,
            guaranteed_spin_count = $6,
            guaranteed_prize_sequence = $7,
            design_config = $8,
            updated_at = NOW()
        RETURNING *
      `;
      
      const values = [
        templateId,
        templateName,
        JSON.stringify(config.prizes || []),
        config.guaranteedPrize || null,
        config.guaranteedPrizeEnabled || false,
        config.guaranteedSpinCount || 5,
        JSON.stringify(config.guaranteedPrizeSequence || []),
        JSON.stringify(config.designConfig || {})
      ];

      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  },

  // Get stats (optionally filter by template)
  async getStats(templateName = null) {
    if (!pool) {
      return {
        totalSpins: 0,
        totalClaims: 0,
        activeSessions: 0
      };
    }
    
    try {
      let spinsQuery = "SELECT COUNT(*) FROM game_history WHERE type = 'spin'";
      let claimsQuery = "SELECT COUNT(*) FROM game_history WHERE type = 'claim'";
      const spinsParams = [];
      const claimsParams = [];
      
      if (templateName) {
        spinsQuery += " AND template = $1";
        claimsQuery += " AND template = $1";
        spinsParams.push(templateName);
        claimsParams.push(templateName);
      }
      
      const spinsRes = await pool.query(spinsQuery, spinsParams);
      const claimsRes = await pool.query(claimsQuery, claimsParams);
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
  },

  // Get all templates
  async getTemplates() {
    if (!pool) return [];
    
    try {
      const res = await pool.query(`
        SELECT t.*, 
               COUNT(gc.id) as config_count,
               (SELECT COUNT(*) FROM game_history WHERE template = t.name) as history_count
        FROM templates t
        LEFT JOIN game_config gc ON gc.template_id = t.id
        WHERE t.is_active = true
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `);
      
      return res.rows.map(row => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.is_active,
        configCount: parseInt(row.config_count || 0),
        historyCount: parseInt(row.history_count || 0)
      }));
    } catch (error) {
      console.error('Error getting templates:', error);
      return [];
    }
  },

  // Create template
  async createTemplate(templateData) {
    if (!pool) return null;
    
    try {
      const res = await pool.query(`
        INSERT INTO templates (name, display_name, description)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [
        templateData.name,
        templateData.displayName || templateData.name,
        templateData.description || null
      ]);
      
      return {
        id: res.rows[0].id,
        name: res.rows[0].name,
        displayName: res.rows[0].display_name,
        description: res.rows[0].description,
        createdAt: res.rows[0].created_at,
        updatedAt: res.rows[0].updated_at
      };
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  },

  // Delete template
  async deleteTemplate(templateName) {
    if (!pool) return false;
    
    try {
      const res = await pool.query(
        'DELETE FROM templates WHERE name = $1 RETURNING id',
        [templateName]
      );
      return res.rows.length > 0;
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }
};

// Check if database is available
export function isDatabaseAvailable() {
  return pool !== null;
}

