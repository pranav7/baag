#!/usr/bin/env zx

import { $, path, fs, os, question } from 'zx'
import chalk from 'chalk'
import boxen from 'boxen'
import Table from 'cli-table3'
import figures from 'figures'
import ora from 'ora'

$.verbose = false

// Enhanced pretty print functions using modern CLI libraries
function printSuccess(message) {
  console.log(chalk.green(figures.tick) + ' ' + message)
}

function printError(message) {
  console.error(chalk.red(figures.cross) + ' ' + message)
}

function printInfo(message) {
  console.log(chalk.blue(figures.info) + ' ' + message)
}

function printWarning(message) {
  console.log(chalk.yellow(figures.warning) + ' ' + message)
}

function printHeader(message) {
  console.log(boxen(chalk.bold.cyan(message), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 0 },
    borderStyle: 'round',
    borderColor: 'cyan'
  }))
}

function printBranch(name) {
  return chalk.bgMagenta.white(` ${name} `)
}

function printPath(path) {
  return chalk.cyan(path)
}

function printHash(hash) {
  return chalk.bgBlue.white(` ${hash} `)
}

// Validation functions
async function checkGitRepository() {
  try {
    await $`git rev-parse --git-dir`
    await $`git rev-parse --show-toplevel`
  } catch (error) {
    printError("Not in a git repository")
    console.log(`${colors.DIM}Please run this command from within a git repository.${colors.NC}`)
    process.exit(1)
  }
}

async function checkGitStatus() {
  try {
    await $`git status`
  } catch (error) {
    printError("Git repository appears to be corrupted or inaccessible")
    process.exit(1)
  }
}

// Get the baag directory (in current git repo root)
function getBaagDir() {
  const gitRoot = getGitRoot()
  return path.join(gitRoot, '.baag')
}

function getGitRoot() {
  try {
    // Get git root directory
    const result = $`git rev-parse --show-toplevel`
    return result.stdout.trim()
  } catch {
    return process.cwd()
  }
}

const baagDir = getBaagDir()

function usage() {
  printHeader("Baag - Git Worktree Manager")
  
  console.log(boxen([
    chalk.bold('Usage:') + ' baag ' + chalk.cyan('<command>') + chalk.dim(' [options] [name]'),
    chalk.dim('Alias:') + ' wt ' + chalk.cyan('<command>') + chalk.dim(' [options] [name]')
  ].join('\n'), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 1 },
    borderStyle: 'single'
  }))
  
  const commandsTable = new Table({
    head: [chalk.bold('Command'), chalk.bold('Description')],
    colWidths: [20, 60],
    style: { border: [], head: ['cyan'] }
  })
  
  commandsTable.push(
    [chalk.green('start') + ' ' + chalk.cyan('<name>'), 'Create a new worktree and branch\n' + chalk.dim('• Remembers current branch as base for PR\n• Auto-creates tmux session with Claude if available')],
    [chalk.red('stop') + ' ' + chalk.cyan('[name]'), 'Remove an existing worktree\n' + chalk.dim('• Auto-detects worktree if run from within one\n• Cleans up tmux sessions automatically')],
    [chalk.blue('submit') + ' ' + chalk.dim('[options]'), 'Create PR and optionally clean up current worktree\n' + chalk.dim('• --title <title>: PR title\n• --base-branch <branch>: target branch\n• --no-verify: bypass git hooks\n• --no-pr: only push, don\'t create pull request')],
    [chalk.yellow('list, ls'), 'Show all existing worktrees and tmux sessions'],
    [chalk.magenta('version'), 'Show version information']
  )
  
  console.log(commandsTable.toString())
  process.exit(1)
}

function showVersion() {
  printHeader("Baag - Git Worktree Manager")
  
  console.log(boxen([
    'Version: ' + chalk.bold.green('1.0.0'),
    'Author: ' + chalk.bold.cyan('https://github.com/your-username/baag'),
    'License: ' + chalk.bold.yellow('MIT'),
    '',
    chalk.dim('Enhanced git worktree workflows with tmux integration')
  ].join('\n'), {
    padding: 1,
    margin: { top: 0, bottom: 1 },
    borderStyle: 'double',
    borderColor: 'green'
  }))
  
  process.exit(0)
}

async function ensureBaagDir() {
  if (!fs.existsSync(baagDir)) {
    printInfo(`Creating baag directory: ${printPath(baagDir)}`)
    await $`mkdir -p ${baagDir}`
    
    // Create .gitignore to ignore worktrees in the main repo
    const gitignorePath = path.join(baagDir, '.gitignore')
    await fs.writeFile(gitignorePath, '*\n!.gitignore\n')
    printInfo('Created .gitignore to exclude worktrees from main repo')
  }
}

async function worktreeExists(name) {
  try {
    const result = await $`git worktree list`
    return result.stdout.includes(`${baagDir}/${name}`)
  } catch (error) {
    return false
  }
}

async function branchExists(name) {
  try {
    await $`git show-ref --verify --quiet refs/heads/${name}`
    return true
  } catch (error) {
    return false
  }
}

async function getCurrentBranch() {
  try {
    const result = await $`git branch --show-current`
    return result.stdout.trim()
  } catch (error) {
    return ""
  }
}

async function startWorktree(name) {
  if (!name) {
    printError("Worktree name is required")
    usage()
  }

  if (await worktreeExists(name)) {
    printError(`Worktree '${printBranch(name)}' already exists`)
    process.exit(1)
  }

  // Remember the current branch as the base branch for this worktree
  let currentBaseBranch = await getCurrentBranch()
  if (!currentBaseBranch) {
    currentBaseBranch = "main"
  }

  await ensureWorktreesDir()

  printHeader("Creating Worktree")
  console.log(`Creating worktree ${printBranch(name)} in ${printPath(`${worktreesDir}/${name}`)}`)
  console.log(`Base branch: ${printBranch(currentBaseBranch)}`)

  try {
    // Create worktree with new branch
    if (await branchExists(name)) {
      printInfo(`Branch '${printBranch(name)}' already exists, creating worktree from existing branch`)
      await $`git worktree add ${worktreesDir}/${name} ${name}`
    } else {
      printInfo(`Creating new branch '${printBranch(name)}' and worktree`)
      await $`git worktree add -b ${name} ${worktreesDir}/${name}`
    }

    // Store the base branch for this worktree
    await $`git config worktree.${name}.base ${currentBaseBranch}`
    printSuccess("Worktree created successfully")

    // Check if tmux and claude are available for enhanced workflow
    if (await checkTmuxClaude()) {
      printInfo("Both tmux and claude detected - creating integrated development environment")
      await createTmuxSession(name, `${worktreesDir}/${name}`)
    } else {
      console.log(`Changing directory to: ${printPath(`${worktreesDir}/${name}`)}`)
      
      try {
        await $`which tmux`
      } catch {
        printWarning("tmux not found - falling back to standard shell")
      }
      
      try {
        await $`which claude`
      } catch {
        printWarning("claude not found - falling back to standard shell")
      }
      
      process.chdir(`${worktreesDir}/${name}`)
      // Start a new shell in the worktree directory
      await $`${process.env.SHELL || '/bin/bash'}`
    }
  } catch (error) {
    printError("Failed to create worktree")
    process.exit(1)
  }
}

async function stopWorktree(name) {
  if (!name) {
    printError("Worktree name is required")
    usage()
  }

  if (!(await worktreeExists(name))) {
    printError(`Worktree '${printBranch(name)}' does not exist`)
    process.exit(1)
  }

  printHeader("Removing Worktree")

  // Clean up tmux session first
  await cleanupTmuxSession(name)

  console.log(`Removing worktree ${printBranch(name)}`)
  
  try {
    await $`git worktree remove ${worktreesDir}/${name}`
    
    // Clean up stored base branch config
    try {
      await $`git config --unset worktree.${name}.base`
    } catch {}
    
    printSuccess(`Worktree '${printBranch(name)}' removed successfully`)
  } catch (error) {
    printError("Failed to remove worktree")
    process.exit(1)
  }
}

async function listWorktrees() {
  printHeader("Git Worktrees")

  try {
    const result = await $`git worktree list`
    const lines = result.stdout.trim().split('\n')
    
    for (const line of lines) {
      const parts = line.split(/\s+/)
      const path = parts[0]
      const hash = parts[1]
      const branchMatch = line.match(/\[([^\]]+)\]/)
      
      if (branchMatch) {
        const branch = branchMatch[1]
        console.log(`${printPath(path)} ${printHash(hash)} ${printBranch(branch)}`)
      } else {
        console.log(`${printPath(path)} ${printHash(hash)}`)
      }
    }
  } catch (error) {
    printError("Failed to list worktrees")
  }

  printHeader("Remembered Base Branches")
  try {
    const result = await $`git config --get-regexp "^worktree\\..*\\.base$"`
    const lines = result.stdout.trim().split('\n')
    
    if (lines.length > 0 && lines[0]) {
      for (const line of lines) {
        const [key, value] = line.split(' ')
        const worktreeName = key.replace(/worktree\.(.*)\.base/, '$1')
        console.log(`  ${printBranch(worktreeName)} ${colors.DIM}→${colors.NC} ${printBranch(value)}`)
      }
    } else {
      console.log(`${colors.DIM}  No remembered base branches${colors.NC}`)
    }
  } catch (error) {
    console.log(`${colors.DIM}  No remembered base branches${colors.NC}`)
  }

  printHeader("Active Tmux Sessions")
  try {
    const result = await $`git config --get-regexp "^worktree\\..*\\.tmux-session$"`
    const lines = result.stdout.trim().split('\n')
    
    if (lines.length > 0 && lines[0]) {
      for (const line of lines) {
        const [key, value] = line.split(' ')
        const worktreeName = key.replace(/worktree\.(.*)\.tmux-session/, '$1')
        
        // Check if session is actually running
        try {
          await $`tmux has-session -t ${value}`
          console.log(`  ${printBranch(worktreeName)} ${colors.DIM}→${colors.NC} ${colors.BOLD_CYAN}${value}${colors.NC} ${colors.GREEN}(active)${colors.NC}`)
        } catch {
          console.log(`  ${printBranch(worktreeName)} ${colors.DIM}→${colors.NC} ${colors.DIM}${value} (dead)${colors.NC}`)
        }
      }
    } else {
      console.log(`${colors.DIM}  No tmux sessions${colors.NC}`)
    }
  } catch (error) {
    console.log(`${colors.DIM}  No tmux sessions${colors.NC}`)
  }
}

function isInWorktree() {
  const currentDir = process.cwd()
  return currentDir.includes('/worktrees/')
}

async function getMainRepoDir() {
  try {
    const result = await $`git worktree list`
    return result.stdout.split('\n')[0].split(/\s+/)[0]
  } catch {
    return ""
  }
}

async function getStoredBaseBranch(branchName) {
  try {
    const mainRepo = await getMainRepoDir()
    if (mainRepo && fs.existsSync(mainRepo)) {
      const result = await $`cd ${mainRepo} && git config --get worktree.${branchName}.base`
      return result.stdout.trim()
    } else {
      const result = await $`git config --get worktree.${branchName}.base`
      return result.stdout.trim()
    }
  } catch {
    return ""
  }
}

async function checkTmuxClaude() {
  try {
    await $`which tmux`
    await $`which claude`
    return true
  } catch {
    return false
  }
}

async function createTmuxSession(worktreeName, worktreePath) {
  const sessionName = `worktree-${worktreeName}`

  printInfo("Creating tmux session with Claude integration")

  try {
    // Create new tmux session in detached mode
    await $`tmux new-session -d -s ${sessionName} -c ${worktreePath}`

    // Split window vertically (creates left and right panes)
    await $`tmux split-window -h -t ${sessionName} -c ${worktreePath}`

    // Left pane: Start Claude
    await $`tmux send-keys -t ${sessionName}:0.0 "claude" Enter`

    // Right pane: Just the shell (already in the right directory)
    await $`tmux send-keys -t ${sessionName}:0.1 "clear" Enter`

    // Focus on the right pane (terminal)
    await $`tmux select-pane -t ${sessionName}:0.1`

    // Store session name for cleanup
    await $`git config worktree.${worktreeName}.tmux-session ${sessionName}`

    // Attach to the session
    printSuccess(`Tmux session created: ${printBranch(sessionName)}`)
    console.log(`Left pane: ${colors.BOLD_CYAN}Claude${colors.NC} | Right pane: ${colors.BOLD_GREEN}Terminal${colors.NC}`)
    await $`tmux attach-session -t ${sessionName}`
  } catch (error) {
    printError("Failed to create tmux session")
  }
}

async function cleanupTmuxSession(worktreeName) {
  try {
    const mainRepo = await getMainRepoDir()
    let sessionName

    if (mainRepo && fs.existsSync(mainRepo)) {
      const result = await $`cd ${mainRepo} && git config --get worktree.${worktreeName}.tmux-session`
      sessionName = result.stdout.trim()
    } else {
      const result = await $`git config --get worktree.${worktreeName}.tmux-session`
      sessionName = result.stdout.trim()
    }

    if (sessionName) {
      try {
        await $`tmux has-session -t ${sessionName}`
        printInfo(`Cleaning up tmux session: ${printBranch(sessionName)}`)
        await $`tmux kill-session -t ${sessionName}`

        // Remove session config
        if (mainRepo && fs.existsSync(mainRepo)) {
          try {
            await $`cd ${mainRepo} && git config --unset worktree.${worktreeName}.tmux-session`
          } catch {}
        } else {
          try {
            await $`git config --unset worktree.${worktreeName}.tmux-session`
          } catch {}
        }
      } catch {
        // Session doesn't exist, nothing to clean up
      }
    }
  } catch {
    // No session config found
  }
}

async function submitWorktree(args) {
  let prTitle = ""
  let baseBranch = ""
  let baseBranchSpecified = false
  let noVerify = false
  let noPr = false

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--title':
        if (i + 1 < args.length) {
          prTitle = args[i + 1]
          i++
        } else {
          printError("--title requires a value")
          process.exit(1)
        }
        break
      case '--base-branch':
        if (i + 1 < args.length) {
          baseBranch = args[i + 1]
          baseBranchSpecified = true
          i++
        } else {
          printError("--base-branch requires a value")
          process.exit(1)
        }
        break
      case '--no-verify':
        noVerify = true
        break
      case '--no-pr':
        noPr = true
        break
      default:
        printError(`Unknown argument: ${args[i]}`)
        usage()
    }
  }

  if (!isInWorktree()) {
    printError("This command should be run from within a worktree")
    console.log(`${colors.DIM}Current directory doesn't appear to be a worktree${colors.NC}`)
    process.exit(1)
  }

  const currentBranch = await getCurrentBranch()
  if (!currentBranch) {
    printError("Could not determine current branch")
    process.exit(1)
  }

  // If base branch not specified, try to get stored base branch
  if (!baseBranchSpecified) {
    const storedBase = await getStoredBaseBranch(currentBranch)
    if (storedBase) {
      baseBranch = storedBase
      printInfo(`Using remembered base branch: ${printBranch(baseBranch)}`)
    } else {
      baseBranch = "main"
      printWarning(`No remembered base branch, defaulting to: ${printBranch(baseBranch)}`)
    }
  }

  if (noPr) {
    printHeader("Pushing Changes")
    console.log(`Current branch: ${printBranch(currentBranch)}`)
    if (noVerify) {
      printWarning("Bypassing git hooks (--no-verify)")
    }
  } else {
    printHeader("Creating Pull Request")
    console.log(`Current branch: ${printBranch(currentBranch)}`)
    console.log(`Base branch: ${printBranch(baseBranch)}`)
    if (prTitle) {
      console.log(`PR title: ${colors.BOLD_WHITE}${prTitle}${colors.NC}`)
    }
    if (noVerify) {
      printWarning("Bypassing git hooks (--no-verify)")
    }
  }

  printInfo("Pushing branch to origin...")

  try {
    // Push the current branch to origin
    if (noVerify) {
      await $`git push -u origin ${currentBranch} --no-verify`
    } else {
      await $`git push -u origin ${currentBranch}`
    }
  } catch (error) {
    printError("Failed to push branch to origin")
    process.exit(1)
  }

  // Skip PR creation if --no-pr flag is set
  if (noPr) {
    printSuccess("Branch pushed successfully!")
    printInfo("You can create a pull request manually when ready")

    const response = await question(`\n${colors.BOLD_YELLOW}Do you want to remove this worktree?${colors.NC} ${colors.DIM}(y/N)${colors.NC} `)

    if (response === 'y' || response === 'Y') {
      const mainRepo = await getMainRepoDir()
      const currentWorktree = process.cwd()
      const worktreeName = path.basename(currentWorktree)

      printHeader("Cleaning Up")

      // Clean up tmux session first
      await cleanupTmuxSession(currentBranch)

      console.log(`Changing to main repository: ${printPath(mainRepo)}`)
      process.chdir(mainRepo)

      console.log(`Removing worktree: ${printBranch(worktreeName)}`)
      
      try {
        await $`git worktree remove ${currentWorktree}`
        
        // Clean up stored base branch config
        try {
          await $`git config --unset worktree.${currentBranch}.base`
        } catch {}
        
        printSuccess("Worktree removed successfully!")
        printInfo("You are now in the main repository")
        // Start a new shell in the main repo
        await $`${process.env.SHELL || '/bin/bash'}`
      } catch (error) {
        printError("Failed to remove worktree")
        process.exit(1)
      }
    } else {
      printInfo(`Worktree kept. You can remove it later with: ${colors.BOLD}baag stop ${printBranch(currentBranch)}${colors.NC}`)
    }
    return
  }

  // GitHub CLI is required for PR creation
  try {
    await $`which gh`
  } catch {
    printError("GitHub CLI (gh) is not installed")
    console.log(`${colors.DIM}Please install it from: https://cli.github.com/${colors.NC}`)
    console.log(`${colors.DIM}Or use --no-pr flag to skip PR creation${colors.NC}`)
    process.exit(1)
  }

  printInfo("Creating pull request...")

  try {
    // Create PR using GitHub CLI
    if (prTitle) {
      await $`gh pr create --base ${baseBranch} --head ${currentBranch} --title ${prTitle} --body ""`
    } else {
      await $`gh pr create --base ${baseBranch} --head ${currentBranch} --fill`
    }

    printSuccess("Pull request created successfully!")

    const response = await question(`\n${colors.BOLD_YELLOW}Do you want to remove this worktree?${colors.NC} ${colors.DIM}(y/N)${colors.NC} `)

    if (response === 'y' || response === 'Y') {
      const mainRepo = await getMainRepoDir()
      const currentWorktree = process.cwd()
      const worktreeName = path.basename(currentWorktree)

      printHeader("Cleaning Up")

      // Clean up tmux session first
      await cleanupTmuxSession(currentBranch)

      console.log(`Changing to main repository: ${printPath(mainRepo)}`)
      process.chdir(mainRepo)

      console.log(`Removing worktree: ${printBranch(worktreeName)}`)
      
      try {
        await $`git worktree remove ${currentWorktree}`
        
        // Clean up stored base branch config
        try {
          await $`git config --unset worktree.${currentBranch}.base`
        } catch {}
        
        printSuccess("Worktree removed successfully!")
        printInfo("You are now in the main repository")
        // Start a new shell in the main repo
        await $`${process.env.SHELL || '/bin/bash'}`
      } catch (error) {
        printError("Failed to remove worktree")
        process.exit(1)
      }
    } else {
      printInfo(`Worktree kept. You can remove it later with: ${colors.BOLD}baag stop ${printBranch(currentBranch)}${colors.NC}`)
    }
  } catch (error) {
    printError("Failed to create pull request")
    process.exit(1)
  }
}

// Main logic
async function main() {
  await checkGitRepository()
  await checkGitStatus()

  const command = process.argv[2]
  
  switch (command) {
    case 'start':
      await startWorktree(process.argv[3])
      break
    case 'stop':
      await stopWorktree(process.argv[3])
      break
    case 'submit':
      await submitWorktree(process.argv.slice(3))
      break
    case 'list':
    case 'ls':
      await listWorktrees()
      break
    case 'version':
    case '--version':
    case '-v':
      showVersion()
      break
    default:
      usage()
  }
}

main().catch(error => {
  printError(`An error occurred: ${error.message}`)
  process.exit(1)
})