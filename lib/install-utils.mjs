#!/usr/bin/env node

import { $, path, fs, os } from 'zx'
import { printHeader, printInfo, printSuccess, printError, printWarning, colors } from './colors.mjs'
import chalk from 'chalk'
import boxen from 'boxen'
import figures from 'figures'

$.verbose = false

// Installation configuration
const INSTALL_DIR = path.join(os.homedir(), '.local', 'bin')
const LIB_DIR = path.join(os.homedir(), '.local', 'lib', 'baag')
const SCRIPT_NAME = "baag"

// Dependency tracking
const MISSING_DEPS = []
const OPTIONAL_DEPS = []

async function checkDependency(cmd, required, installInfo) {
  try {
    // Enhanced claude detection
    if (cmd === 'claude') {
      const claudeAvailable = await checkClaudeEnhanced()
      if (claudeAvailable) {
        printSuccess(`${cmd} is available`)
        return true
      } else {
        throw new Error('Claude not found')
      }
    }

    // Standard check for other commands
    await $`which ${cmd}`
    printSuccess(`${cmd} is available`)
    return true
  } catch {
    if (required) {
      printError(`${cmd} is not installed (required)`)
      MISSING_DEPS.push(`${cmd}|${installInfo}`)
    } else {
      printWarning(`${cmd} is not installed (optional - enables enhanced features)`)
      OPTIONAL_DEPS.push(`${cmd}|${installInfo}`)
    }
    return false
  }
}

// Enhanced claude detection (similar to tmux-utils.mjs)
async function checkClaudeEnhanced() {
  // Try direct path first
  const claudePath = path.join(os.homedir(), '.claude', 'local', 'claude')
  if (await fs.pathExists(claudePath)) {
    return true
  }

  // Try standard command detection
  try {
    await $`which claude`
    return true
  } catch {
    // Try command -v as alternative
    try {
      await $`command -v claude`
      return true
    } catch {
      return false
    }
  }
}

export async function checkDependencies() {
  printHeader('Checking Dependencies')

  // Required dependencies
  await checkDependency('git', true, 'Install from: https://git-scm.com/')
  await checkDependency('node', true, 'Install from: https://nodejs.org/')
  // Don't check for zx globally since it's bundled with baag

  // Optional dependencies that enhance the experience
  await checkDependency('tmux', false, 'Install with: brew install tmux (enables multi-pane development)')
  await checkDependency('gh', false, 'Install with: brew install gh (enables PR creation)')
  await checkDependency('claude', false, 'Install from: https://claude.ai/claude-cli (enables AI integration)')

  if (MISSING_DEPS.length > 0) {
    printHeader('Missing Required Dependencies')
    console.log(chalk.red('The following required dependencies are missing:\n'))

    for (const dep of MISSING_DEPS) {
      const [cmd, info] = dep.split('|')
      console.log(`  ${chalk.bold.red(cmd)}: ${info}`)
    }

    console.log(chalk.yellow('\nPlease install the missing dependencies and try again.'))
    return false
  }

  if (OPTIONAL_DEPS.length > 0) {
    printHeader('Optional Dependencies')
    console.log('The following optional dependencies can enhance your workflow:\n')

    for (const dep of OPTIONAL_DEPS) {
      const [cmd, info] = dep.split('|')
      console.log(`  ${chalk.yellow(cmd)}: ${info}`)
    }

    console.log('\nYou can install these later to enable additional features.')
  }

  return true
}

async function setupInstallDirectory() {
  printHeader('Setting Up Installation Directory')

  // Ensure directories exist
  await fs.ensureDir(INSTALL_DIR)
  printSuccess(`Directory exists: ${INSTALL_DIR}`)

  await fs.ensureDir(LIB_DIR)
  printSuccess(`Library directory exists: ${LIB_DIR}`)

  // Check if install dir is in PATH
  const pathEnv = process.env.PATH || ''
  if (pathEnv.includes(INSTALL_DIR)) {
    printSuccess(`${INSTALL_DIR} is in your PATH`)
  } else {
    printWarning(`${INSTALL_DIR} is not in your PATH`)
    console.log(chalk.dim(`Add this to your shell config (~/.zshrc or ~/.bashrc):`))
    console.log(chalk.blue(`export PATH="${INSTALL_DIR}:$PATH"`))
  }
}

// Check if we're running from the source directory (development mode)
async function isInSourceDirectory() {
  const libDir = path.join(process.cwd(), 'lib')
  const binScript = path.join(process.cwd(), 'bin', 'baag')
  return await fs.pathExists(libDir) && await fs.pathExists(binScript)
}

async function installScript() {
  printHeader('Installing Baag')

  const inSourceMode = await isInSourceDirectory()

  if (!inSourceMode) {
    // Already installed via bootstrap - just verify and update dependencies
    printInfo('Baag is already installed via bootstrap installer')

    // Check if files exist in target locations
    const mainScriptTarget = path.join(LIB_DIR, 'baag.mjs')
    const wrapperTarget = path.join(INSTALL_DIR, SCRIPT_NAME)

    if (await fs.pathExists(mainScriptTarget) && await fs.pathExists(wrapperTarget)) {
      printSuccess('Installation files verified')
    } else {
      printError('Installation appears corrupted. Please run the bootstrap installer again:')
      console.log('curl -fsSL https://raw.githubusercontent.com/pranav7/baag/main/install.sh | bash')
      process.exit(1)
    }
  } else {
    // Development mode - copy files from source directory
    printInfo('Running in development mode - copying source files')

    // Copy library modules
    printInfo(`Installing library modules to ${LIB_DIR}`)
    const libFiles = ['banner.mjs', 'colors.mjs', 'git-utils.mjs', 'tmux-utils.mjs', 'worktree-utils.mjs', 'install-utils.mjs', 'config-utils.mjs']

    for (const file of libFiles) {
      const sourcePath = path.join(process.cwd(), 'lib', file)
      const targetPath = path.join(LIB_DIR, file)

      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, targetPath)
        printInfo(`  Copied ${file}`)
      }
    }
    printSuccess('Library modules installed')

    // Create wrapper script
    printInfo(`Installing baag to ${path.join(INSTALL_DIR, SCRIPT_NAME)}`)

    const wrapperScript = `#!/bin/bash
# Baag wrapper script - preserves working directory
LIB_DIR="${LIB_DIR}"
export NODE_PATH="$LIB_DIR/node_modules:$NODE_PATH"

# Use locally installed zx to run baag
if [ -f "$LIB_DIR/node_modules/.bin/zx" ]; then
    exec "$LIB_DIR/node_modules/.bin/zx" "$LIB_DIR/baag.mjs" "$@"
else
    # Fallback to node if zx not found
    exec node "$LIB_DIR/baag.mjs" "$@"
fi
`

    // Copy the main script to lib directory
    const mainScriptSource = path.join(process.cwd(), 'bin', 'baag')
    const mainScriptTarget = path.join(LIB_DIR, 'baag.mjs')
    await fs.copy(mainScriptSource, mainScriptTarget)

    // Create wrapper in bin directory
    const wrapperTarget = path.join(INSTALL_DIR, SCRIPT_NAME)
    await fs.writeFile(wrapperTarget, wrapperScript)
    await fs.chmod(wrapperTarget, 0o755)
    printSuccess('Main script and wrapper installed')
  }

  // Install dependencies (check if node_modules exists first)
  const nodeModulesPath = path.join(LIB_DIR, 'node_modules')
  const packageJsonPath = path.join(LIB_DIR, 'package.json')

  if (!await fs.pathExists(nodeModulesPath) || !await fs.pathExists(packageJsonPath)) {
    printInfo('Creating package.json for dependencies...')
    const packageJson = {
      name: 'baag',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        'zx': '^8.0.0',
        'chalk': '^5.3.0',
        'boxen': '^7.1.1',
        'figures': '^6.1.0',
        '@clack/prompts': '^0.7.0'
      }
    }

    await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 })

    printInfo('Installing Node.js dependencies...')
    const originalCwd = process.cwd()

    try {
      process.chdir(LIB_DIR)
      // Use --ignore-scripts to prevent any postinstall scripts from interfering with current directory
      await $`npm install --silent --ignore-scripts`
      printSuccess('Dependencies installed')
    } catch (error) {
      printError(`Failed to install dependencies: ${error.message}`)
      throw error
    } finally {
      process.chdir(originalCwd)
    }
  } else {
    printSuccess('Dependencies already installed')
  }
}

async function verifyInstallation() {
  printHeader('Verifying Installation')

  const installedScript = path.join(INSTALL_DIR, SCRIPT_NAME)

  // Check if script exists and is executable
  if (await fs.pathExists(installedScript)) {
    printSuccess('Main script is executable')
  } else {
    throw new Error('Main script was not installed correctly')
  }

  // Test installation by checking if the wrapper script is executable and has the right shebang
  printInfo('Testing installation...')
  try {
    const scriptContent = await fs.readFile(installedScript, 'utf8')
    if (scriptContent.startsWith('#!/bin/bash')) {
      printSuccess('Installation test passed')
    } else {
      throw new Error('Wrapper script does not have correct shebang')
    }
  } catch (error) {
    throw new Error(`Installation test failed: ${error.message}`)
  }
}

async function setupProjectFiles() {
  printHeader('Setting Up Project Integration')

  // Only set up .baag integration if we're in a git repository
  try {
    await $`git rev-parse --git-dir`
    printInfo('Git repository detected - setting up .baag integration')

    const baagDir = path.join(process.cwd(), '.baag')

    // Create .baag directory if it doesn't exist
    if (!(await fs.pathExists(baagDir))) {
      await fs.ensureDir(baagDir)
      printSuccess('.baag directory created')
    } else {
      printInfo('.baag directory already exists')
    }

    // Add .baag to .gitignore if not already there
    const gitignorePath = path.join(process.cwd(), '.gitignore')

    if (await fs.pathExists(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8')
      if (!gitignoreContent.includes('.baag')) {
        await fs.appendFile(gitignorePath, '\n.baag\n')
        printSuccess('.baag added to .gitignore')
      } else {
        printInfo('.baag already in .gitignore')
      }
    } else {
      await fs.writeFile(gitignorePath, '.baag\n')
      printSuccess('.gitignore created with .baag')
    }
  } catch {
    printInfo('Not in a git repository - skipping .baag setup')
  }
}

function showUsageInfo() {
  printHeader('Installation Complete')

  const mainContent = [
    chalk.green(figures.tick) + ' Baag has been installed successfully!',
    '',
    chalk.bold('Usage:'),
    '  baag start <n>     # Create new worktree',
    '  baag stop [name]      # Remove worktree',
    '  baag list            # List all worktrees',
    '  baag submit|finish   # Create PR and cleanup',
    '  baag cleanup         # Clean up orphaned files',
    '  baag check           # Check dependencies',
    '  baag version         # Show version',
    '',
    chalk.bold('Getting Started:'),
    '1. Navigate to any git repository',
    `2. Run: ${chalk.blue('baag start feature-branch')}`,
    '3. Work on your feature',
    `4. Run: ${chalk.blue('baag submit')} or ${chalk.blue('baag finish')} to create a PR`
  ]

  if (OPTIONAL_DEPS.length > 0) {
    mainContent.push('')
    mainContent.push(chalk.bold('Optional Dependencies:'))
    for (const dep of OPTIONAL_DEPS) {
      const [cmd, info] = dep.split('|')
      mainContent.push(`  ${chalk.yellow(cmd)}: ${info}`)
    }
  }

  mainContent.push('')
  mainContent.push(`For more information, run: ${chalk.blue('baag --help')}`)

  console.log(boxen(mainContent.join('\n'), {
    padding: 1,
    margin: { top: 0, bottom: 1 },
    borderStyle: 'double',
    borderColor: 'green'
  }))
}

export async function setupBaag() {
  printHeader('Baag — AI Terminal Agent Automation')
  console.log(chalk.dim('Enhanced git worktree workflows with tmux and AI integration'))

  // Reset dependency arrays for fresh check
  MISSING_DEPS.length = 0
  OPTIONAL_DEPS.length = 0

  if (!(await checkDependencies())) {
    process.exit(1)
  }

  await setupInstallDirectory()
  await installScript()
  await verifyInstallation()
  await setupProjectFiles()
  showUsageInfo()
}