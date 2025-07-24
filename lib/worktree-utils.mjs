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

// Ensure worktrees directory exists
async function ensureWorktreesDir() {
  const worktreesDir = getWorktreesDir()
  if (!await fs.pathExists(worktreesDir)) {
    printInfo(`Creating worktrees directory: ${formatPath(worktreesDir)}`)
    await fs.ensureDir(worktreesDir)
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

  await ensureWorktreesDir()
  const worktreesDir = getWorktreesDir()
  const worktreePath = path.join(worktreesDir, name)

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
      await createTmuxSession(name, worktreePath, horizontalSplit)
    } else {
      console.log(`Changing directory to: ${formatPath(worktreePath)}`)
      if (!await commandExists('tmux')) {
        printWarning('tmux not found - falling back to standard shell')
      }
      if (!await commandExists('claude')) {
        printWarning('claude not found - falling back to standard shell')
      }

      process.chdir(worktreePath)
      // Start a new shell in the worktree directory
      await $`${process.env.SHELL || '/bin/bash'}`
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
      console.log(`${colors.dim}Usage: baag stop <name> or run from within a worktree${colors.dim}`)
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
    const worktreesDir = getWorktreesDir()
    await $`git worktree remove ${path.join(worktreesDir, name)}`

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

      // Start a new shell in the original location
      printInfo('You are back where you started!')
      await $`${process.env.SHELL || '/bin/bash'}`
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
      console.log(`${colors.dim}  No worktree information stored${colors.dim}`)
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
          console.log(`    ${colors.dim}Base branch:${colors.dim} ${formatBranch(baseBranch)}`)
        }

        // Show origin directory
        const originDir = await getWorktreeConfig(worktreeName, 'origin-dir')
        if (originDir) {
          console.log(`    ${colors.dim}Return to:${colors.dim} ${formatPath(originDir)}`)
        }

        // Show origin branch
        const originBranch = await getWorktreeConfig(worktreeName, 'origin-branch')
        if (originBranch && originBranch !== baseBranch) {
          console.log(`    ${colors.dim}Return branch:${colors.dim} ${formatBranch(originBranch)}`)
        }

        console.log()
      }
    }
  } catch {
    console.log(`${colors.dim}  No worktree information stored${colors.dim}`)
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
    console.log(`${colors.dim}Current directory doesn't appear to be a worktree${colors.dim}`)
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

    const response = await question(`\n${colors.boldYellow('Do you want to remove this worktree?')} ${colors.dim}(y/N)${colors.dim} `)

    if (response.toLowerCase() === 'y') {
      await cleanupAndRemoveWorktree(currentBranch)
    } else {
      printInfo(`Worktree kept. You can remove it later with: ${colors.bold}baag stop ${formatBranch(currentBranch)}${colors.bold}`)
    }
    return
  }

  // GitHub CLI is required for PR creation
  if (!await commandExists('gh')) {
    printError('GitHub CLI (gh) is not installed')
    console.log(`${colors.dim}Please install it from: https://cli.github.com/${colors.dim}`)
    console.log(`${colors.dim}Or use --no-pr flag to skip PR creation${colors.dim}`)
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

    const response = await question(`\n${colors.boldYellow('Do you want to remove this worktree?')} ${colors.dim}(y/N)${colors.dim} `)

    if (response.toLowerCase() === 'y') {
      await cleanupAndRemoveWorktree(currentBranch)
    } else {
      printInfo(`Worktree kept. You can remove it later with: ${colors.bold}baag stop ${formatBranch(currentBranch)}${colors.bold}`)
    }
  } catch (error) {
    printError('Failed to create pull request')
    console.error(error.message)
    process.exit(1)
  }
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
    await $`git worktree remove ${currentWorktree}`

    // Clean up stored configs
    await unsetWorktreeConfig(currentBranch, 'base')
    await unsetWorktreeConfig(currentBranch, 'origin-dir')
    await unsetWorktreeConfig(currentBranch, 'origin-branch')

    printSuccess('Worktree removed successfully!')
    printInfo('You are now in the main repository')

    // Start a new shell in the main repo
    await $`${process.env.SHELL || '/bin/bash'}`
  } catch (error) {
    printError('Failed to remove worktree')
    console.error(error.message)
    process.exit(1)
  }
}