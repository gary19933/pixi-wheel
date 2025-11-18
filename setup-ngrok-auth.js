#!/usr/bin/env node

/**
 * Interactive script to set up ngrok authtoken
 */

import { spawn } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔐 Ngrok Authentication Setup');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('Ngrok requires a free account and authtoken.');
  console.log('');
  console.log('📝 Steps:');
  console.log('1. Sign up: https://dashboard.ngrok.com/signup');
  console.log('2. Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken');
  console.log('');
  
  const hasAccount = await question('Do you already have an ngrok account? (y/n): ');
  
  if (hasAccount.toLowerCase() !== 'y') {
    console.log('');
    console.log('👉 Please sign up first: https://dashboard.ngrok.com/signup');
    console.log('👉 Then get your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken');
    console.log('');
    console.log('After signing up, run this script again.');
    rl.close();
    return;
  }
  
  console.log('');
  const authtoken = await question('Enter your ngrok authtoken: ');
  
  if (!authtoken || authtoken.trim().length === 0) {
    console.log('❌ Authtoken cannot be empty!');
    rl.close();
    return;
  }
  
  console.log('');
  console.log('⏳ Configuring ngrok...');
  
  // Run ngrok config command
  const ngrokProcess = spawn('ngrok', ['config', 'add-authtoken', authtoken.trim()], {
    shell: true,
    stdio: 'inherit'
  });
  
  ngrokProcess.on('close', (code) => {
    if (code === 0) {
      console.log('');
      console.log('✅ Ngrok authtoken configured successfully!');
      console.log('');
      console.log('You can now use ngrok. Try:');
      console.log('  ngrok http 5173');
      console.log('');
    } else {
      console.log('');
      console.log('❌ Failed to configure ngrok. Please check your authtoken.');
      console.log('');
    }
    rl.close();
  });
  
  ngrokProcess.on('error', (err) => {
    console.log('');
    console.log('❌ Error:', err.message);
    console.log('Make sure ngrok is installed: npm install -g ngrok');
    rl.close();
  });
}

main();

