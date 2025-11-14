import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'probability', timestamp: new Date().toISOString() });
});

// Weighted random selection (same algorithm as frontend)
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

// Calculate probability for each item
function calculateProbabilities(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  
  return items.map(item => ({
    ...item,
    probability: ((item.weight || 1) / total) * 100,
    probabilityDecimal: (item.weight || 1) / total
  }));
}

// Select weighted item endpoint
app.post('/select', (req, res) => {
  try {
    const { items, guaranteedId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    let selected;
    
    // Check for guaranteed prize (must be a non-empty string)
    if (guaranteedId && typeof guaranteedId === 'string' && guaranteedId.trim()) {
      selected = items.find(item => item.id === guaranteedId);
      if (!selected) {
        // Fallback to weighted selection if guaranteed not found
        selected = pickWeighted(items);
      }
    } else {
      selected = pickWeighted(items);
    }

    // Calculate probability for selected item
    const probabilities = calculateProbabilities(items);
    const selectedProbability = probabilities.find(p => p.id === selected.id);

    res.json({
      selected,
      probability: selectedProbability ? selectedProbability.probability : 0,
      probabilityDecimal: selectedProbability ? selectedProbability.probabilityDecimal : 0
    });
  } catch (error) {
    console.error('Selection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Calculate probabilities for all items
app.post('/calculate', (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    const probabilities = calculateProbabilities(items);
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);

    res.json({
      items: probabilities,
      totalWeight,
      count: items.length
    });
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simulate multiple spins
app.post('/simulate', (req, res) => {
  try {
    const { items, spins = 1000 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    const counts = {};
    items.forEach(item => {
      counts[item.id] = { label: item.label, count: 0 };
    });

    // Run simulations
    for (let i = 0; i < spins; i++) {
      const selected = pickWeighted(items);
      counts[selected.id].count++;
    }

    // Calculate actual probabilities from simulation
    const results = Object.values(counts).map(item => ({
      ...item,
      actualProbability: (item.count / spins) * 100,
      expectedProbability: calculateProbabilities(items).find(p => p.label === item.label)?.probability || 0
    }));

    res.json({
      spins,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🎲 Probability service running on http://localhost:${PORT}`);
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

