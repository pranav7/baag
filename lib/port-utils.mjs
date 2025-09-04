#!/usr/bin/env node

import { $ } from 'zx';
import path from 'path';
import fs from 'fs/promises';
import net from 'net';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_PORT_RANGE = { start: 3000, end: 4000 };
const PORTS_FILE = '.baag/ports.json';

async function ensurePortsFile() {
  const baagDir = '.baag';
  
  try {
    await fs.access(baagDir);
  } catch {
    return null;
  }
  
  const portsPath = path.join(baagDir, 'ports.json');
  
  try {
    await fs.access(portsPath);
  } catch {
    await fs.writeFile(portsPath, JSON.stringify({ 
      assignments: {},
      range: DEFAULT_PORT_RANGE 
    }, null, 2));
  }
  
  return portsPath;
}

async function readPortsConfig() {
  const portsPath = await ensurePortsFile();
  if (!portsPath) {
    return { assignments: {}, range: DEFAULT_PORT_RANGE };
  }
  
  try {
    const content = await fs.readFile(portsPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return { assignments: {}, range: DEFAULT_PORT_RANGE };
  }
}

async function savePortsConfig(config) {
  const portsPath = await ensurePortsFile();
  if (!portsPath) return;
  
  await fs.writeFile(portsPath, JSON.stringify(config, null, 2));
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '127.0.0.1');
  });
}

export async function findAvailablePort(preferredPort = null) {
  const config = await readPortsConfig();
  const { start, end } = config.range;
  
  if (preferredPort && preferredPort >= start && preferredPort <= end) {
    const available = await isPortAvailable(preferredPort);
    if (available) {
      return preferredPort;
    }
  }
  
  const assignedPorts = new Set(Object.values(config.assignments));
  
  for (let port = start; port <= end; port++) {
    if (assignedPorts.has(port)) continue;
    
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  
  throw new Error(`No available ports in range ${start}-${end}`);
}

export async function assignPort(worktreeName, port = null) {
  const config = await readPortsConfig();
  
  if (config.assignments[worktreeName]) {
    const existingPort = config.assignments[worktreeName];
    const available = await isPortAvailable(existingPort);
    if (available) {
      return existingPort;
    }
  }
  
  const assignedPort = await findAvailablePort(port);
  
  config.assignments[worktreeName] = assignedPort;
  await savePortsConfig(config);
  
  return assignedPort;
}

export async function releasePort(worktreeName) {
  const config = await readPortsConfig();
  
  if (config.assignments[worktreeName]) {
    delete config.assignments[worktreeName];
    await savePortsConfig(config);
  }
}

export async function getWorktreePort(worktreeName) {
  const config = await readPortsConfig();
  return config.assignments[worktreeName] || null;
}

export async function listPortAssignments() {
  const config = await readPortsConfig();
  return config.assignments;
}

export async function updatePortRange(start, end) {
  const config = await readPortsConfig();
  
  if (start >= end || start < 1024 || end > 65535) {
    throw new Error('Invalid port range. Must be between 1024-65535 with start < end');
  }
  
  config.range = { start, end };
  await savePortsConfig(config);
}

export async function getPortRange() {
  const config = await readPortsConfig();
  return config.range;
}