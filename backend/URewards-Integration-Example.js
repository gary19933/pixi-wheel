/**
 * URewards Integration Example
 * 
 * This file demonstrates how URewards (3rd party backend) should integrate
 * with the Pixi Wheel API to manage spin limits per user.
 */

const API_BASE = 'https://your-api.railway.app'; // Your deployed backend URL

/**
 * Example 1: Set spin limit for a specific user
 * Call this when a user earns spins (e.g., from completing tasks, purchases, etc.)
 */
async function setUserSpinLimit(userId, maxSpins, template = null) {
  try {
    const response = await fetch(`${API_BASE}/api/gameplay/player/${userId}/spins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add your API key here if you implement authentication
        // 'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({
        maxSpins: maxSpins,  // Number of spins allowed, or null for unlimited
        template: template   // Optional: specific template, or null for all templates
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to set spin limit: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Spin limit set:', result);
    return result;
  } catch (error) {
    console.error('❌ Error setting spin limit:', error);
    throw error;
  }
}

/**
 * Example 2: Get user's current spin status
 * Call this to check how many spins a user has remaining
 */
async function getUserSpinStatus(userId, template = null) {
  try {
    const url = `${API_BASE}/api/gameplay/player/${userId}/spins${template ? `?template=${template}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer YOUR_API_KEY'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get spin status: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📊 User spin status:', result);
    return result;
  } catch (error) {
    console.error('❌ Error getting spin status:', error);
    throw error;
  }
}

/**
 * Example 3: Grant spins to a user (add to existing limit)
 * This is useful when users earn additional spins
 */
async function grantSpinsToUser(userId, additionalSpins, template = null) {
  try {
    // First, get current status
    const currentStatus = await getUserSpinStatus(userId, template);
    
    // Calculate new limit
    const currentMax = currentStatus.maxSpins || 0;
    const currentUsed = currentStatus.currentSpins || 0;
    const newMax = currentMax + additionalSpins;
    
    // Set new limit
    await setUserSpinLimit(userId, newMax, template);
    
    console.log(`✅ Granted ${additionalSpins} spins to user ${userId}. New limit: ${newMax}`);
    return { newMax, remainingSpins: newMax - currentUsed };
  } catch (error) {
    console.error('❌ Error granting spins:', error);
    throw error;
  }
}

/**
 * Example 4: Reset user spins (e.g., daily reset, new campaign)
 */
async function resetUserSpins(userId, newMaxSpins, template = null) {
  try {
    // Set new limit (this doesn't reset current count, just sets new max)
    // If you want to reset the count too, you'd need to track it separately
    await setUserSpinLimit(userId, newMaxSpins, template);
    console.log(`✅ Reset spin limit for user ${userId} to ${newMaxSpins}`);
  } catch (error) {
    console.error('❌ Error resetting spins:', error);
    throw error;
  }
}

/**
 * Example 5: Check if user can spin before allowing them to play
 * Call this before redirecting user to spin wheel page
 */
async function canUserSpin(userId, template = null) {
  try {
    const status = await getUserSpinStatus(userId, template);
    
    if (status.maxSpins === null) {
      return { canSpin: true, reason: 'Unlimited spins' };
    }
    
    if (status.remainingSpins > 0) {
      return { 
        canSpin: true, 
        remainingSpins: status.remainingSpins,
        reason: `${status.remainingSpins} spins remaining`
      };
    }
    
    return { 
      canSpin: false, 
      remainingSpins: 0,
      reason: 'No spins remaining'
    };
  } catch (error) {
    console.error('❌ Error checking spin eligibility:', error);
    // On error, allow spin (fail open) or deny (fail closed) based on your policy
    return { canSpin: false, reason: 'Error checking status' };
  }
}

// ========== USAGE EXAMPLES ==========

/**
 * Scenario 1: User completes a task and earns 3 spins
 */
async function userEarnsSpins(userId) {
  // Option A: Set absolute limit
  await setUserSpinLimit(userId, 3, 'spin_wheel_a');
  
  // Option B: Add to existing spins
  await grantSpinsToUser(userId, 3, 'spin_wheel_a');
}

/**
 * Scenario 2: User purchases a spin package
 */
async function userPurchasesSpins(userId, packageSize) {
  await grantSpinsToUser(userId, packageSize, 'spin_wheel_a');
}

/**
 * Scenario 3: Daily reset - give all users 1 free spin
 */
async function dailyReset() {
  // In a real scenario, you'd loop through all active users
  const activeUsers = ['user1', 'user2', 'user3'];
  
  for (const userId of activeUsers) {
    await setUserSpinLimit(userId, 1, 'spin_wheel_a');
  }
}

/**
 * Scenario 4: Check before showing spin wheel button
 */
async function showSpinWheelButton(userId) {
  const canSpin = await canUserSpin(userId, 'spin_wheel_a');
  
  if (canSpin.canSpin) {
    // Show button and redirect to spin wheel with userId
    const spinWheelUrl = `https://your-website.com/spin-wheel.html?playerId=${userId}&template=spin_wheel_a`;
    window.location.href = spinWheelUrl;
  } else {
    // Show message: "You have no spins remaining. Complete tasks to earn more!"
    alert(canSpin.reason);
  }
}

// ========== EXPORT FOR NODE.JS / EXPRESS ==========
// If using in Node.js/Express backend:

module.exports = {
  setUserSpinLimit,
  getUserSpinStatus,
  grantSpinsToUser,
  resetUserSpins,
  canUserSpin
};

// Example Express route:
/*
const express = require('express');
const router = express.Router();
const { setUserSpinLimit, getUserSpinStatus } = require('./URewards-Integration-Example');

// URewards sets spin limit for a user
router.post('/users/:userId/spins', async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxSpins, template } = req.body;
    
    // Your URewards logic here (e.g., check if user is eligible)
    const user = await getUserFromDatabase(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Set the spin limit in Pixi Wheel API
    const result = await setUserSpinLimit(userId, maxSpins, template);
    
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// URewards checks user's spin status
router.get('/users/:userId/spins', async (req, res) => {
  try {
    const { userId } = req.params;
    const { template } = req.query;
    
    const status = await getUserSpinStatus(userId, template);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
*/

