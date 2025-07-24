#!/usr/bin/env node

import { $, sleep, fs, path } from 'zx'
import os from 'os'
import { printInfo, printSuccess, printWarning, formatBranch, colors } from './colors.mjs'
import { setWorktreeConfig, getWorktreeConfig, unsetWorktreeConfig } from './git-utils.mjs'

// Check if command exists
async function commandExists(command) {
  try {
    await $`command -v ${command}`
    return true
  } catch {
    return false
  }
}

// Check if tmux and claude are available
export async function checkTmuxClaude() {
  const tmuxAvailable = await commandExists('tmux')
  const claudeAvailable = await checkClaudeAvailable()
  return tmuxAvailable && claudeAvailable
}

// Enhanced claude detection
async function checkClaudeAvailable() {
  // Try direct path first
  const claudePath = path.join(os.homedir(), '.claude', 'local', 'claude')
  if (await fs.pathExists(claudePath)) {
    return true
  }

  // Try command -v
  if (await commandExists('claude')) {
    return true
  }

  return false
}

// Detect shell config file
function detectShellConfig() {
  const homeDir = os.homedir()
  const shell = process.env.SHELL || ''

  if (shell.includes('zsh')) {
    return path.join(homeDir, '.zshrc')
  } else if (shell.includes('bash')) {
    return path.join(homeDir, '.bashrc')
  } else if (shell.includes('fish')) {
    return path.join(homeDir, '.config', 'fish', 'config.fish')
  }

  return path.join(homeDir, '.bashrc') // fallback
}

// Create tmux session with claude integration
export async function createTmuxSession(worktreeName, worktreePath, horizontalSplit = false) {
  // Sanitize session name to avoid tmux issues
  const sessionName = `baag-${worktreeName.replace(/[^a-zA-Z0-9-]/g, '-')}`

  if (horizontalSplit) {
    printInfo('Creating tmux session with Claude integration (horizontal split)')
  } else {
    printInfo('Creating tmux session with Claude integration (vertical split)')
  }

  try {
    // Clean up any existing session with the same name
    try {
      await $`tmux has-session -t ${sessionName}`
      printInfo(`Killing existing tmux session: ${sessionName}`)
      await $`tmux kill-session -t ${sessionName}`
      await sleep(500) // Wait for cleanup
    } catch {
      // Session doesn't exist, which is fine
    }

        // Create new tmux session in detached mode
    printInfo(`Creating tmux session: ${sessionName}`)
    printInfo(`Working directory: ${worktreePath}`)
    
    // Use a simpler approach - create session first, then change directory
    await $`tmux new-session -d -s ${sessionName}`
    
    // Verify session was created
    printInfo(`Verifying session exists: ${sessionName}`)
    await $`tmux has-session -t ${sessionName}`
    printInfo(`Session verified successfully`)
    
    // List windows to see what we have
    const windowList = await $`tmux list-windows -t ${sessionName} -F '#{window_index}:#{window_name}'`
    printInfo(`Available windows: ${windowList.stdout.trim()}`)
    
    // Change to the worktree directory
    await $`tmux send-keys -t ${sessionName}:0 "cd ${worktreePath}" Enter`
    await sleep(500)

    // Split window (vertical by default, horizontal if requested)
    const splitOption = horizontalSplit ? '' : '-h'
    printInfo(`Splitting window with option: ${splitOption || '(horizontal)'}`)
    await $`tmux split-window ${splitOption} -t ${sessionName}:0`
    
    // Change directory in the new pane as well
    await $`tmux send-keys -t ${sessionName}:0.1 "cd ${worktreePath}" Enter`
    await sleep(500)

    // Give tmux a moment to set up the panes
    await sleep(1000)

    // Left pane: Start Claude (try multiple approaches)
    let claudeCmd = ''
    const directClaudePath = path.join(os.homedir(), '.claude', 'local', 'claude')

    if (await fs.pathExists(directClaudePath)) {
      // Use direct path to claude executable
      claudeCmd = directClaudePath
      printInfo(`Using Claude from: ${claudeCmd}`)
    } else {
      // Try to source shell config first to load aliases
      const shellConfig = detectShellConfig()
      if (await fs.pathExists(shellConfig)) {
        claudeCmd = `source ${shellConfig} && claude`
        printInfo('Loading shell config and starting Claude')
      } else {
        // Fallback: try claude directly
        claudeCmd = 'claude'
        printInfo('Attempting to start Claude directly')
      }
    }

    // List panes to verify structure
    const paneList = await $`tmux list-panes -t ${sessionName}:0 -F '#{pane_index}'`
    const panes = paneList.stdout.trim().split('\n')
    printInfo(`Created ${panes.length} panes: ${panes.join(', ')}`)

    // Send the command to the first pane (Claude)
    await $`tmux send-keys -t ${sessionName}:0.0 '${claudeCmd}' Enter`

    // Give Claude a moment to start
    await sleep(1000)

    // Second pane: Just the shell (already in the right directory)
    await $`tmux send-keys -t ${sessionName}:0.1 'clear' Enter`

    // Focus on the second pane (terminal)
    await $`tmux select-pane -t ${sessionName}:0.1`

    // Store session name for cleanup
    await setWorktreeConfig(worktreeName, 'tmux-session', sessionName)

    // Attach to the session
    printSuccess(`Tmux session created: ${formatBranch(sessionName)}`)
    if (horizontalSplit) {
      console.log(`Top pane: ${colors.boldCyan('Claude')} | Bottom pane: ${colors.boldGreen('Terminal')}`)
    } else {
      console.log(`Left pane: ${colors.boldCyan('Claude')} | Right pane: ${colors.boldGreen('Terminal')}`)
    }

    await $`tmux attach-session -t ${sessionName}`

    return true
  } catch (error) {
    printError(`Failed to create tmux session: ${error.message}`)

    // Clean up the failed session if it exists
    try {
      await $`tmux has-session -t ${sessionName}`
      printInfo(`Cleaning up failed session: ${sessionName}`)
      await $`tmux kill-session -t ${sessionName}`
    } catch {
      // Session doesn't exist or already cleaned up
    }

    printInfo('Falling back to standard shell without tmux')
    process.chdir(worktreePath)
    await $`${process.env.SHELL || '/bin/bash'}`
    return false
  }
}

// Cleanup tmux session
export async function cleanupTmuxSession(worktreeName) {
  try {
    const sessionName = await getWorktreeConfig(worktreeName, 'tmux-session')

    if (sessionName) {
      // Check if session exists
      try {
        await $`tmux has-session -t ${sessionName}`
        printInfo(`Cleaning up tmux session: ${formatBranch(sessionName)}`)
        await $`tmux kill-session -t ${sessionName}`
      } catch {
        // Session doesn't exist, that's fine
      }

      // Remove session config
      await unsetWorktreeConfig(worktreeName, 'tmux-session')
    }

    return true
  } catch (error) {
    console.error('Failed to cleanup tmux session:', error.message)
    return false
  }
}

// List active tmux sessions for worktrees
export async function listTmuxSessions() {
  try {
    const result = await $`git config --get-regexp "^worktree\\..*\\.tmux-session$"`
    const lines = result.stdout.trim().split('\n').filter(Boolean)

    if (lines.length === 0) {
      console.log(`${colors.dim}  No tmux sessions${colors.dim}`)
      return
    }

    for (const line of lines) {
      const [key, sessionName] = line.split(' ')
      const worktreeName = key.replace(/^worktree\.(.*)\.tmux-session$/, '$1')

      try {
        await $`tmux has-session -t ${sessionName}`
        console.log(`  ${formatBranch(worktreeName)} ${colors.dim}→${colors.dim} ${colors.boldCyan(sessionName)} ${colors.green('(active)')}`)
      } catch {
        console.log(`  ${formatBranch(worktreeName)} ${colors.dim}→${colors.dim} ${colors.dim(sessionName + ' (dead)')}`)
      }
    }
  } catch {
    console.log(`${colors.dim}  No tmux sessions${colors.dim}`)
  }
}