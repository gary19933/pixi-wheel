#!/usr/bin/env node

/**
 * Start ngrok tunnels for mobile testing
 * This script starts the backend, frontend, and ngrok tunnels
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

let backendProcess = null;
let frontendProcess = null;
let ngrokFrontendProcess = null;
let ngrokBackendProcess = null;

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
  
  if (backendProcess) {
    backendProcess.kill();
    log('Backend stopped', 'info');
  }
  
  if (frontendProcess) {
    frontendProcess.kill();
    log('Frontend stopped', 'info');
  }
  
  if (ngrokFrontendProcess) {
    ngrokFrontendProcess.kill();
    log('Ngrok frontend tunnel stopped', 'info');
  }
  
  if (ngrokBackendProcess) {
    ngrokBackendProcess.kill();
    log('Ngrok backend tunnel stopped', 'info');
  }
  
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start backend
async function startBackend() {
  return new Promise((resolve, reject) => {
    log(`Starting backend on port ${BACKEND_PORT}...`, 'info');
    
    backendProcess = spawn('npm', ['start'], {
      cwd: join(__dirname, 'backend'),
      shell: true,
      stdio: 'inherit'
    });
    
    backendProcess.on('error', (err) => {
      log(`Failed to start backend: ${err.message}`, 'error');
      reject(err);
    });
    
    // Wait a bit for backend to start
    setTimeout(() => {
      log('Backend started', 'success');
      resolve();
    }, 3000);
  });
}

// Start frontend
async function startFrontend() {
  return new Promise((resolve, reject) => {
    log(`Starting frontend on port ${FRONTEND_PORT}...`, 'info');
    
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_API_GATEWAY: `http://localhost:${BACKEND_PORT}`
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
    }, 3000);
  });
}

// Start ngrok tunnel
async function startNgrok(port, name) {
  return new Promise((resolve, reject) => {
    log(`Starting ngrok tunnel for ${name} (port ${port})...`, 'info');
    
    // Use --domain with a custom domain (requires paid plan) OR
    // Use --request-header-add to add header that backend can use
    // For free tier, we'll use a workaround: add the header via response transformation
    // Note: The warning page bypass requires the CLIENT to send ngrok-skip-browser-warning header
    // This is a limitation of free ngrok - users need to add the header manually or use a browser extension
    
    // Alternative: Use ngrok config file to set response headers
    // For now, we'll use the standard command and provide instructions
    const ngrokProcess = spawn('ngrok', ['http', port.toString(), '--log=stdout'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    
    ngrokProcess.stdout.on('data', (data) => {
      output += data.toString();
      const match = output.match(/https:\/\/[a-z0-9-]+\.ngrok-free\.app/);
      if (match) {
        const url = match[0];
        log(`${name} ngrok URL: ${url}`, 'success');
        resolve({ process: ngrokProcess, url });
      }
    });
    
    ngrokProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('ERR_NGROK')) {
        log(`Ngrok error for ${name}: ${error}`, 'error');
        reject(new Error(error));
      }
    });
    
    ngrokProcess.on('error', (err) => {
      log(`Failed to start ngrok for ${name}: ${err.message}`, 'error');
      log('Make sure ngrok is installed: npm install -g ngrok', 'warning');
      reject(err);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!output.includes('ngrok-free.app')) {
        log(`Ngrok tunnel for ${name} did not start in time`, 'warning');
        log('Trying to get URL from ngrok API...', 'info');
        // Try to get URL from ngrok API
        fetch('http://127.0.0.1:4040/api/tunnels')
          .then(res => res.json())
          .then(data => {
            const tunnel = data.tunnels?.find(t => t.config.addr.includes(port));
            if (tunnel) {
              log(`${name} ngrok URL: ${tunnel.public_url}`, 'success');
              resolve({ process: ngrokProcess, url: tunnel.public_url });
            } else {
              reject(new Error('Could not get ngrok URL'));
            }
          })
          .catch(() => {
            reject(new Error('Could not get ngrok URL'));
          });
      }
    }, 10000);
  });
}

// Main function
async function main() {
  log('🚀 Starting Pixi Wheel with ngrok for mobile testing...', 'info');
  log('', 'info');
  
  try {
    // Start backend
    await startBackend();
    
    // Start frontend
    await startFrontend();
    
    // Wait a bit more for everything to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start ngrok tunnels
    log('', 'info');
    log('Starting ngrok tunnels...', 'info');
    
    const [frontendTunnel, backendTunnel] = await Promise.all([
      startNgrok(FRONTEND_PORT, 'Frontend'),
      startNgrok(BACKEND_PORT, 'Backend')
    ]);
    
    ngrokFrontendProcess = frontendTunnel.process;
    ngrokBackendProcess = backendTunnel.process;
    
    // Display final URLs
    log('', 'info');
    log('═══════════════════════════════════════════════════════', 'success');
    log('📱 MOBILE TESTING URLs:', 'success');
    log('═══════════════════════════════════════════════════════', 'success');
    log('', 'info');
    log(`Frontend (Open this on your mobile): ${frontendTunnel.url}`, 'success');
    log(`Backend API: ${backendTunnel.url}`, 'info');
    log('', 'info');
    log('⚠️  IMPORTANT: Update the frontend to use the ngrok backend URL', 'warning');
    log(`   Set VITE_API_GATEWAY=${backendTunnel.url}`, 'info');
    log('   Or manually update script.js MICROSERVICE_GATEWAY variable', 'info');
    log('', 'info');
    log('📋 TO BYPASS NGROK WARNING PAGE:', 'warning');
    log('   Option 1: Use browser extension (ModHeader/Requestly) to add header:', 'info');
    log('            Header: ngrok-skip-browser-warning, Value: true', 'info');
    log('   Option 2: Use bookmarklet - see bypass-ngrok-warning.html', 'info');
    log('   Option 3: Upgrade to ngrok paid plan (removes warning automatically)', 'info');
    log('', 'info');
    log('Press Ctrl+C to stop all services', 'info');
    log('═══════════════════════════════════════════════════════', 'success');
    
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    cleanup();
  }
}

main();

