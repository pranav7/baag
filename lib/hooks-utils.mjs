#!/usr/bin/env node

import { $ } from 'zx';
import { printInfo, printSuccess, printError } from './colors.mjs';
import { getSessionHooks } from './config-utils.mjs';

$.verbose = false;

export async function executeHooks(type, worktreeName, options = {}) {
  const hooks = await getSessionHooks();
  const commands = hooks[type] || [];
  
  if (commands.length === 0) {
    return true;
  }
  
  printInfo(`Running ${type} hooks for ${worktreeName}...`);
  
  for (const command of commands) {
    try {
      let processedCommand = command;
      
      if (options.env) {
        for (const [key, value] of Object.entries(options.env)) {
          processedCommand = processedCommand.replace(new RegExp(`\\$${key}`, 'g'), value);
          processedCommand = processedCommand.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
        }
      }
      
      printInfo(`  Executing: ${processedCommand}`);
      
      const result = await $`sh -c ${processedCommand}`;
      
      if (result.stdout) {
        console.log(result.stdout);
      }
      
    } catch (error) {
      printError(`  Failed to execute hook: ${command}`);
      printError(`  Error: ${error.message}`);
      
      if (!options.continueOnError) {
        return false;
      }
    }
  }
  
  printSuccess(`${type} hooks completed successfully`);
  return true;
}

export async function executeStartHooks(worktreeName, env = {}) {
  return executeHooks('onStart', worktreeName, { env, continueOnError: false });
}

export async function executeStopHooks(worktreeName, env = {}) {
  return executeHooks('onStop', worktreeName, { env, continueOnError: true });
}

export async function validateHooks(hooks) {
  if (!hooks || typeof hooks !== 'object') {
    return { valid: false, error: 'Hooks must be an object' };
  }
  
  const validTypes = ['onStart', 'onStop'];
  
  for (const [type, commands] of Object.entries(hooks)) {
    if (!validTypes.includes(type)) {
      return { valid: false, error: `Invalid hook type: ${type}` };
    }
    
    if (!Array.isArray(commands)) {
      return { valid: false, error: `${type} hooks must be an array of commands` };
    }
    
    for (const command of commands) {
      if (typeof command !== 'string') {
        return { valid: false, error: `All hook commands must be strings` };
      }
    }
  }
  
  return { valid: true };
}