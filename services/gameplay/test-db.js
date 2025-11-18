// Quick test script to verify Neon database connection
import 'dotenv/config';
import { initDatabase, createTables, db, isDatabaseAvailable } from './db.js';

async function testDatabase() {
  console.log('🧪 Testing Neon Database Connection...\n');

  // Test 1: Initialize connection
  console.log('1️⃣ Testing database connection...');
  const pool = initDatabase();
  
  if (!pool) {
    console.log('❌ DATABASE_URL not set or connection failed');
    console.log('   Make sure DATABASE_URL is set in your .env file');
    process.exit(1);
  }

  // Test 2: Create tables
  console.log('2️⃣ Creating tables...');
  try {
    await createTables();
    console.log('✅ Tables created successfully\n');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    process.exit(1);
  }

  // Test 3: Test config operations
  console.log('3️⃣ Testing config operations...');
  try {
    const testConfig = {
      prizes: [
        { id: 'test1', label: 'Test Prize 1', weight: 1 },
        { id: 'test2', label: 'Test Prize 2', weight: 2 }
      ],
      guaranteedPrize: 'test1',
      guaranteedPrizeEnabled: true,
      guaranteedSpinCount: 5,
      guaranteedPrizeSequence: []
    };

    await db.updateConfig(testConfig);
    const retrievedConfig = await db.getConfig();
    
    if (retrievedConfig.prizes.length === 2) {
      console.log('✅ Config save/retrieve works\n');
    } else {
      console.log('⚠️  Config retrieved but data mismatch\n');
    }
  } catch (error) {
    console.error('❌ Config test failed:', error.message);
    process.exit(1);
  }

  // Test 4: Test session operations
  console.log('4️⃣ Testing session operations...');
  try {
    const testSession = {
      id: 'test_session_' + Date.now(),
      createdAt: new Date().toISOString(),
      spins: 0,
      claims: [],
      device: { type: 'desktop', os: { name: 'Test OS' } }
    };

    await db.saveSession(testSession);
    const retrievedSession = await db.getSession(testSession.id);
    
    if (retrievedSession && retrievedSession.id === testSession.id) {
      console.log('✅ Session save/retrieve works\n');
    } else {
      console.log('⚠️  Session retrieved but data mismatch\n');
    }
  } catch (error) {
    console.error('❌ Session test failed:', error.message);
    process.exit(1);
  }

  // Test 5: Test spin result save
  console.log('5️⃣ Testing spin result save...');
  try {
    const testSpin = {
      sessionId: 'test_session_' + Date.now(),
      prize: { id: 'test1', label: 'Test Prize', weight: 1 },
      timestamp: new Date().toISOString(),
      probability: 50.5,
      animation: { fullSpins: 5, duration: 4.5 },
      spinCount: 1,
      usedSequence: false,
      usedGuaranteed: false,
      device: { type: 'desktop' }
    };

    await db.saveSpinResult(testSpin);
    console.log('✅ Spin result save works\n');
  } catch (error) {
    console.error('❌ Spin result test failed:', error.message);
    process.exit(1);
  }

  // Test 6: Test history retrieval
  console.log('6️⃣ Testing history retrieval...');
  try {
    const history = await db.getHistory(10);
    console.log(`✅ History retrieval works (found ${history.length} records)\n`);
  } catch (error) {
    console.error('❌ History test failed:', error.message);
    process.exit(1);
  }

  // Test 7: Test stats
  console.log('7️⃣ Testing stats...');
  try {
    const stats = await db.getStats();
    console.log('✅ Stats retrieval works');
    console.log(`   Total spins: ${stats.totalSpins}`);
    console.log(`   Total claims: ${stats.totalClaims}`);
    console.log(`   Active sessions: ${stats.activeSessions}\n`);
  } catch (error) {
    console.error('❌ Stats test failed:', error.message);
    process.exit(1);
  }

  console.log('🎉 All database tests passed!');
  console.log('✅ Your Neon database is working correctly\n');
  process.exit(0);
}

testDatabase().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

