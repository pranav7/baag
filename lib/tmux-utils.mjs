#!/usr/bin/env node

import { $, sleep, fs, path } from 'zx'
import os from 'os'
import { printInfo, printSuccess, printWarning, printError, formatBranch, formatCommand, colors } from './colors.mjs'
import { setWorktreeConfig, getWorktreeConfig, unsetWorktreeConfig } from './git-utils.mjs'
import { getAIAgent, isCommandAvailable } from './config-utils.mjs'

// Check if command exists
async function commandExists(command) {
  try {
    await $`command -v ${command}`
    return true
  } catch {
    return false
  }
}

// Check if tmux and AI agent are available
export async function checkTmuxClaude() {
  const tmuxAvailable = await commandExists('tmux')
  const aiAgent = await getAIAgent()

  if (aiAgent) {
    // Check if the configured AI agent is available
    const aiAvailable = await isCommandAvailable(aiAgent)
    return tmuxAvailable && aiAvailable
  } else {
    // Fallback to checking for claude
    const claudeAvailable = await checkClaudeAvailable()
    return tmuxAvailable && claudeAvailable
  }
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

// Customize tmux status bar with session information
async function customizeTmuxStatusBar(sessionName, worktreeName) {
  try {
    // Get session metadata
    const sessionDisplayName = await getWorktreeConfig(worktreeName, 'session-name')
    const sessionDescription = await getWorktreeConfig(worktreeName, 'session-description')

    // Create status bar components
    let leftStatus = `#[fg=colour39]baag#[default] `
    if (sessionDisplayName) {
      leftStatus += `#[fg=colour220]${sessionDisplayName}#[default] `
    }
    leftStatus += `#[fg=colour244](#S)#[default]`

    let rightStatus = `#[fg=colour244]%Y-%m-%d %H:%M#[default]`

    // Set custom status bar for this session
    await $`tmux set-option -t ${sessionName} status-left-length 60`
    await $`tmux set-option -t ${sessionName} status-right-length 40`
    await $`tmux set-option -t ${sessionName} status-left "${leftStatus}"`
    await $`tmux set-option -t ${sessionName} status-right "${rightStatus}"`

    // Set status bar style
    await $`tmux set-option -t ${sessionName} status-style "fg=white,bg=black"`

    // Set a custom window status format to show description as tooltip if available
    if (sessionDescription) {
      await $`tmux set-option -t ${sessionName} status-interval 5`
      // We can't easily show tooltips, but we could periodically show description
      printInfo(`Session: ${sessionDisplayName || worktreeName}`)
      printInfo(`Description: ${sessionDescription}`)
    }

  } catch (error) {
    printWarning(`Failed to customize tmux status bar: ${error.message}`)
  }
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

    // Get the actual window index (might be 0 or 1 depending on tmux config)
    const windowIndex = windowList.stdout.trim().split(':')[0]
    printInfo(`Using window index: ${windowIndex}`)

    // Change to the worktree directory in the initial pane
    await $`tmux send-keys -t ${sessionName}:${windowIndex} "cd ${worktreePath}" Enter`
    await sleep(500)

    // Split window (vertical by default, horizontal if requested)
    // Note: tmux -h means vertical split (side by side), no option means horizontal split (top/bottom)
    const splitOption = horizontalSplit ? '' : '-h'
    printInfo(`Splitting window with option: ${splitOption || '(horizontal)'}`)

    try {
      if (horizontalSplit) {
        await $`tmux split-window -t ${sessionName}:${windowIndex}`
      } else {
        await $`tmux split-window -h -t ${sessionName}:${windowIndex}`
      }
    } catch (error) {
      printError(`Failed to split tmux window: ${error.message}`)
      throw new Error(`Tmux split failed: ${error.message}`)
    }

    // Give tmux a moment to set up the panes after splitting
    await sleep(1000)

    // Verify panes were created successfully
    const paneList = await $`tmux list-panes -t ${sessionName}:${windowIndex} -F '#{pane_index}'`
    const panes = paneList.stdout.trim().split('\n')
    printInfo(`Created ${panes.length} panes: ${panes.join(', ')}`)

    if (panes.length < 2) {
      throw new Error(`Expected 2 panes but only found ${panes.length}`)
    }

    // Change directory in both panes initially
    await $`tmux send-keys -t ${sessionName}:${windowIndex}.0 "cd ${worktreePath}" Enter`
    await $`tmux send-keys -t ${sessionName}:${windowIndex}.1 "cd ${worktreePath}" Enter`
    await sleep(500)

    // Determine pane assignment based on split type
    let aiPane, terminalPane
    if (horizontalSplit) {
      // Horizontal split: AI in bottom pane (1), terminal in top pane (0)
      aiPane = '1'
      terminalPane = '0'
    } else {
      // Vertical split: AI in right pane (1), terminal in left pane (0)
      aiPane = '1'
      terminalPane = '0'
    }

    // Start configured AI agent or Claude as fallback
    const configuredAI = await getAIAgent()
    let aiCmd = ''
    let aiName = 'Claude'

    if (configuredAI) {
      // Use configured AI agent
      aiCmd = configuredAI
      aiName = configuredAI.charAt(0).toUpperCase() + configuredAI.slice(1)
      printInfo(`Using configured AI agent: ${aiName}`)
    } else {
      // Fallback to Claude with multiple approaches
      const directClaudePath = path.join(os.homedir(), '.claude', 'local', 'claude')

      try {
        await fs.access(directClaudePath)
        // Use direct path to claude executable
        aiCmd = directClaudePath
        printInfo(`Using Claude from: ${aiCmd}`)
      } catch {
        // Try to source shell config first to load aliases
        const shellConfig = detectShellConfig()
        try {
          await fs.access(shellConfig)
          aiCmd = `source ${shellConfig} && claude`
          printInfo('Loading shell config and starting Claude')
        } catch {
          // Fallback: try claude directly
          aiCmd = 'claude'
          printInfo('Attempting to start Claude directly')
        }
      }
    }

    // Send the AI command to the appropriate pane
    await $`tmux send-keys -t ${sessionName}:${windowIndex}.${aiPane} '${aiCmd}' Enter`

    // Give AI agent a moment to start
    await sleep(1000)

    // Terminal pane: Clear and ready for use
    await $`tmux send-keys -t ${sessionName}:${windowIndex}.${terminalPane} 'clear' Enter`

    // Focus on the terminal pane
    await $`tmux select-pane -t ${sessionName}:${windowIndex}.${terminalPane}`

    // Customize status bar with session information
    await customizeTmuxStatusBar(sessionName, worktreeName)

    // Store session metadata for cleanup and preview
    await setWorktreeConfig(worktreeName, 'tmux-session', sessionName)
    await setWorktreeConfig(worktreeName, 'ai-pane', aiPane)
    await setWorktreeConfig(worktreeName, 'ai-agent', aiName.toLowerCase())

    // Attach to the session
    printSuccess(`Tmux session created: ${formatBranch(sessionName)}`)
    if (horizontalSplit) {
      console.log(`Top pane: ${colors.boldGreen('Terminal')} | Bottom pane: ${colors.boldCyan(aiName)}`)
    } else {
      console.log(`Left pane: ${colors.boldGreen('Terminal')} | Right pane: ${colors.boldCyan(aiName)}`)
    }

    // Check if we can automatically attach to the session
    if (process.stdout.isTTY && process.stdin.isTTY) {
      try {
        printInfo('Attaching to tmux session...')
        // Direct tmux attach with proper stdio inheritance
        const { execSync } = await import('child_process')
        execSync(`tmux attach-session -t ${sessionName}`, {
          stdio: 'inherit',
          encoding: 'utf8'
        })
      } catch (error) {
        // Fallback to manual attachment instructions
        printWarning('Could not automatically attach to session')
        printInfo('To attach manually, run:')
        console.log(`  ${formatCommand(`tmux attach-session -t ${sessionName}`)}`)
      }
    } else {
      // Not running in an interactive terminal
      printInfo('Session ready! To attach, run:')
      console.log(`  ${formatCommand(`tmux attach-session -t ${sessionName}`)}`)
    }

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
    printInfo('Worktree is ready! You can now start working.')
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
      await unsetWorktreeConfig(worktreeName, 'ai-pane')
      await unsetWorktreeConfig(worktreeName, 'ai-agent')
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
      console.log(`${colors.dim('  No tmux sessions')}`)
      return
    }

    for (const line of lines) {
      const [key, sessionName] = line.split(' ')
      const worktreeName = key.replace(/^worktree\.(.*)\.tmux-session$/, '$1')

      try {
        await $`tmux has-session -t ${sessionName}`
        console.log(`  ${formatBranch(worktreeName)} ${colors.dim('→')} ${colors.boldCyan(sessionName)} ${colors.green('(active)')}`)
      } catch {
        console.log(`  ${formatBranch(worktreeName)} ${colors.dim('→')} ${colors.dim(sessionName + ' (dead)')}`)
      }
    }
  } catch {
    console.log(`${colors.dim('  No tmux sessions')}`)
  }
}