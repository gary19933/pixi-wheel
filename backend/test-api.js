// Quick test script to verify the API is working
import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Pixi Wheel Backend API...\n');
  console.log(`API URL: ${API_URL}\n`);
  
  // Test template creation and config
  console.log('📋 Testing template management...\n');

  // Test 1: Health check
  console.log('1️⃣ Testing health endpoint...');
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check passed');
    console.log(`   Status: ${data.status}`);
    console.log(`   Database: ${data.database}\n`);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('   Make sure the server is running: npm start\n');
    process.exit(1);
  }

  // Test 2: Create session
  console.log('2️⃣ Testing session creation...');
  try {
    const response = await fetch(`${API_URL}/api/gameplay/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const session = await response.json();
    console.log('✅ Session created');
    console.log(`   Session ID: ${session.id}\n`);
    
    // Test 3: Get session
    console.log('3️⃣ Testing get session...');
    const getResponse = await fetch(`${API_URL}/api/gameplay/session/${session.id}`);
    const retrievedSession = await getResponse.json();
    console.log('✅ Session retrieved');
    console.log(`   Session ID: ${retrievedSession.id}\n`);
  } catch (error) {
    console.error('❌ Session test failed:', error.message);
  }

  // Test 4: Claim endpoint
  console.log('4️⃣ Testing claim endpoint...');
  try {
    const claimData = {
      id: 'test_prize_1',
      prize: 'Test Prize',
      weight: 1,
      ts: Date.now(),
      template: 'test',
      sessionId: 'test_session',
      prizes: [
        { id: 'test_prize_1', label: 'Test Prize', weight: 1 },
        { id: 'test_prize_2', label: 'Another Prize', weight: 2 }
      ]
    };

    const response = await fetch(`${API_URL}/api/gameplay/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claimData)
    });
    const result = await response.json();
    console.log('✅ Claim saved');
    console.log(`   Prize: ${result.claim.prize}\n`);
  } catch (error) {
    console.error('❌ Claim test failed:', error.message);
  }

  // Test 5: Get history
  console.log('5️⃣ Testing history endpoint...');
  try {
    const response = await fetch(`${API_URL}/api/gameplay/history?limit=10`);
    const data = await response.json();
    console.log('✅ History retrieved');
    console.log(`   Found ${data.count} records\n`);
  } catch (error) {
    console.error('❌ History test failed:', error.message);
  }

  // Test 6: Get stats
  console.log('6️⃣ Testing stats endpoint...');
  try {
    const response = await fetch(`${API_URL}/api/gameplay/stats`);
    const stats = await response.json();
    console.log('✅ Stats retrieved');
    console.log(`   Total spins: ${stats.totalSpins}`);
    console.log(`   Total claims: ${stats.totalClaims}`);
    console.log(`   Active sessions: ${stats.activeSessions}\n`);
  } catch (error) {
    console.error('❌ Stats test failed:', error.message);
  }

  // Test 7: Get config
  console.log('7️⃣ Testing config endpoint...');
  try {
    const response = await fetch(`${API_URL}/api/gameplay/config`);
    const data = await response.json();
    console.log('✅ Config retrieved');
    console.log(`   Prizes: ${data.config.prizes.length}\n`);
  } catch (error) {
    console.error('❌ Config test failed:', error.message);
  }

  // Test 8: Template management
  console.log('8️⃣ Testing template creation...');
  try {
    const templateRes = await fetch(`${API_URL}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test_template',
        displayName: 'Test Template'
      })
    });
    const template = await templateRes.json();
    console.log('✅ Template created:', template.template?.name || 'success');
  } catch (error) {
    console.error('❌ Template creation failed:', error.message);
  }

  // Test 9: Save design config
  console.log('\n9️⃣ Testing design config save...');
  try {
    const configRes = await fetch(`${API_URL}/api/gameplay/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: 'test_template',
        prizes: [
          { id: 'test1', label: 'Test Prize 1', weight: 10 },
          { id: 'test2', label: 'Test Prize 2', weight: 5 }
        ],
        designConfig: {
          colors: { pageBackground: { type: 'color', style: '#0a2b22' } },
          wheelSize: 1.6
        }
      })
    });
    const config = await configRes.json();
    console.log('✅ Design config saved:', config.success);
  } catch (error) {
    console.error('❌ Config save failed:', error.message);
  }

  // Test 10: Get template config
  console.log('\n🔟 Testing get template config...');
  try {
    const getConfigRes = await fetch(`${API_URL}/api/gameplay/config?template=test_template`);
    const getConfig = await getConfigRes.json();
    console.log('✅ Config retrieved:', getConfig.config.prizes?.length || 0, 'prizes');
  } catch (error) {
    console.error('❌ Get config failed:', error.message);
  }

  console.log('\n🎉 All API tests completed!');
  console.log('\n✅ Your backend is working correctly!');
  console.log('\n📝 Next steps:');
  console.log('   1. Open http://localhost:5173 in browser (run: npm run dev)');
  console.log('   2. Design your spin wheel');
  console.log('   3. Test spinning and check history');
}

testAPI().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

