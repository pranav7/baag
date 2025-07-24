#!/usr/bin/env node

import { $, fs, path } from 'zx'
import { question } from 'zx'
import {
  printHeader, printInfo, printSuccess, printError, printWarning,
  formatBranch, formatPath, formatCommand, colors
} from './colors.mjs'
import {
  checkGitRepository, checkGitStatus, getCurrentBranch, branchExists,
  getMainRepoDir, getWorktreesDir, isInWorktree, worktreeExists,
  getStoredBaseBranch, setWorktreeConfig, getWorktreeConfig, unsetWorktreeConfig,
  pushBranch, getAvailableBranches
} from './git-utils.mjs'
import { checkTmuxClaude, createTmuxSession, cleanupTmuxSession, listTmuxSessions } from './tmux-utils.mjs'

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

// Start worktree command
export async function startWorktree(args) {
  // Parse arguments
  let horizontalSplit = false
  let name = ''
  let baseBranch = ''
  let baseBranchSpecified = false

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
    } else {
      printError('Too many arguments')
      process.exit(1)
    }
  }

  if (!name) {
    printError('Worktree name is required')
    process.exit(1)
  }

  if (await worktreeExists(name)) {
    printError(`Worktree '${formatBranch(name)}' already exists`)
    process.exit(1)
  }

  // Determine the base branch for this worktree
  let currentBaseBranch
  if (baseBranchSpecified) {
    // Validate that the specified base branch exists
    if (!await branchExists(baseBranch)) {
      printError(`Base branch '${formatBranch(baseBranch)}' does not exist`)
      printInfo(`Available branches: ${await getAvailableBranches()}`)
      process.exit(1)
    }
    currentBaseBranch = baseBranch
    printInfo(`Using specified base branch: ${formatBranch(currentBaseBranch)}`)
  } else {
    // Use current branch as base (existing behavior)
    currentBaseBranch = await getCurrentBranch()
    if (!currentBaseBranch) {
      currentBaseBranch = 'main'
    }
    printInfo(`Using current branch as base: ${formatBranch(currentBaseBranch)}`)
  }

          await ensureBaagDir()
    const baagDir = getWorktreesDir()
    const worktreePath = path.join(baagDir, name)

  printHeader('Creating Worktree')
  console.log(`Creating worktree ${formatBranch(name)} in ${formatPath(worktreePath)}`)
  console.log(`Base branch: ${formatBranch(currentBaseBranch)}`)

  try {
    // Create worktree with new branch
    if (await branchExists(name)) {
      printInfo(`Branch '${formatBranch(name)}' already exists, creating worktree from existing branch`)
      await $`git worktree add ${worktreePath} ${name}`
    } else {
      printInfo(`Creating new branch '${formatBranch(name)}' from '${formatBranch(currentBaseBranch)}' and worktree`)
      await $`git worktree add -b ${name} ${worktreePath} ${currentBaseBranch}`
    }

    // Store the base branch for this worktree
    await setWorktreeConfig(name, 'base', currentBaseBranch)

    // Store the original directory and branch for easy return
    await setWorktreeConfig(name, 'origin-dir', process.cwd())
    await setWorktreeConfig(name, 'origin-branch', currentBaseBranch)

    printSuccess('Worktree created successfully')

    // Check if tmux and claude are available for enhanced workflow
    if (await checkTmuxClaude()) {
      printInfo('Both tmux and claude detected - creating integrated development environment')
      const tmuxSuccess = await createTmuxSession(name, worktreePath, horizontalSplit)

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
      if (!await commandExists('claude')) {
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

// Stop worktree command
export async function stopWorktree(args) {
  let name = args[0]

  // If no name provided, try to auto-detect from current directory
  if (!name) {
    if (isInWorktree()) {
      // Extract worktree name from current path
      name = path.basename(process.cwd())
      printInfo(`Auto-detected worktree: ${formatBranch(name)}`)
    } else {
      printError('Worktree name is required when not in a worktree directory')
      console.log(`${colors.dim('Usage: baag stop <n> or run from within a worktree')}`)
      process.exit(1)
    }
  }

  if (!await worktreeExists(name)) {
    printError(`Worktree '${formatBranch(name)}' does not exist`)
    process.exit(1)
  }

  printHeader('Removing Worktree')

  // Clean up tmux session first
  await cleanupTmuxSession(name)

  console.log(`Removing worktree ${formatBranch(name)}`)

        try {
    const baagDir = getWorktreesDir()
    const worktreePath = path.join(baagDir, name)

    // Remove worktree using git
    await $`git worktree remove ${worktreePath}`

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
        console.log(`  ${formatBranch(worktreeName)}:`)

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
  await cleanupTmuxSession(currentBranch)

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

    // Clean up stored configs
    await unsetWorktreeConfig(currentBranch, 'base')
    await unsetWorktreeConfig(currentBranch, 'origin-dir')
    await unsetWorktreeConfig(currentBranch, 'origin-branch')

    printSuccess('Worktree removed successfully!')
    printInfo('You are now in the main repository')
  } catch (error) {
    printError('Failed to remove worktree')
    console.error(error.message)
    process.exit(1)
  }
}