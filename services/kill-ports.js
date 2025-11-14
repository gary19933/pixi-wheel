import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function killPort(port) {
  try {
    // Find process using the port
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    if (!stdout.trim()) {
      console.log(`✅ Port ${port} is already free`);
      return true;
    }

    const lines = stdout.trim().split('\n');
    const pids = new Set();
    lines.forEach(line => {
      const match = line.match(/\s+(\d+)$/);
      if (match) pids.add(match[1]);
    });

    if (pids.size === 0) {
      console.log(`✅ Port ${port} is already free`);
      return true;
    }

    // Kill each process
    for (const pid of pids) {
      try {
        await execAsync(`taskkill /PID ${pid} /F`);
        console.log(`✅ Killed process ${pid} on port ${port}`);
      } catch (error) {
        console.log(`⚠️  Could not kill process ${pid} on port ${port} (may already be stopped)`);
      }
    }
    return true;
  } catch (error) {
    // Port not in use
    console.log(`✅ Port ${port} is already free`);
    return true;
  }
}

async function killAllPorts() {
  const ports = [3000, 3001, 3002, 3003];
  const serviceNames = ['gateway', 'gameplay', 'probability', 'system'];
  
  console.log('🛑 Stopping services on ports...\n');
  
  for (let i = 0; i < ports.length; i++) {
    console.log(`Checking port ${ports[i]} (${serviceNames[i]})...`);
    await killPort(ports[i]);
  }
  
  console.log('\n✅ All ports should be free now!');
  console.log('   You can now run: npm run services:start');
}

killAllPorts().catch(console.error);

