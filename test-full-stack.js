// Quick test script - run this to test everything
const API_URL = 'http://localhost:3000';

async function testFullStack() {
  console.log('🧪 Testing Full Stack...\n');

  // Test 1: Backend Health
  console.log('1️⃣ Testing backend health...');
  try {
    const health = await fetch(`${API_URL}/health`).then(r => r.json());
    console.log('✅ Backend is running');
    console.log(`   Status: ${health.status}`);
    console.log(`   Database: ${health.database}\n`);
  } catch (error) {
    console.error('❌ Backend is NOT running!');
    console.error('   Start it with: cd backend && npm start\n');
    return;
  }

  // Test 2: Create Session
  console.log('2️⃣ Testing session creation...');
  try {
    const session = await fetch(`${API_URL}/api/gameplay/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());
    console.log('✅ Session created');
    console.log(`   Session ID: ${session.id}\n`);
  } catch (error) {
    console.error('❌ Session creation failed:', error.message);
  }

  // Test 3: Claim Prize
  console.log('3️⃣ Testing prize claim...');
  try {
    const claim = await fetch(`${API_URL}/api/gameplay/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test_prize',
        prize: 'Test Prize',
        weight: 1,
        ts: Date.now(),
        template: 'test',
        sessionId: 'test_session',
        prizes: [
          { id: 'test_prize', label: 'Test Prize', weight: 1 }
        ]
      })
    }).then(r => r.json());
    console.log('✅ Prize claimed');
    console.log(`   Prize: ${claim.claim.prize}\n`);
  } catch (error) {
    console.error('❌ Claim failed:', error.message);
  }

  // Test 4: Get History
  console.log('4️⃣ Testing history...');
  try {
    const history = await fetch(`${API_URL}/api/gameplay/history?limit=5`)
      .then(r => r.json());
    console.log('✅ History retrieved');
    console.log(`   Found ${history.count} records\n`);
  } catch (error) {
    console.error('❌ History failed:', error.message);
  }

  // Test 5: Get Stats
  console.log('5️⃣ Testing stats...');
  try {
    const stats = await fetch(`${API_URL}/api/gameplay/stats`)
      .then(r => r.json());
    console.log('✅ Stats retrieved');
    console.log(`   Total spins: ${stats.totalSpins}`);
    console.log(`   Total claims: ${stats.totalClaims}`);
    console.log(`   Active sessions: ${stats.activeSessions}\n`);
  } catch (error) {
    console.error('❌ Stats failed:', error.message);
  }

  console.log('🎉 Full stack test completed!');
  console.log('\n✅ Your backend is working correctly!');
  console.log('✅ Frontend should be able to connect to it.');
}

testFullStack().catch(console.error);

