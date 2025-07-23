#!/usr/bin/env zx

import { $, path, fs, os } from 'zx'

$.verbose = false

// Color codes and formatting
const colors = {
  RED: '\x1b[0;31m',
  GREEN: '\x1b[0;32m',
  YELLOW: '\x1b[0;33m',
  BLUE: '\x1b[0;34m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  NC: '\x1b[0m' // No Color
}

// Print functions
function printSuccess(message) {
  console.log(`${colors.GREEN}✓${colors.NC} ${message}`)
}

function printError(message) {
  console.error(`${colors.RED}✗${colors.NC} ${message}`)
}

function printInfo(message) {
  console.log(`${colors.BLUE}ℹ${colors.NC} ${message}`)
}

function printWarning(message) {
  console.log(`${colors.YELLOW}⚠${colors.NC} ${message}`)
}

function printHeader(message) {
  console.log(`\n${colors.BOLD}${message}${colors.NC}`)
  console.log(`${colors.DIM}${'─'.repeat(message.length)}${colors.NC}`)
}

// Installation configuration
const INSTALL_DIR = path.join(os.homedir(), '.local', 'bin')
const SCRIPT_NAME = "baag"
const ALIAS_NAME = "wt"

// Dependency tracking
const MISSING_DEPS = []
const OPTIONAL_DEPS = []

async function checkDependency(cmd, required, installInfo) {
  try {
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

async function checkDependencies() {
  printHeader("Checking Dependencies")

  // Required dependencies
  await checkDependency("git", true, "Install from: https://git-scm.com/downloads")
  await checkDependency("node", true, "Install from: https://nodejs.org/")

  // Optional dependencies
  await checkDependency("tmux", false, "Install with: brew install tmux (macOS) or apt-get install tmux (Ubuntu)")
  await checkDependency("gh", false, "Install from: https://cli.github.com/ (enables PR creation)")
  await checkDependency("claude", false, "Install from: https://claude.ai/claude-cli (enables AI integration)")

  if (MISSING_DEPS.length > 0) {
    printHeader("Missing Required Dependencies")
    for (const dep of MISSING_DEPS) {
      const [cmd, info] = dep.split('|')
      console.log(`  ${colors.RED}${cmd}${colors.NC}: ${info}`)
    }
    console.log("\nPlease install the required dependencies and run this script again.")
    process.exit(1)
  }

  if (OPTIONAL_DEPS.length > 0) {
    printHeader("Optional Dependencies")
    console.log(`${colors.DIM}The following optional dependencies can enhance your workflow:${colors.NC}`)
    for (const dep of OPTIONAL_DEPS) {
      const [cmd, info] = dep.split('|')
      console.log(`  ${colors.YELLOW}${cmd}${colors.NC}: ${info}`)
    }
    console.log(`\n${colors.DIM}You can install these later to enable additional features.${colors.NC}`)
  }
}

async function setupInstallDirectory() {
  printHeader("Setting Up Installation Directory")

  if (!fs.existsSync(INSTALL_DIR)) {
    printInfo(`Creating directory: ${INSTALL_DIR}`)
    await $`mkdir -p ${INSTALL_DIR}`
  } else {
    printSuccess(`Directory exists: ${INSTALL_DIR}`)
  }

  // Check if install directory is in PATH
  const pathEnv = process.env.PATH || ""
  if (pathEnv.includes(INSTALL_DIR)) {
    printSuccess(`${INSTALL_DIR} is in your PATH`)
  } else {
    printWarning(`${INSTALL_DIR} is not in your PATH`)
    printInfo("Add the following to your shell configuration file (~/.bashrc, ~/.zshrc, etc.):")
    console.log(`${colors.DIM}export PATH="$PATH:${INSTALL_DIR}"${colors.NC}`)
  }
}

async function installScript() {
  printHeader("Installing Git Worktree Manager")

  const scriptDir = path.dirname(new URL(import.meta.url).pathname)
  const sourceScript = path.join(scriptDir, '..', 'bin', `${SCRIPT_NAME}.mjs`)
  const targetScript = path.join(INSTALL_DIR, SCRIPT_NAME)
  const targetAlias = path.join(INSTALL_DIR, ALIAS_NAME)

  if (!fs.existsSync(sourceScript)) {
    printError(`Source script not found: ${sourceScript}`)
    printInfo("Make sure you're running this script from the correct directory")
    process.exit(1)
  }

  // Copy main script
  printInfo(`Installing ${SCRIPT_NAME} to ${targetScript}`)
  await $`cp ${sourceScript} ${targetScript}`
  await $`chmod +x ${targetScript}`
  printSuccess("Main script installed")

  // Create alias
  printInfo(`Creating alias: ${ALIAS_NAME} -> ${SCRIPT_NAME}`)
  const aliasContent = `#!/bin/bash\n# Baag alias\nexec baag "$@"`
  await fs.writeFile(targetAlias, aliasContent)
  await $`chmod +x ${targetAlias}`
  printSuccess("Alias created")
}

async function verifyInstallation() {
  printHeader("Verifying Installation")

  const targetScript = path.join(INSTALL_DIR, SCRIPT_NAME)
  const targetAlias = path.join(INSTALL_DIR, ALIAS_NAME)

  try {
    await $`test -x ${targetScript}`
    printSuccess("Main script is executable")
  } catch {
    printError("Main script is not executable")
    return false
  }

  try {
    await $`test -x ${targetAlias}`
    printSuccess("Alias is executable")
  } catch {
    printError("Alias is not executable")
    return false
  }

  // Test version command (only if in PATH)
  try {
    await $`which ${SCRIPT_NAME}`
    printInfo("Testing installation...")
    try {
      await $`${SCRIPT_NAME} version`
      printSuccess("Installation test passed")
    } catch {
      printWarning("Installation test failed - you may need to restart your shell")
    }
  } catch {
    printWarning("Command not found in PATH - you may need to restart your shell")
  }

  return true
}

function showUsageInfo() {
  printHeader("Installation Complete")

  console.log("Baag has been installed successfully!\n")

  console.log(`${colors.BOLD}Usage:${colors.NC}`)
  console.log("  baag start <name>            # Create new worktree")
  console.log("  baag stop <name>             # Remove worktree")
  console.log("  baag list                    # List all worktrees")
  console.log("  baag submit                  # Create PR and cleanup")
  console.log("  baag version                 # Show version\n")

  console.log(`${colors.BOLD}Alias:${colors.NC}`)
  console.log("  wt <command>                 # Short alias for baag\n")

  console.log(`${colors.BOLD}Getting Started:${colors.NC}`)
  console.log("1. Navigate to any git repository")
  console.log(`2. Run: ${colors.BLUE}baag start feature-branch${colors.NC}`)
  console.log("3. Work on your feature")
  console.log(`4. Run: ${colors.BLUE}baag submit${colors.NC} to create a PR\n`)

  if (OPTIONAL_DEPS.length > 0) {
    console.log(`${colors.DIM}Install optional dependencies for enhanced features:${colors.NC}`)
    for (const dep of OPTIONAL_DEPS) {
      const [cmd, info] = dep.split('|')
      console.log(`  ${colors.YELLOW}${cmd}${colors.NC}: ${info}`)
    }
    console.log()
  }

  console.log(`For more information, run: ${colors.BLUE}baag --help${colors.NC}`)
}

// Main installation flow
async function main() {
  const command = process.argv[2] || 'install'

  switch (command) {
    case 'install':
      printHeader("Baag Installation")
      console.log(`${colors.DIM}Enhanced git worktree workflows with tmux integration${colors.NC}`)

      await checkDependencies()
      await setupInstallDirectory()
      await installScript()
      await verifyInstallation()
      showUsageInfo()
      break

    case 'check':
      await checkDependencies()
      break

    case '--help':
    case '-h':
      console.log("Baag Installation Script\n")
      console.log("Usage: install.mjs [command]\n")
      console.log("Commands:")
      console.log("  install (default)  Install baag")
      console.log("  check              Only check dependencies")
      console.log("  --help, -h         Show this help")
      break

    default:
      printError(`Unknown command: ${command}`)
      console.log("Run 'install.mjs --help' for usage information.")
      process.exit(1)
  }
}

main().catch(error => {
  printError(`Installation failed: ${error.message}`)
  process.exit(1)
})