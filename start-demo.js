#!/usr/bin/env node

/**
 * Demo script for 3rd party team
 * Starts all microservices and exposes them via ngrok
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const services = [
  { name: 'gateway', port: 3000 },
  { name: 'gameplay', port: 3001 },
  { name: 'probability', port: 3002 },
  { name: 'system', port: 3003 }
];

let serviceProcesses = [];
let frontendProcess = null;
let ngrokProcess = null;
const FRONTEND_PORT = 5173;

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
    reset: '\x1b[0m'
  };
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${colors[type] || ''}${icon} ${message}${colors.reset}`);
}

function cleanup() {
  log('Shutting down all processes...', 'warning');
  
  serviceProcesses.forEach(proc => {
    if (proc) proc.kill();
  });
  
  if (frontendProcess) {
    frontendProcess.kill();
  }
  
  if (ngrokProcess) {
    ngrokProcess.kill();
  }
  
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Kill existing ngrok processes
async function killExistingNgrok() {
  try {
    log('Checking for existing ngrok processes...', 'info');
    // Try to kill ngrok processes
    try {
      await execAsync('taskkill /F /IM ngrok.exe');
      log('Killed existing ngrok processes', 'success');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
    } catch (error) {
      // No ngrok processes found, that's fine
    }
  } catch (error) {
    // Ignore errors
  }
}

// Check if port is in use
async function checkPort(port) {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const match = line.match(/\s+(\d+)$/);
        if (match) pids.add(match[1]);
      });
      return { inUse: true, pids: Array.from(pids) };
    }
    return { inUse: false };
  } catch (error) {
    return { inUse: false };
  }
}

// Kill process on port
async function killPort(port) {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    if (!stdout.trim()) {
      return true;
    }

    const lines = stdout.trim().split('\n');
    const pids = new Set();
    lines.forEach(line => {
      const match = line.match(/\s+(\d+)$/);
      if (match) pids.add(match[1]);
    });

    for (const pid of pids) {
      try {
        await execAsync(`taskkill /PID ${pid} /F`);
        log(`Killed process ${pid} on port ${port}`, 'info');
      } catch (error) {
        // Process may already be stopped
      }
    }
    // Wait longer for port to be released
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify port is free
    const check = await checkPort(port);
    if (check.inUse) {
      log(`Warning: Port ${port} may still be in use`, 'warning');
    }
    return true;
  } catch (error) {
    return true;
  }
}

// Start a microservice
async function startService(service) {
  return new Promise((resolve, reject) => {
    log(`Starting ${service.name} service on port ${service.port}...`, 'info');
    
    const servicePath = join(__dirname, 'services', service.name);
    const proc = spawn('node', ['server.js'], {
      cwd: servicePath,
      shell: true,
      stdio: 'inherit'
    });
    
    proc.on('error', (err) => {
      log(`Failed to start ${service.name}: ${err.message}`, 'error');
      reject(err);
    });
    
    serviceProcesses.push(proc);
    
    // Wait a bit for service to start
    setTimeout(() => {
      log(`${service.name} service started`, 'success');
      resolve();
    }, 2000);
  });
}

// Start frontend
async function startFrontend(gatewayUrl) {
  return new Promise((resolve, reject) => {
    log(`Starting frontend on port ${FRONTEND_PORT}...`, 'info');
    
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_API_GATEWAY: gatewayUrl || 'http://localhost:3000'
      }
    });
    
    frontendProcess.on('error', (err) => {
      log(`Failed to start frontend: ${err.message}`, 'error');
      reject(err);
    });
    
    // Wait a bit for frontend to start
    setTimeout(() => {
      log('Frontend started', 'success');
      resolve();
    }, 5000);
  });
}

// Read authtoken from default ngrok config
function getNgrokAuthtoken() {
  try {
    const possiblePaths = [
      join(process.env.LOCALAPPDATA || '', 'ngrok', 'ngrok.yml'),
      join(process.env.USERPROFILE || '', '.ngrok2', 'ngrok.yml'),
      join(process.env.HOME || '', '.ngrok2', 'ngrok.yml'),
      join(process.env.HOME || '', '.ngrok', 'ngrok.yml')
    ];
    
    for (const configPath of possiblePaths) {
      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf8');
        const authtokenMatch = configContent.match(/authtoken:\s*(.+)/);
        if (authtokenMatch) {
          return authtokenMatch[1].trim();
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

// Start ngrok tunnels for both frontend and gateway
async function startNgrokTunnels() {
  return new Promise((resolve, reject) => {
    log('Starting ngrok tunnels for Frontend and Gateway...', 'info');
    log('Using ngrok config file to run multiple tunnels', 'info');
    
    // Read authtoken from default config and add to our config
    const authtoken = getNgrokAuthtoken();
    if (!authtoken) {
      log('', 'error');
      log('❌ Ngrok authtoken not found!', 'error');
      log('', 'info');
      log('💡 Please run: npm run ngrok:setup', 'warning');
      log('   Or configure manually: ngrok config add-authtoken YOUR_TOKEN', 'info');
      log('', 'info');
      reject(new Error('Ngrok authtoken not configured'));
      return;
    }
    
    // Create temporary config file with authtoken
    const configPath = join(__dirname, 'ngrok-temp.yml');
    const configContent = `version: "2"
authtoken: ${authtoken}
tunnels:
  frontend:
    addr: ${FRONTEND_PORT}
    proto: http
  gateway:
    addr: 3000
    proto: http
`;
    
    try {
      writeFileSync(configPath, configContent, 'utf8');
      log('Created temporary ngrok config with authtoken', 'info');
    } catch (error) {
      log(`Failed to create config file: ${error.message}`, 'error');
      reject(error);
      return;
    }
    
    const urls = {};
    let resolved = false;
    
    // Use ngrok start --all with the temp config file
    const ngrokProc = spawn('ngrok', ['start', '--all', '--config', configPath, '--log=stdout'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    ngrokProcess = ngrokProc;
    
    let output = '';
    let errorOutput = '';
    
    // Function to check ngrok API for URLs
    const checkNgrokAPI = async (retries = 0) => {
      try {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for ngrok to start
        
        const res = await fetch('http://127.0.0.1:4040/api/tunnels');
        const data = await res.json();
        
        if (data.tunnels && data.tunnels.length > 0) {
          data.tunnels.forEach(tunnel => {
            const addr = tunnel.config.addr || '';
            if (addr.includes(FRONTEND_PORT.toString()) || addr.includes(':5173')) {
              urls.frontend = tunnel.public_url;
              log(`Frontend ngrok URL: ${urls.frontend}`, 'success');
            }
            if (addr.includes('3000') || addr.includes(':3000')) {
              urls.gateway = tunnel.public_url;
              log(`Gateway ngrok URL: ${urls.gateway}`, 'success');
            }
          });
          
          if (urls.frontend && urls.gateway && !resolved) {
            resolved = true;
            resolve({ process: ngrokProc, urls });
            return;
          }
        }
        
        // Retry if not found yet
        if (retries < 10 && !resolved) {
          setTimeout(() => checkNgrokAPI(retries + 1), 2000);
        } else if (!resolved) {
          reject(new Error('Could not get ngrok URLs after multiple attempts'));
        }
      } catch (err) {
        if (retries < 10 && !resolved) {
          setTimeout(() => checkNgrokAPI(retries + 1), 2000);
        } else if (!resolved) {
          reject(new Error(`Could not connect to ngrok API: ${err.message}`));
        }
      }
    };
    
    ngrokProc.stdout.on('data', (data) => {
      output += data.toString();
      // Start checking API after ngrok starts
      if (output.includes('started tunnel') || output.includes('Session Status')) {
        checkNgrokAPI();
      }
    });
    
    ngrokProc.stderr.on('data', (data) => {
      errorOutput += data.toString();
      const error = data.toString();
      
      // Check for session limit error
      if (error.includes('ERR_NGROK_108') || error.includes('simultaneous ngrok agent sessions')) {
        log('', 'error');
        log('❌ Ngrok Error: You already have an ngrok session running!', 'error');
        log('', 'info');
        log('💡 Solution:', 'warning');
        log('   1. Stop any other ngrok processes:', 'info');
        log('      taskkill /F /IM ngrok.exe', 'info');
        log('   2. Or check your ngrok dashboard:', 'info');
        log('      https://dashboard.ngrok.com/agents', 'info');
        log('   3. Then run this script again', 'info');
        log('', 'info');
        reject(new Error('Ngrok session limit reached'));
        return;
      }
      
      if (error.includes('ERR_NGROK') && !error.includes('config file')) {
        log(`Ngrok error: ${error}`, 'error');
        if (!resolved) {
          reject(new Error(error));
        }
      }
    });
    
    ngrokProc.on('error', (err) => {
      log(`Failed to start ngrok: ${err.message}`, 'error');
      log('Make sure ngrok is installed: npm install -g ngrok', 'warning');
      if (!resolved) {
        reject(err);
      }
    });
    
    // Start checking API immediately
    checkNgrokAPI();
    
    // Final timeout after 30 seconds
    setTimeout(() => {
      if (!resolved) {
        if (urls.frontend && urls.gateway) {
          resolved = true;
          resolve({ process: ngrokProc, urls });
        } else {
          // Clean up temp config file
          try {
            if (existsSync(configPath)) {
              require('fs').unlinkSync(configPath);
            }
          } catch (e) {}
          reject(new Error('Could not get ngrok URLs - check ngrok authtoken configuration'));
        }
      }
    }, 30000);
    
    // Clean up temp config on success
    ngrokProc.on('exit', () => {
      try {
        if (existsSync(configPath)) {
          require('fs').unlinkSync(configPath);
        }
      } catch (e) {}
    });
  });
}

// Main function
async function main() {
  log('🚀 Starting Microservices Demo for 3rd Party Team...', 'info');
  log('', 'info');
  
  try {
    // Kill existing ngrok processes
    await killExistingNgrok();
    
    // Kill all services on required ports first
    log('Cleaning up existing services...', 'info');
    const portsToCheck = [3000, 3001, 3002, 3003, FRONTEND_PORT];
    for (const port of portsToCheck) {
      const portCheck = await checkPort(port);
      if (portCheck.inUse) {
        log(`Port ${port} is in use. Attempting to free it...`, 'warning');
        await killPort(port);
      }
    }
    
    // Wait for ports to be fully released
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify ports are free
    for (const port of portsToCheck) {
      const recheck = await checkPort(port);
      if (recheck.inUse) {
        log(`Warning: Port ${port} may still be in use - services may fail to start`, 'warning');
      }
    }
    
    // Start all microservices
    log('📦 Starting all microservices...', 'info');
    for (const service of services) {
      await startService(service);
    }
    
    // Wait for services to be ready
    log('', 'info');
    log('Waiting for services to be ready...', 'info');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start frontend first (will use localhost:3000, then update to ngrok URL)
    log('', 'info');
    await startFrontend('http://localhost:3000');
    
    // Wait a bit more for frontend to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start ngrok tunnels for both frontend and gateway
    log('', 'info');
    const tunnels = await startNgrokTunnels();
    
    // Update frontend environment to use Gateway ngrok URL
    // Note: Vite proxy will still work, but we can also use the ngrok Gateway URL directly
    
    // Display demo information
    log('', 'info');
    log('═══════════════════════════════════════════════════════════════════', 'success');
    log('🎯 MICROSERVICES DEMO - READY FOR 3RD PARTY TEAM', 'success');
    log('═══════════════════════════════════════════════════════════════════', 'success');
    log('', 'info');
    log('🎮 PLAY THE GAME (Frontend):', 'success');
    log(`   ${tunnels.urls.frontend}`, 'info');
    log('', 'info');
    log('📡 API GATEWAY (Public URL):', 'success');
    log(`   ${tunnels.urls.gateway}`, 'info');
    log('', 'info');
    log('   Note: Frontend uses Vite proxy to connect to Gateway', 'info');
    log('   For direct API access, use the Gateway URL above', 'info');
    log('', 'info');
    log('🏗️  MICROSERVICES ARCHITECTURE:', 'info');
    log('', 'info');
    log('   Gateway (Port 3000) - API Gateway / Main Entry Point', 'info');
    log('   ├─ Routes to: /api/gameplay/* → Gameplay Service', 'info');
    log('   ├─ Routes to: /api/probability/* → Probability Service', 'info');
    log('   └─ Routes to: /api/system/* → System Service', 'info');
    log('', 'info');
    log('   Gameplay Service (Port 3001) - Game Logic & Sessions', 'info');
    log('   Probability Service (Port 3002) - Weighted Selection', 'info');
    log('   System Service (Port 3003) - Monitoring & Health', 'info');
    log('', 'info');
    log('📋 API ENDPOINTS (via Gateway ngrok URL):', 'info');
    log('', 'info');
    log('   Health Checks:', 'info');
    log(`   GET ${tunnels.urls.gateway}/health`, 'info');
    log(`   GET ${tunnels.urls.gateway}/api/gameplay/health`, 'info');
    log(`   GET ${tunnels.urls.gateway}/api/probability/health`, 'info');
    log(`   GET ${tunnels.urls.gateway}/api/system/health`, 'info');
    log('', 'info');
    log('   Gameplay API:', 'info');
    log(`   GET  ${tunnels.urls.gateway}/api/gameplay/config`, 'info');
    log(`   POST ${tunnels.urls.gateway}/api/gameplay/spin`, 'info');
    log(`   POST ${tunnels.urls.gateway}/api/gameplay/claim`, 'info');
    log(`   GET  ${tunnels.urls.gateway}/api/gameplay/history`, 'info');
    log(`   GET  ${tunnels.urls.gateway}/api/gameplay/stats`, 'info');
    log('', 'info');
    log('   Prize Management (3rd Party):', 'info');
    log(`   GET ${tunnels.urls.gateway}/api/gameplay/prizes?template=default`, 'info');
    log(`   PUT ${tunnels.urls.gateway}/api/gameplay/prizes`, 'info');
    log('', 'info');
    log('   Terms & Conditions (3rd Party):', 'info');
    log(`   GET ${tunnels.urls.gateway}/api/gameplay/terms?template=default`, 'info');
    log(`   PUT ${tunnels.urls.gateway}/api/gameplay/terms`, 'info');
    log('', 'info');
    log('   Guaranteed Prize Settings (3rd Party):', 'info');
    log(`   GET ${tunnels.urls.gateway}/api/gameplay/guaranteed-prize?template=default`, 'info');
    log(`   PUT ${tunnels.urls.gateway}/api/gameplay/guaranteed-prize`, 'info');
    log('', 'info');
    log('   Spin Limits / Coin System (3rd Party):', 'info');
    log(`   GET  ${tunnels.urls.gateway}/api/gameplay/player/:playerId/spins`, 'info');
    log(`   POST ${tunnels.urls.gateway}/api/gameplay/player/:playerId/spins`, 'info');
    log(`   POST ${tunnels.urls.gateway}/api/gameplay/player/:playerId/spins/grant`, 'info');
    log('', 'info');
    log('   Session Management (3rd Party):', 'info');
    log(`   POST ${tunnels.urls.gateway}/api/gameplay/session`, 'info');
    log(`   GET  ${tunnels.urls.gateway}/api/gameplay/session/:sessionId`, 'info');
    log(`   GET  ${tunnels.urls.gateway}/api/gameplay/player/:playerId/session`, 'info');
    log(`   GET  ${tunnels.urls.gateway}/api/gameplay/player/:playerId/sessions`, 'info');
    log('', 'info');
    log('   Probability API:', 'info');
    log(`   POST ${tunnels.urls.gateway}/api/probability/select`, 'info');
    log(`   POST ${tunnels.urls.gateway}/api/probability/calculate`, 'info');
    log('', 'info');
    log('   System API:', 'info');
    log(`   GET ${tunnels.urls.gateway}/api/system/system`, 'info');
    log(`   GET ${tunnels.urls.gateway}/api/system/status`, 'info');
    log('', 'info');
    log('📝 LOCAL SERVICES (for testing):', 'info');
    log('   Frontend: http://localhost:5173', 'info');
    log('   Gateway: http://localhost:3000', 'info');
    log('   Gameplay: http://localhost:3001', 'info');
    log('   Probability: http://localhost:3002', 'info');
    log('   System: http://localhost:3003', 'info');
    log('', 'info');
    log('⚠️  IMPORTANT NOTES:', 'warning');
    log('   1. Play the game at the Frontend URL above', 'info');
    log('   2. The frontend connects to Gateway at localhost:3000', 'info');
    log('   3. For ngrok warning page bypass, add header:', 'info');
    log('      ngrok-skip-browser-warning: true', 'info');
    log('   4. API testing can be done via Gateway URL above', 'info');
    log('   5. See API-DEMO.md for detailed API documentation', 'info');
    log('', 'info');
    log('📚 3RD PARTY INTEGRATION DOCS:', 'info');
    log('   - SESSION-MANAGEMENT-API.md - Session & Player management', 'info');
    log('   - PRIZES-AND-SPIN-LIMITS-API.md - Prize & Spin Limit management', 'info');
    log('   - TERMS-API.md - Terms & Conditions management', 'info');
    log('   - GUARANTEED-PRIZE-API.md - Guaranteed Prize settings', 'info');
    log('   - API-DEMO.md - Complete API reference', 'info');
    log('', 'info');
    log('Press Ctrl+C to stop all services', 'info');
    log('═══════════════════════════════════════════════════════════════════', 'success');
    
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    cleanup();
  }
}

main();

