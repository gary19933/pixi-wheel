import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
    // Port not in use if command returns no results
    return { inUse: false };
  }
}

async function checkAllPorts() {
  const ports = [3000, 3001, 3002, 3003];
  const serviceNames = ['gateway', 'gameplay', 'probability', 'system'];
  
  console.log('🔍 Checking port availability...\n');
  
  let allFree = true;
  for (let i = 0; i < ports.length; i++) {
    const result = await checkPort(ports[i]);
    if (result.inUse) {
      console.log(`❌ Port ${ports[i]} (${serviceNames[i]}) is in use by PID(s): ${result.pids.join(', ')}`);
      allFree = false;
    } else {
      console.log(`✅ Port ${ports[i]} (${serviceNames[i]}) is free`);
    }
  }
  
  if (!allFree) {
    console.log('\n⚠️  Some ports are in use. Kill processes or change ports.');
    console.log('   To kill a process: taskkill /PID <PID> /F');
  } else {
    console.log('\n✅ All ports are free!');
  }
  
  return allFree;
}

checkAllPorts().catch(console.error);

