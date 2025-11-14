import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const services = [
  { name: 'gateway', port: 3000 },
  { name: 'gameplay', port: 3001 },
  { name: 'probability', port: 3002 },
  { name: 'system', port: 3003 }
];

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

    if (pids.size === 0) {
      return true;
    }

    for (const pid of pids) {
      try {
        await execAsync(`taskkill /PID ${pid} /F`);
        console.log(`   ✅ Killed process ${pid} on port ${port}`);
      } catch (error) {
        // Process may already be stopped
      }
    }
    return true;
  } catch (error) {
    return true;
  }
}

async function checkAndKillPorts() {
  console.log('🔍 Checking port availability...\n');
  
  const portsInUse = [];
  for (const service of services) {
    const result = await checkPort(service.port);
    if (result.inUse) {
      portsInUse.push({ ...service, pids: result.pids });
      console.log(`⚠️  Port ${service.port} (${service.name}) is in use by PID(s): ${result.pids.join(', ')}`);
    }
  }

  if (portsInUse.length > 0) {
    console.log('\n🛑 Attempting to free ports...\n');
    for (const service of portsInUse) {
      await killPort(service.port);
    }
    // Wait a moment for ports to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('');
  } else {
    console.log('✅ All ports are free!\n');
  }
}

async function startServices() {
  await checkAndKillPorts();

  console.log('🚀 Starting all microservices...\n');

  const children = [];

  services.forEach(service => {
    const servicePath = join(__dirname, service.name);
    const child = spawn('node', ['server.js'], {
      cwd: servicePath,
      stdio: 'inherit',
      shell: true
    });

    console.log(`✅ ${service.name} service starting on port ${service.port}`);

    child.on('error', (error) => {
      console.error(`❌ Error starting ${service.name}:`, error);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ ${service.name} exited with code ${code}`);
      }
    });

    children.push(child);
  });

  console.log('\n📝 Services are starting...');
  console.log('   Gateway: http://localhost:3000');
  console.log('   Gameplay: http://localhost:3001');
  console.log('   Probability: http://localhost:3002');
  console.log('   System: http://localhost:3003');
  console.log('\nPress Ctrl+C to stop all services\n');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping all services...');
    children.forEach(child => {
      child.kill('SIGINT');
    });
    process.exit(0);
  });
}

startServices().catch(console.error);

