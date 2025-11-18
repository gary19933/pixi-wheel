#!/usr/bin/env node

/**
 * Setup ngrok config to bypass warning page
 * This creates/modifies the ngrok config file to add request transformation
 */

import { spawn } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const NGROK_CONFIG_PATH = process.platform === 'win32' 
  ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'ngrok', 'ngrok.yml')
  : join(homedir(), '.config', 'ngrok', 'ngrok.yml');

async function setupBypass() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔓 Setting up ngrok warning page bypass...');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  try {
    // Read existing config or create new one
    let config = '';
    try {
      config = await readFile(NGROK_CONFIG_PATH, 'utf-8');
      console.log('✅ Found existing ngrok config');
    } catch (err) {
      console.log('ℹ️  Creating new ngrok config file');
      config = 'version: "2"\n';
    }

    // Check if bypass is already configured
    if (config.includes('ngrok-skip-browser-warning')) {
      console.log('✅ Warning bypass already configured!');
      return;
    }

    // Add request transformation to config
    const bypassConfig = `
# Auto-bypass ngrok warning page
# This adds the ngrok-skip-browser-warning header to all requests
request_header:
  add:
    - "ngrok-skip-browser-warning: true"
`;

    // Append to config
    const newConfig = config.trim() + '\n' + bypassConfig.trim() + '\n';

    // Ensure directory exists
    const configDir = NGROK_CONFIG_PATH.substring(0, NGROK_CONFIG_PATH.lastIndexOf('/') || NGROK_CONFIG_PATH.lastIndexOf('\\'));
    try {
      await mkdir(configDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, that's fine
    }

    // Write config
    await writeFile(NGROK_CONFIG_PATH, newConfig, 'utf-8');
    
    console.log('✅ Ngrok config updated successfully!');
    console.log('');
    console.log('📝 Config file location:', NGROK_CONFIG_PATH);
    console.log('');
    console.log('⚠️  Note: This method may not work with free ngrok tier.');
    console.log('   The warning page bypass requires the CLIENT to send the header.');
    console.log('   For best results, use a browser extension (ModHeader/Requestly).');
    console.log('');
    console.log('🔄 Please restart your ngrok tunnels for changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error setting up bypass:', error.message);
    console.log('');
    console.log('💡 Alternative: Use a browser extension to add the header:');
    console.log('   Header: ngrok-skip-browser-warning');
    console.log('   Value: true');
  }
}

setupBypass();

