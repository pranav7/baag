#!/usr/bin/env node

import { $, fs, path } from 'zx'
import { question } from 'zx'
import * as p from '@clack/prompts'
import {
  printHeader, printInfo, printSuccess, printError, printWarning,
  formatBranch, formatPath, formatCommand, colors
} from './colors.mjs'
import {
  checkGitRepository, checkGitStatus, getCurrentBranch, branchExists,
  getMainRepoDir, getWorktreesDir, isInWorktree, worktreeExists,
  getStoredBaseBranch, setWorktreeConfig, getWorktreeConfig, unsetWorktreeConfig,
  pushBranch, getAvailableBranches, getMainBranch
} from './git-utils.mjs'
import { checkTmuxClaude, createTmuxSession, cleanupTmuxSession, listTmuxSessions } from './tmux-utils.mjs'
import { getBaseBranch, getCodeEditor, openCodeEditor, getAIAgent, getBranchPrefix } from './config-utils.mjs'

// Check if command exists
async function commandExists(command) {
  try {
    await $`command -v ${command}`
    return true
  } catch {
    return false
  }
}

// Ensure .baag directory exists
async function ensureBaagDir() {
  const baagDir = getWorktreesDir()
  if (!await fs.pathExists(baagDir)) {
    printInfo(`Creating .baag directory: ${formatPath(baagDir)}`)
    await fs.ensureDir(baagDir)
  }
}

// Read worktree setup configuration from .baag/config.json
async function getWorktreeSetupCommands() {
  try {
    const mainRepoDir = await getMainRepoDir()
    const configPath = path.join(mainRepoDir, '.baag', 'config.json')

    if (!await fs.pathExists(configPath)) {
      return null
    }

    const configContent = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(configContent)

    if (!config.worktreeSetup) {
      return null
    }

    // Support both array format (simple) and object format (with platform-specific)
    if (Array.isArray(config.worktreeSetup)) {
      return config.worktreeSetup
    }

    // Object format with platform-specific commands
    const platform = process.platform
    if (platform === 'win32' && config.worktreeSetup.commandsWindows) {
      return config.worktreeSetup.commandsWindows
    } else if ((platform === 'darwin' || platform === 'linux') && config.worktreeSetup.commandsUnix) {
      return config.worktreeSetup.commandsUnix
    } else if (config.worktreeSetup.commands) {
      return config.worktreeSetup.commands
    }

    return null
  } catch (error) {
    printWarning(`Failed to read worktree setup config: ${error.message}`)
    return null
  }
}


// Start worktree command
export async function startWorktree(args) {
  // Parse command line options (maintain backward compatibility)
  let horizontalSplit = false
  let name = ''
  let baseBranch = ''
  let baseBranchSpecified = false
  let nonInteractive = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--horizontal-split' || arg === '--hs') {
      horizontalSplit = true
    } else if (arg === '--base' || arg === '--base-branch') {
      if (i + 1 < args.length) {
        baseBranch = args[++i]
        baseBranchSpecified = true
      } else {
        printError(`${arg} requires a branch name`)
        process.exit(1)
      }
    } else if (arg.startsWith('-')) {
      printError(`Unknown option: ${arg}`)
      process.exit(1)
    } else if (!name) {
      name = arg
      nonInteractive = true // If name is provided via CLI, use non-interactive mode
    } else {
      printError('Too many arguments')
      process.exit(1)
    }
  }

  // Interactive mode if no name was provided
  if (!nonInteractive) {
    console.log()
    printHeader('🚀 Starting New Worktree')

    const branchName = await p.text({
      message: 'Branch name:',
      placeholder: 'feature name or description',
      validate: (value) => {
        if (!value || !value.trim()) return 'Branch name is required'
        return
      }
    });

    if (p.isCancel(branchName)) {
      p.cancel('Operation cancelled');
      process.exit(0);
    }

    // Convert spaces to hyphens
    name = branchName.trim().replace(/\s+/g, '-')

    // Inform user if we converted spaces
    if (name !== branchName.trim()) {
      printInfo(`Converted spaces to hyphens: ${formatBranch(name)}`)
    }
  } else if (!name) {
    printError('Worktree name is required')
    process.exit(1)
  } else {
    // For non-interactive mode, also convert spaces to hyphens
    const originalName = name
    name = name.trim().replace(/\s+/g, '-')
    if (name !== originalName) {
      printInfo(`Converted spaces to hyphens: ${formatBranch(name)}`)
    }
  }

  // Apply branch prefix if configured
  const branchPrefix = await getBranchPrefix()
  let finalBranchName = name
  if (branchPrefix) {
    // Only apply prefix if the name doesn't already start with the prefix
    if (!name.startsWith(branchPrefix + '/')) {
      finalBranchName = `${branchPrefix}/${name}`
      printInfo(`Applying configured branch prefix: ${formatBranch(name)} → ${formatBranch(finalBranchName)}`)
    }
  }

  if (await worktreeExists(finalBranchName)) {
    printError(`Worktree '${formatBranch(finalBranchName)}' already exists`)
    process.exit(1)
  }

  // Determine the base branch for this worktree
  let currentBaseBranch
  if (baseBranchSpecified) {
    // Validate that the specified base branch exists
    if (!await branchExists(baseBranch)) {
      printError(`Base branch '${formatBranch(baseBranch)}' does not exist`)
      printInfo(`Available branches: ${(await getAvailableBranches()).join(', ')}`)
      process.exit(1)
    }
    currentBaseBranch = baseBranch
    printInfo(`Using specified base branch: ${formatBranch(currentBaseBranch)}`)
  } else {
    // Prefer current branch over configured base branch
    currentBaseBranch = await getCurrentBranch()
    if (currentBaseBranch) {
      printInfo(`Using current branch as base: ${formatBranch(currentBaseBranch)}`)
    } else {
      // Fall back to configured base branch if current branch cannot be determined
      const configuredBaseBranch = await getBaseBranch()
      if (configuredBaseBranch && await branchExists(configuredBaseBranch)) {
        currentBaseBranch = configuredBaseBranch
        printInfo(`Using configured base branch: ${formatBranch(currentBaseBranch)}`)
      } else {
        // Final fallback to 'main'
        currentBaseBranch = 'main'
        printInfo(`Using fallback base branch: ${formatBranch(currentBaseBranch)}`)
      }
    }
  }

          await ensureBaagDir()
    const baagDir = getWorktreesDir()
    const worktreePath = path.join(baagDir, name)

  printHeader('Creating Worktree')
  console.log(`Creating worktree ${formatBranch(finalBranchName)} in ${formatPath(worktreePath)}`)
  console.log(`Base branch: ${formatBranch(currentBaseBranch)}`)

  try {
    // Create worktree with new branch
    if (await branchExists(finalBranchName)) {
      printInfo(`Branch '${formatBranch(finalBranchName)}' already exists, creating worktree from existing branch`)
      await $`git worktree add ${worktreePath} ${finalBranchName}`
    } else {
      printInfo(`Creating new branch '${formatBranch(finalBranchName)}' from '${formatBranch(currentBaseBranch)}' and worktree`)
      await $`git worktree add -b ${finalBranchName} ${worktreePath} ${currentBaseBranch}`
    }

    // Store the base branch for this worktree
    await setWorktreeConfig(name, 'base', currentBaseBranch)

    // Store the original directory and branch for easy return
    await setWorktreeConfig(name, 'origin-dir', process.cwd())
    await setWorktreeConfig(name, 'origin-branch', currentBaseBranch)

    // Prepare hook environment
    const hookEnv = {
      BAAG_WORKTREE: name,
      BAAG_PATH: worktreePath,
      BAAG_BASE_BRANCH: currentBaseBranch
    }

    printSuccess('Worktree created successfully')

    // Try to open the configured code editor first
    const editorOpened = await openCodeEditor(worktreePath)
    if (editorOpened) {
      printSuccess(`Opened worktree in configured code editor`)
    }

    // Check if tmux and AI agent are available for enhanced workflow
    if (await checkTmuxClaude()) {
      const configuredAI = await getAIAgent()
      const aiName = configuredAI ? configuredAI.charAt(0).toUpperCase() + configuredAI.slice(1) : 'AI agent'
      printInfo(`Both tmux and ${aiName} detected - creating integrated development environment`)
      const tmuxSuccess = await createTmuxSession(name, worktreePath, horizontalSplit, hookEnv)

      if (!tmuxSuccess) {
        // Tmux session creation failed, but we're already in the worktree directory
        // The createTmuxSession function already handles the fallback
        return
      }
    } else {
      console.log(`Changing directory to: ${formatPath(worktreePath)}`)
      if (!await commandExists('tmux')) {
        printWarning('tmux not found - falling back to standard shell')
      }

      const configuredAI = await getAIAgent()
      if (configuredAI && !await commandExists(configuredAI)) {
        printWarning(`Configured AI agent '${configuredAI}' not found`)
      } else if (!await commandExists('claude')) {
        printWarning('claude not found - falling back to standard shell')
      }

      process.chdir(worktreePath)

      // Worktree created successfully - user is now in the worktree directory
      printInfo('Worktree is ready! You can now start working.')
    }
  } catch (error) {
    printError('Failed to create worktree')
    console.error(error.message)
    process.exit(1)
  }
}

// Resume worktree command
export async function resumeWorktree(args) {
  const name = args[0]

  if (!name) {
    printError('Worktree name is required')
    console.log(`${colors.dim('Usage: baag resume <name>')}`)
    process.exit(1)
  }

  // Apply branch prefix if configured
  const branchPrefix = await getBranchPrefix()
  let finalBranchName = name
  if (branchPrefix) {
    // Only apply prefix if the name doesn't already start with the prefix
    if (!name.startsWith(branchPrefix + '/')) {
      finalBranchName = `${branchPrefix}/${name}`
      printInfo(`Applying configured branch prefix: ${formatBranch(name)} → ${formatBranch(finalBranchName)}`)
    }
  }

  const worktreeExistsAlready = await worktreeExists(name)

  if (worktreeExistsAlready) {
    // Worktree exists - check tmux session status
    printHeader('Resuming Worktree')
    console.log(`Worktree: ${formatBranch(finalBranchName)}`)

    const baagDir = getWorktreesDir()
    const worktreePath = path.join(baagDir, name)

    // Check if tmux session exists
    const sessionName = await getWorktreeConfig(name, 'tmux-session')

    if (sessionName) {
      try {
        // Check if session is still alive
        await $`tmux has-session -t ${sessionName}`

        // Session exists - attach to it
        printSuccess(`Found existing tmux session: ${formatBranch(sessionName)}`)
        printInfo('Attaching to existing session...')

        // Attach to the session
        if (process.stdout.isTTY === true && process.stdin.isTTY === true && process.env.TERM && process.env.TERM !== 'dumb') {
          try {
            const { execSync } = await import('child_process')
            execSync(`tmux attach-session -t ${sessionName}`, {
              stdio: 'inherit',
              encoding: 'utf8',
              timeout: 1000 // Add timeout to prevent hanging
            })
          } catch (error) {
            printWarning('Could not automatically attach to session')
            printInfo('To attach manually, run:')
            console.log(`  ${formatCommand(`tmux attach-session -t ${sessionName}`)}`)
          }
        } else {
          printInfo('Session ready! To attach, run:')
          console.log(`  ${formatCommand(`tmux attach-session -t ${sessionName}`)}`)
        }
        return

      } catch {
        // Session is dead - create a new one
        printWarning(`Tmux session '${sessionName}' is no longer active`)
        printInfo('Creating new tmux session for existing worktree...')

        // Clean up the dead session config
        await unsetWorktreeConfig(name, 'tmux-session')
      }
    } else {
      printInfo('No tmux session found for this worktree')
      printInfo('Creating new tmux session for existing worktree...')
    }

    // Create new tmux session for existing worktree
    if (await checkTmuxClaude()) {
      const configuredAI = await getAIAgent()
      const aiName = configuredAI ? configuredAI.charAt(0).toUpperCase() + configuredAI.slice(1) : 'AI agent'
      printInfo(`Both tmux and ${aiName} detected - creating integrated development environment`)
      await createTmuxSession(name, worktreePath, false) // Default to vertical split
    } else {
      // No tmux/AI available - just change directory
      console.log(`Changing directory to: ${formatPath(worktreePath)}`)
      process.chdir(worktreePath)
      printInfo('Worktree is ready! You can now start working.')
    }

  } else {
    // Worktree doesn't exist - create it like start command
    printInfo(`Worktree '${formatBranch(finalBranchName)}' does not exist`)
    printInfo('Creating new worktree and session...')

    // Use the same logic as startWorktree but with a different header
    await startWorktreeForResume(args)
  }
}

// Helper function to create worktree for resume (same as start but different messaging)
async function startWorktreeForResume(args) {
  // Parse arguments (simpler than start since we don't support all options for resume)
  const name = args[0]

  // Apply branch prefix if configured
  const branchPrefix = await getBranchPrefix()
  let finalBranchName = name
  if (branchPrefix) {
    if (!name.startsWith(branchPrefix + '/')) {
      finalBranchName = `${branchPrefix}/${name}`
    }
  }

  // Determine the base branch (use current or configured)
  let currentBaseBranch = await getCurrentBranch()
  if (currentBaseBranch) {
    printInfo(`Using current branch as base: ${formatBranch(currentBaseBranch)}`)
  } else {
    const configuredBaseBranch = await getBaseBranch()
    if (configuredBaseBranch && await branchExists(configuredBaseBranch)) {
      currentBaseBranch = configuredBaseBranch
      printInfo(`Using configured base branch: ${formatBranch(currentBaseBranch)}`)
    } else {
      currentBaseBranch = 'main'
      printInfo(`Using fallback base branch: ${formatBranch(currentBaseBranch)}`)
    }
  }

  await ensureBaagDir()
  const baagDir = getWorktreesDir()
  const worktreePath = path.join(baagDir, name)

  printHeader('Creating Worktree')
  console.log(`Creating worktree ${formatBranch(finalBranchName)} in ${formatPath(worktreePath)}`)
  console.log(`Base branch: ${formatBranch(currentBaseBranch)}`)

  try {
    // Create worktree with new branch
    if (await branchExists(finalBranchName)) {
      printInfo(`Branch '${formatBranch(finalBranchName)}' already exists, creating worktree from existing branch`)
      await $`git worktree add ${worktreePath} ${finalBranchName}`
    } else {
      printInfo(`Creating new branch '${formatBranch(finalBranchName)}' from '${formatBranch(currentBaseBranch)}' and worktree`)
      await $`git worktree add -b ${finalBranchName} ${worktreePath} ${currentBaseBranch}`
    }

    // Store the base branch for this worktree
    await setWorktreeConfig(name, 'base', currentBaseBranch)
    await setWorktreeConfig(name, 'origin-dir', process.cwd())
    await setWorktreeConfig(name, 'origin-branch', currentBaseBranch)

    printSuccess('Worktree created successfully')

    // Try to open the configured code editor first
    const editorOpened = await openCodeEditor(worktreePath)
    if (editorOpened) {
      printSuccess('Opened worktree in configured code editor')
    }

    // Check if tmux and AI agent are available for enhanced workflow
    if (await checkTmuxClaude()) {
      const configuredAI = await getAIAgent()
      const aiName = configuredAI ? configuredAI.charAt(0).toUpperCase() + configuredAI.slice(1) : 'AI agent'
      printInfo(`Both tmux and ${aiName} detected - creating integrated development environment`)
      await createTmuxSession(name, worktreePath, false) // Default to vertical split for resume
    } else {
      console.log(`Changing directory to: ${formatPath(worktreePath)}`)
      process.chdir(worktreePath)
      printInfo('Worktree is ready! You can now start working.')
    }
  } catch (error) {
    printError('Failed to create worktree')
    console.error(error.message)
    process.exit(1)
  }
}

// Stop worktree command
export async function stopWorktree(args) {
  // Parse arguments to extract name and --force flag
  const forceIndex = args.indexOf('--force')
  const isForce = forceIndex !== -1

  // Remove --force from args if present to get the name
  if (isForce) {
    args.splice(forceIndex, 1)
  }

  let name = args[0]

  // If no name provided, try to auto-detect from current directory
  if (!name) {
    if (isInWorktree()) {
      // Extract worktree name from current path
      name = path.basename(process.cwd())
      printInfo(`Auto-detected worktree: ${formatBranch(name)}`)
    } else {
      printError('Worktree name is required when not in a worktree directory')
      console.log(`${colors.dim('Usage: baag stop <name> [--force] or run from within a worktree')}`)
      process.exit(1)
    }
  }

  if (!await worktreeExists(name)) {
    printError(`Worktree '${formatBranch(name)}' does not exist`)
    process.exit(1)
  }

  printHeader('Removing Worktree')

  // Clean up tmux session
  await cleanupTmuxSession(name)

  console.log(`Removing worktree ${formatBranch(name)}`)
  if (isForce) {
    printWarning('Using --force to remove worktree with uncommitted changes')
  }

        try {
    const baagDir = getWorktreesDir()
    const worktreePath = path.join(baagDir, name)

    // Remove worktree using git - add --force flag if requested
    if (isForce) {
      await $`git worktree remove --force ${worktreePath}`
    } else {
      await $`git worktree remove ${worktreePath}`
    }

    // Verify directory is removed, clean up manually if needed
    if (await fs.pathExists(worktreePath)) {
      printInfo('Cleaning up remaining directory...')
      await fs.remove(worktreePath)
    }

    // Get stored origin information before cleaning up
    const originDir = await getWorktreeConfig(name, 'origin-dir')
    const originBranch = await getWorktreeConfig(name, 'origin-branch')

    // Clean up stored configs
    await unsetWorktreeConfig(name, 'base')
    await unsetWorktreeConfig(name, 'origin-dir')
    await unsetWorktreeConfig(name, 'origin-branch')
    await unsetWorktreeConfig(name, 'session-name')
    await unsetWorktreeConfig(name, 'session-description')
    await unsetWorktreeConfig(name, 'ai-pane')
    await unsetWorktreeConfig(name, 'ai-agent')

    printSuccess(`Worktree '${formatBranch(name)}' removed successfully`)

    // Return to original location if we have the information
    if (originDir && await fs.pathExists(originDir)) {
      printInfo(`Returning to original directory: ${formatPath(originDir)}`)
      process.chdir(originDir)

      // Switch back to original branch if it exists and we're not already on it
      const currentBranch = await getCurrentBranch()
      if (originBranch && currentBranch !== originBranch) {
        try {
          await $`git show-ref --verify --quiet refs/heads/${originBranch}`
          printInfo(`Switching back to original branch: ${formatBranch(originBranch)}`)
          await $`git checkout ${originBranch}`
        } catch {
          printWarning('Could not switch back to original branch')
        }
      }

      // Done! User is back in their original location
      printInfo('You are back where you started!')
    } else {
      printWarning('Could not determine original location')
    }
  } catch (error) {
    printError('Failed to remove worktree')
    console.error(error.message)
    process.exit(1)
  }
}

// List worktrees command
export async function listWorktrees() {
  printHeader('Git Worktrees')

  try {
    const result = await $`git worktree list`
    const lines = result.stdout.trim().split('\n')

    for (const line of lines) {
      // Parse the line to extract path, hash, and branch
      const parts = line.split(/\s+/)
      const worktreePath = parts[0]
      const hash = parts[1]
      const branch = line.match(/\[([^\]]+)\]/)?.[1]

      if (branch) {
        console.log(`${formatPath(worktreePath)} ${colors.yellow(hash)} ${formatBranch(branch)}`)
      } else {
        console.log(`${formatPath(worktreePath)} ${colors.yellow(hash)}`)
      }
    }
  } catch (error) {
    printError('Failed to list worktrees')
    console.error(error.message)
  }

  printHeader('Worktree Information')

  try {
    const result = await $`git config --get-regexp "^worktree\\..*\\."`
    const lines = result.stdout.trim().split('\n').filter(Boolean)

    if (lines.length === 0) {
      console.log(`${colors.dim('  No worktree information stored')}`)
    } else {
      // Get unique worktree names
      const worktreeNames = new Set()
      for (const line of lines) {
        const match = line.match(/^worktree\.([^.]+)\./)
        if (match) {
          worktreeNames.add(match[1])
        }
      }

      for (const worktreeName of worktreeNames) {
        // Get session metadata
        const sessionName = await getWorktreeConfig(worktreeName, 'session-name')
        const sessionDescription = await getWorktreeConfig(worktreeName, 'session-description')

        // Display branch name with session name if available
        if (sessionName) {
          console.log(`  ${formatBranch(worktreeName)}: ${colors.boldCyan(sessionName)}`)
        } else {
          console.log(`  ${formatBranch(worktreeName)}:`)
        }

        // Show session description
        if (sessionDescription) {
          console.log(`    ${colors.dim('Description:')} ${colors.dim(sessionDescription)}`)
        }

        // Show base branch
        const baseBranch = await getWorktreeConfig(worktreeName, 'base')
        if (baseBranch) {
          console.log(`    ${colors.dim('Base branch:')} ${formatBranch(baseBranch)}`)
        }

        // Show origin directory
        const originDir = await getWorktreeConfig(worktreeName, 'origin-dir')
        if (originDir) {
          console.log(`    ${colors.dim('Return to:')} ${formatPath(originDir)}`)
        }

        // Show origin branch
        const originBranch = await getWorktreeConfig(worktreeName, 'origin-branch')
        if (originBranch && originBranch !== baseBranch) {
          console.log(`    ${colors.dim('Return branch:')} ${formatBranch(originBranch)}`)
        }

        console.log()
      }
    }
  } catch {
    console.log(`${colors.dim('  No worktree information stored')}`)
  }

  printHeader('Active Tmux Sessions')
  await listTmuxSessions()
}

// Advanced list worktrees with AI agent live previews
export async function advancedListWorktrees() {
  printHeader('🤖 Live AI Agent Preview')
  console.log(`${colors.dim('Showing what your AI agents are working on...')}`)

  try {
    // Get all baag tmux sessions
    const tmuxSessions = await $`tmux list-sessions -F '#{session_name}' 2>/dev/null || echo ""`
    const baagSessions = tmuxSessions.stdout
      .trim()
      .split('\n')
      .filter(line => line.startsWith('baag-') && line.trim() !== '')

    if (baagSessions.length === 0) {
      console.log(`\n${colors.dim('  No active baag sessions found')}`)
      console.log(`${colors.dim('  Start a session with:')} ${colors.cyan('baag start')}`)
      return
    }

    console.log(`\n${colors.dim('Found ' + baagSessions.length + ' active session(s):')}`)

    for (const sessionName of baagSessions) {
      const worktreeName = sessionName.replace('baag-', '')

      // Get session metadata
      const sessionDisplayName = await getWorktreeConfig(worktreeName, 'session-name')
      const sessionDescription = await getWorktreeConfig(worktreeName, 'session-description')
      const aiAgent = await getWorktreeConfig(worktreeName, 'ai-agent')
      const aiPane = await getWorktreeConfig(worktreeName, 'ai-pane') || '0'
      const baseBranch = await getWorktreeConfig(worktreeName, 'base')

      // Session header with AI agent info
      console.log(`\n╭─ ${colors.boldCyan('🤖 ' + (sessionDisplayName || worktreeName))}`)

      if (sessionDescription) {
        console.log(`│  ${colors.dim(sessionDescription)}`)
      }

      console.log(`├─ ${colors.dim('Agent:')} ${colors.green(aiAgent || 'Unknown')} ${colors.dim('│ Branch:')} ${formatBranch(worktreeName)} ${colors.dim('│ Base:')} ${colors.yellow(baseBranch || 'unknown')}`)

      try {
        // Get the correct window index (tmux sessions can start with 0 or 1)
        const windows = await $`tmux list-windows -t ${sessionName} -F '#{window_index}' 2>/dev/null`
        const firstWindowIndex = windows.stdout.trim().split('\n')[0] || '0'

        // Get the AI agent pane content - this is the key insight!
        const aiPaneTarget = `${sessionName}:${firstWindowIndex}.${aiPane}` // Correct window, specified pane

        // Capture more lines from the AI agent pane to see what it's working on
        const agentContent = await $`tmux capture-pane -t ${aiPaneTarget} -p -S -20 2>/dev/null`
        const contentLines = agentContent.stdout
          .trim()
          .split('\n')
          .slice(-15) // Show last 15 lines - enough to see context
          .filter(line => line.trim() !== '')

        if (contentLines.length > 0) {
          console.log(`├─ ${colors.bold('🔍 AI Agent Activity:')}`)

          // Show the most recent activity with better formatting
          contentLines.forEach((line, index) => {
            const isLastLine = index === contentLines.length - 1
            const prefix = isLastLine ? '└─' : '├─'

            // Detect interesting patterns in AI output
            let formattedLine = line
            if (line.includes('Writing') || line.includes('Creating') || line.includes('Modifying')) {
              formattedLine = colors.green(line)
            } else if (line.includes('Error') || line.includes('Failed')) {
              formattedLine = colors.red(line)
            } else if (line.includes('Running') || line.includes('Executing')) {
              formattedLine = colors.yellow(line)
            } else if (line.includes('Claude>') || line.includes('>')) {
              formattedLine = colors.cyan(line)
            } else {
              formattedLine = colors.dim(line)
            }

            // Truncate very long lines but keep them readable
            if (formattedLine.length > 80) {
              const rawLine = line.length > 77 ? line.substring(0, 77) + '...' : line
              formattedLine = line.includes('Error') || line.includes('Failed')
                ? colors.red(rawLine)
                : colors.dim(rawLine)
            }

            console.log(`│ ${prefix} ${formattedLine}`)
          })
        } else {
          console.log(`├─ ${colors.dim('🔍 AI Agent:')} ${colors.yellow('Waiting for input or starting up...')}`)
        }

        // Check if session is currently attached (someone is actively using it)
        const sessionInfo = await $`tmux display-message -t ${sessionName} -p '#{session_attached}' 2>/dev/null || echo "0"`
        const isAttached = sessionInfo.stdout.trim() === '1'

        const statusIcon = isAttached ? '🟢' : '🟡'
        const statusText = isAttached ? 'Active' : 'Detached'
        console.log(`├─ ${colors.dim('Status:')} ${statusIcon} ${colors.bold(statusText)} ${colors.dim('│ Session:')} ${colors.yellow(sessionName)}`)

      } catch (error) {
        console.log(`├─ ${colors.red('❌ Session not accessible or AI agent not responding')}`)
      }

      console.log(`╰─────────────────────────────────────────────────────────────────────────────`)
    }

    // Helpful commands section
    console.log(`\n${colors.bold('💡 Quick Actions:')}`)
    console.log(`  ${colors.cyan('baag resume <name>')}     ${colors.dim('- Attach and work with an AI agent')}`)
    console.log(`  ${colors.cyan('baag preview')}           ${colors.dim('- Refresh this live preview')}`)
    console.log(`  ${colors.cyan('baag stop <name>')}       ${colors.dim('- Stop a session')}`)
    console.log(`  ${colors.cyan('baag start')}             ${colors.dim('- Create a new AI-powered session')}`)

  } catch (error) {
    printError('Failed to generate AI agent preview')
    console.error(error.message)
  }
}

// Submit/finish worktree command
export async function submitWorktree(args) {
  // Parse arguments
  let prTitle = ''
  let baseBranch = ''
  let baseBranchSpecified = false
  let noVerify = false
  let noPr = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--title' && i + 1 < args.length) {
      prTitle = args[++i]
    } else if (arg === '--base-branch' && i + 1 < args.length) {
      baseBranch = args[++i]
      baseBranchSpecified = true
    } else if (arg === '--no-verify') {
      noVerify = true
    } else if (arg === '--no-pr') {
      noPr = true
    } else {
      printError(`Unknown argument: ${arg}`)
      process.exit(1)
    }
  }

  if (!isInWorktree()) {
    printError('This command should be run from within a worktree')
    console.log(`${colors.dim('Current directory doesn\'t appear to be a worktree')}`)
    process.exit(1)
  }

  const currentBranch = await getCurrentBranch()
  if (!currentBranch) {
    printError('Could not determine current branch')
    process.exit(1)
  }

  // If base branch not specified, try to get stored base branch
  if (!baseBranchSpecified) {
    const storedBase = await getStoredBaseBranch(currentBranch)
    if (storedBase) {
      baseBranch = storedBase
      printInfo(`Using remembered base branch: ${formatBranch(baseBranch)}`)
    } else {
      baseBranch = 'main'
      printWarning(`No remembered base branch, defaulting to: ${formatBranch(baseBranch)}`)
    }
  }

  if (noPr) {
    printHeader('Pushing Changes')
    console.log(`Current branch: ${formatBranch(currentBranch)}`)
    if (noVerify) {
      printWarning('Bypassing git hooks (--no-verify)')
    }
  } else {
    printHeader('Creating Pull Request')
    console.log(`Current branch: ${formatBranch(currentBranch)}`)
    console.log(`Base branch: ${formatBranch(baseBranch)}`)
    if (prTitle) {
      console.log(`PR title: ${colors.boldWhite(prTitle)}`)
    }
    if (noVerify) {
      printWarning('Bypassing git hooks (--no-verify)')
    }
  }

  printInfo('Pushing branch to origin...')

  // Push the current branch to origin
  if (!await pushBranch(currentBranch, noVerify)) {
    printError('Failed to push branch to origin')
    process.exit(1)
  }

  // Skip PR creation if --no-pr flag is set
  if (noPr) {
    printSuccess('Branch pushed successfully!')
    printInfo('You can create a pull request manually when ready')

    const response = await question(`\n${colors.boldYellow('Do you want to remove this worktree?')} ${colors.dim('(y/N)')} `)

    if (response.toLowerCase() === 'y') {
      await cleanupAndRemoveWorktree(currentBranch)
    } else {
      printInfo(`Worktree kept. You can remove it later with: ${colors.bold('baag stop')} ${formatBranch(currentBranch)}`)
    }
    return
  }

  // GitHub CLI is required for PR creation
  if (!await commandExists('gh')) {
    printError('GitHub CLI (gh) is not installed')
    console.log(`${colors.dim('Please install it from: https://cli.github.com/')}`)
    console.log(`${colors.dim('Or use --no-pr flag to skip PR creation')}`)
    process.exit(1)
  }

  printInfo('Creating pull request...')

  try {
    // Build gh pr create command
    const ghArgs = ['pr', 'create', '--base', baseBranch, '--head', currentBranch]

    if (prTitle) {
      ghArgs.push('--title', prTitle, '--body', '')
    } else {
      ghArgs.push('--fill')
    }

    // Create PR using GitHub CLI
    await $`gh ${ghArgs}`

    printSuccess('Pull request created successfully!')

    const response = await question(`\n${colors.boldYellow('Do you want to remove this worktree?')} ${colors.dim('(y/N)')} `)

    if (response.toLowerCase() === 'y') {
      await cleanupAndRemoveWorktree(currentBranch)
    } else {
      printInfo(`Worktree kept. You can remove it later with: ${colors.bold('baag stop')} ${formatBranch(currentBranch)}`)
    }
  } catch (error) {
    printError('Failed to create pull request')
    console.error(error.message)
    process.exit(1)
  }
}

// Cleanup orphaned worktrees and configurations
export async function cleanupWorktrees() {
  printHeader('Cleaning Up Worktrees')

  const cleanupTasks = []

  // 1. Find orphaned worktree directories
  try {
    const baagDir = getWorktreesDir()
    if (await fs.pathExists(baagDir)) {
      const directories = await fs.readdir(baagDir)
      const activeWorktrees = new Set()

      // Get list of active worktrees from git
      try {
        const result = await $`git worktree list`
        const lines = result.stdout.trim().split('\n')
        for (const line of lines) {
          const parts = line.split(/\s+/)
          const worktreePath = parts[0]
          if (worktreePath.includes(baagDir)) {
            const name = path.basename(worktreePath)
            activeWorktrees.add(name)
          }
        }
      } catch (error) {
        printWarning('Could not get active worktree list from git')
      }

      // Find orphaned directories
      for (const dir of directories) {
        const dirPath = path.join(baagDir, dir)
        const stats = await fs.lstat(dirPath)
        if (stats.isDirectory() && !activeWorktrees.has(dir)) {
          cleanupTasks.push({
            type: 'directory',
            name: dir,
            path: dirPath,
            description: `Orphaned worktree directory: ${formatPath(dirPath)}`
          })
        }
      }
    }
  } catch (error) {
    printWarning('Could not scan for orphaned directories')
  }

  // 2. Find orphaned git configurations
  try {
    const result = await $`git config --get-regexp "^worktree\\..*\\."`
    const lines = result.stdout.trim().split('\n').filter(Boolean)

    // Get unique worktree names from configs
    const configWorktrees = new Set()
    for (const line of lines) {
      const match = line.match(/^worktree\.([^.]+)\./)
      if (match) {
        configWorktrees.add(match[1])
      }
    }

    // Check which config worktrees don't have actual worktrees
    for (const worktreeName of configWorktrees) {
      if (!(await worktreeExists(worktreeName))) {
        cleanupTasks.push({
          type: 'config',
          name: worktreeName,
          description: `Orphaned git config for: ${formatBranch(worktreeName)}`
        })
      }
    }
  } catch {
    // No configs found, that's fine
  }

  // 3. Find dead tmux sessions
  try {
    const result = await $`git config --get-regexp "^worktree\\..*\\.tmux-session$"`
    const lines = result.stdout.trim().split('\n').filter(Boolean)

    for (const line of lines) {
      const [key, sessionName] = line.split(' ')
      const worktreeName = key.replace(/^worktree\.(.*)\.tmux-session$/, '$1')

      try {
        await $`tmux has-session -t ${sessionName}`
        // Session is alive, check if worktree still exists
        if (!(await worktreeExists(worktreeName))) {
          cleanupTasks.push({
            type: 'tmux-config',
            name: worktreeName,
            sessionName: sessionName,
            description: `Tmux session config for deleted worktree: ${formatBranch(worktreeName)} → ${colors.boldCyan(sessionName)}`
          })
        }
      } catch {
        // Session is dead
        cleanupTasks.push({
          type: 'tmux-config',
          name: worktreeName,
          sessionName: sessionName,
          description: `Dead tmux session config: ${formatBranch(worktreeName)} → ${colors.dim(sessionName + ' (dead)')}`
        })
      }
    }
  } catch {
    // No tmux sessions found
  }

  // Show what will be cleaned up
  if (cleanupTasks.length === 0) {
    printSuccess('No cleanup needed! Everything looks clean.')
    return
  }

  console.log(`${colors.boldYellow('Found ' + cleanupTasks.length + ' items to clean up:')}\n`)

  for (let i = 0; i < cleanupTasks.length; i++) {
    console.log(`${colors.dim((i + 1) + '.')} ${cleanupTasks[i].description}`)
  }

  console.log()
  const response = await question(`${colors.boldRed('Do you want to proceed with cleanup?')} ${colors.dim('(y/N)')} `)

  if (response.toLowerCase() !== 'y') {
    printInfo('Cleanup cancelled')
    return
  }

  // Perform cleanup
  printHeader('Performing Cleanup')
  let cleanedCount = 0

  for (const task of cleanupTasks) {
    try {
      switch (task.type) {
        case 'directory':
          console.log(`Removing directory: ${formatPath(task.path)}`)
          await fs.remove(task.path)
          cleanedCount++
          break

        case 'config':
          console.log(`Removing git configs for: ${formatBranch(task.name)}`)
          // Remove all configs for this worktree
          try {
            await unsetWorktreeConfig(task.name, 'base')
          } catch {}
          try {
            await unsetWorktreeConfig(task.name, 'origin-dir')
          } catch {}
          try {
            await unsetWorktreeConfig(task.name, 'origin-branch')
          } catch {}
          try {
            await unsetWorktreeConfig(task.name, 'tmux-session')
          } catch {}
          try {
            await unsetWorktreeConfig(task.name, 'session-name')
          } catch {}
          try {
            await unsetWorktreeConfig(task.name, 'session-description')
          } catch {}
          try {
            await unsetWorktreeConfig(task.name, 'ai-pane')
          } catch {}
          try {
            await unsetWorktreeConfig(task.name, 'ai-agent')
          } catch {}
          cleanedCount++
          break

        case 'tmux-config':
          console.log(`Removing tmux session config: ${formatBranch(task.name)}`)
          await unsetWorktreeConfig(task.name, 'tmux-session')
          cleanedCount++
          break
      }
    } catch (error) {
      printError(`Failed to clean up ${task.name}: ${error.message}`)
    }
  }

  printSuccess(`Cleanup completed! Removed ${cleanedCount} items.`)
}

// Helper function to cleanup and remove worktree
async function cleanupAndRemoveWorktree(currentBranch) {
  const mainRepo = await getMainRepoDir()
  const currentWorktree = process.cwd()
  const worktreeName = path.basename(currentWorktree)

  printHeader('Cleaning Up')

  // Clean up tmux session first
  await cleanupTmuxSession(worktreeName)

  console.log(`Changing to main repository: ${formatPath(mainRepo)}`)
  process.chdir(mainRepo)

  console.log(`Removing worktree: ${formatBranch(worktreeName)}`)

  try {
    // First try git worktree remove
    await $`git worktree remove ${currentWorktree}`

    // Verify directory is removed, clean up manually if needed
    if (await fs.pathExists(currentWorktree)) {
      printInfo('Cleaning up remaining directory...')
      await fs.remove(currentWorktree)
    }

    // Clean up stored configs using worktree name (not branch name)
    await unsetWorktreeConfig(worktreeName, 'base')
    await unsetWorktreeConfig(worktreeName, 'origin-dir')
    await unsetWorktreeConfig(worktreeName, 'origin-branch')
    await unsetWorktreeConfig(worktreeName, 'session-name')
    await unsetWorktreeConfig(worktreeName, 'session-description')
    await unsetWorktreeConfig(worktreeName, 'ai-pane')
    await unsetWorktreeConfig(worktreeName, 'ai-agent')

    printSuccess('Worktree removed successfully!')
    printInfo('You are now in the main repository')
  } catch (error) {
    printError('Failed to remove worktree')
    console.error(error.message)
    process.exit(1)
  }
}

// Switch to worktree command
export async function switchWorktree(args) {
  const name = args[0]

  if (!name) {
    printError('Worktree name is required')
    console.log(`${colors.dim('Usage: baag switch <name>')}`)
    process.exit(1)
  }

  // Apply branch prefix if configured
  const branchPrefix = await getBranchPrefix()
  let finalBranchName = name
  if (branchPrefix) {
    // Only apply prefix if the name doesn't already start with the prefix
    if (!name.startsWith(branchPrefix + '/')) {
      finalBranchName = `${branchPrefix}/${name}`
      printInfo(`Applying configured branch prefix: ${formatBranch(name)} → ${formatBranch(finalBranchName)}`)
    }
  }

  if (!await worktreeExists(name)) {
    printError(`Worktree '${formatBranch(finalBranchName)}' does not exist`)
    
    // Show available worktrees
    try {
      const result = await $`git config --get-regexp "^worktree\\..*\\."`
      const lines = result.stdout.trim().split('\n').filter(Boolean)
      
      if (lines.length > 0) {
        const worktreeNames = new Set()
        for (const line of lines) {
          const match = line.match(/^worktree\.([^.]+)\./)
          if (match) {
            worktreeNames.add(match[1])
          }
        }
        
        if (worktreeNames.size > 0) {
          console.log()
          printInfo('Available worktrees:')
          for (const worktreeName of worktreeNames) {
            console.log(`  ${formatBranch(worktreeName)}`)
          }
        }
      }
    } catch {
      // Ignore errors when listing available worktrees
    }
    
    process.exit(1)
  }

  printHeader('Switching to Worktree')
  console.log(`Worktree: ${formatBranch(finalBranchName)}`)

  const baagDir = getWorktreesDir()
  const worktreePath = path.join(baagDir, name)

  // Check if tmux session exists and is alive
  const sessionName = await getWorktreeConfig(name, 'tmux-session')
  
  if (sessionName) {
    try {
      // Check if session is still alive
      await $`tmux has-session -t ${sessionName}`
      
      // Session exists - attach to it directly
      printSuccess(`Found existing tmux session: ${formatBranch(sessionName)}`)
      printInfo('Switching to session...')
      
      // Attach to the session
      if (process.stdout.isTTY === true && process.stdin.isTTY === true && process.env.TERM && process.env.TERM !== 'dumb') {
        try {
          const { execSync } = await import('child_process')
          execSync(`tmux attach-session -t ${sessionName}`, {
            stdio: 'inherit',
            encoding: 'utf8',
            timeout: 1000 // Add timeout to prevent hanging
          })
          // If we get here, user detached from tmux session
          return
        } catch (error) {
          // Fallback to manual attachment instructions
          printWarning('Could not automatically attach to session')
          printInfo('To attach manually, run:')
          console.log(`  ${formatCommand(`tmux attach-session -t ${sessionName}`)}`)
          return
        }
      } else {
        // Not running in an interactive terminal
        printInfo('Session ready! To attach, run:')
        console.log(`  ${formatCommand(`tmux attach-session -t ${sessionName}`)}`)
        return
      }
      
    } catch {
      // Session is dead, clean it up and create a new one
      printWarning('Found dead tmux session, cleaning up...')
      await cleanupTmuxSession(name)
      printInfo('Creating new tmux session for existing worktree...')
    }
  } else {
    printInfo('No tmux session found for this worktree')
    printInfo('Creating new tmux session for existing worktree...')
  }

  // Create new tmux session for existing worktree
  if (await checkTmuxClaude()) {
    const configuredAI = await getAIAgent()
    const aiName = configuredAI ? configuredAI.charAt(0).toUpperCase() + configuredAI.slice(1) : 'AI agent'
    printInfo(`Both tmux and ${aiName} detected - creating integrated development environment`)
    await createTmuxSession(name, worktreePath, false) // Default to vertical split
  } else {
    // No tmux/AI available - just change directory
    console.log(`Changing directory to: ${formatPath(worktreePath)}`)
    process.chdir(worktreePath)
    printInfo('Worktree is ready! You can now start working.')
  }
}