#!/usr/bin/env node

import { $ } from 'zx'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import * as p from '@clack/prompts'
import { colors, printSuccess, printError, printInfo } from './colors.mjs'

// Configuration file path
const CONFIG_DIR = '.baag'
const CONFIG_FILE = 'config.json'

// Default configuration
const DEFAULT_CONFIG = {
  baseBranch: 'main',
  aiAgent: null,
  codeEditor: null,
  branchPrefix: null,
  serverCommand: null,
  sessionHooks: {
    onStart: [],
    onStop: []
  },
  portRange: {
    start: 3000,
    end: 4000
  }
}

/**
 * Get the configuration directory path
 */
async function getConfigDir(repoPath = null) {
  // Find the git root directory
  try {
    let gitRoot
    if (repoPath) {
      // Use provided repository path
      gitRoot = (await $`cd ${repoPath} && git rev-parse --show-toplevel`).stdout.trim()
    } else {
      // Use current directory
      gitRoot = (await $`git rev-parse --show-toplevel`).stdout.trim()
    }
    return path.join(gitRoot, CONFIG_DIR)
  } catch (error) {
    printError('Not in a git repository')
    process.exit(1)
  }
}

/**
 * Get the configuration file path
 */
async function getConfigPath(repoPath = null) {
  const configDir = await getConfigDir(repoPath)
  return path.join(configDir, CONFIG_FILE)
}

/**
 * Ensure the configuration directory exists
 */
async function ensureConfigDir() {
  const configDir = await getConfigDir()
  try {
    await fs.mkdir(configDir, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      printError(`Failed to create config directory: ${error.message}`)
      process.exit(1)
    }
  }
}

/**
 * Load configuration from file
 */
async function loadConfig(repoPath = null) {
  const configPath = await getConfigPath(repoPath)

  try {
    const configData = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(configData)
    return { ...DEFAULT_CONFIG, ...config }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Config file doesn't exist, return default config
      return DEFAULT_CONFIG
    } else {
      printError(`Failed to load configuration: ${error.message}`)
      return DEFAULT_CONFIG
    }
  }
}

/**
 * Save configuration to file
 */
async function saveConfig(config) {
  await ensureConfigDir()
  const configPath = await getConfigPath()

  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    printSuccess(`Configuration saved to ${configPath}`)
  } catch (error) {
    printError(`Failed to save configuration: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Check if a command is available in the system
 */
async function isCommandAvailable(command) {
  // Enhanced detection for claude (similar to install-utils.mjs)
  if (command === 'claude') {
    // Try direct path first
    const claudePath = path.join(os.homedir(), '.claude', 'local', 'claude')
    try {
      await fs.access(claudePath)
      return true
    } catch {
      // File doesn't exist, continue with other checks
    }
  }

  try {
    await $`which ${command}`
    return true
  } catch {
    try {
      // Try command -v as alternative (works better with aliases)
      await $`command -v ${command}`
      return true
    } catch {
      return false
    }
  }
}

/**
 * Detect available AI agents
 */
async function detectAIAgents() {
  const agents = [
        {
      name: 'Claude Code',
      command: 'claude',
      value: 'claude',
      installUrl: 'https://github.com/anthropics/claude-code',
      description: 'Claude Code from Anthropic'
    },
    {
      name: 'Codex CLI',
      command: 'codex',
      value: 'codex',
      installUrl: 'https://github.com/openai/codex',
      description: 'OpenAI Codex CLI'
    },
    {
      name: 'Gemini CLI',
      command: 'gemini',
      value: 'gemini',
      installUrl: 'https://github.com/google-gemini/gemini-cli',
      description: 'Google Gemini CLI'
    }
  ]

  const result = []

  for (const agent of agents) {
    const isInstalled = await isCommandAvailable(agent.command)
    result.push({
      ...agent,
      installed: isInstalled,
      label: isInstalled ? agent.name : `${agent.name} (not installed)`,
      value: isInstalled ? agent.value : null
    })
  }

  return result
}

/**
 * Detect available code editors
 */
async function detectCodeEditors() {
  const editors = [
    {
      name: 'VS Code / Cursor',
      command: 'code',
      value: 'code',
      installUrl: 'https://code.visualstudio.com/',
      description: 'Visual Studio Code'
    },
    {
      name: 'Zed',
      command: 'zed',
      value: 'zed',
      installUrl: 'https://zed.dev/',
      description: 'The editor for what\'s next'
    }
  ]

  const result = []

  for (const editor of editors) {
    const isInstalled = await isCommandAvailable(editor.command)
    result.push({
      ...editor,
      installed: isInstalled,
      label: isInstalled ? editor.name : `${editor.name} (not installed)`,
      value: isInstalled ? editor.value : null
    })
  }

  return result
}

/**
 * Run interactive configuration setup
 */
async function runConfigWizard() {
  console.clear()

  p.intro(colors.blue(colors.bold(' baag configuration ')))

  const config = await loadConfig()

  try {
    // Base branch configuration
    const baseBranch = await p.text({
      message: 'What is your default base branch?',
      placeholder: 'main',
      defaultValue: config.baseBranch || 'main',
      validate: (value) => {
        if (!value.trim()) return 'Base branch cannot be empty'
      }
    })

    if (p.isCancel(baseBranch)) {
      p.cancel('Configuration cancelled')
      process.exit(0)
    }

        // AI agent configuration
    printInfo('Detecting available AI agents...')
    const allAI = await detectAIAgents()

    const aiOptions = [
      { label: 'None', value: null },
      ...allAI.map(agent => ({
        label: agent.label,
        value: agent.value,
        hint: agent.installed ? agent.description : `Install: ${agent.installUrl}`
      }))
    ]

    const aiAgent = await p.select({
      message: 'Which AI agent would you like to use by default?',
      options: aiOptions,
      initialValue: config.aiAgent
    })

    if (p.isCancel(aiAgent)) {
      p.cancel('Configuration cancelled')
      process.exit(0)
    }

    // Show installation info for non-installed agents
    if (aiAgent) {
      const selectedAgent = allAI.find(agent => agent.value === aiAgent)
      if (selectedAgent && !selectedAgent.installed) {
        console.log()
        printInfo(`To install ${selectedAgent.name}:`)
        console.log(`  ${colors.blue(selectedAgent.installUrl)}`)
        console.log()
      }
    }

        // Code editor configuration
    printInfo('Detecting available code editors...')
    const allEditors = await detectCodeEditors()

    const editorOptions = [
      { label: 'None', value: null },
      ...allEditors.map(editor => ({
        label: editor.label,
        value: editor.value,
        hint: editor.installed ? editor.description : `Install: ${editor.installUrl}`
      }))
    ]

    const codeEditor = await p.select({
      message: 'Which code editor would you like to open by default?',
      options: editorOptions,
      initialValue: config.codeEditor
    })

    if (p.isCancel(codeEditor)) {
      p.cancel('Configuration cancelled')
      process.exit(0)
    }

    // Show installation info for non-installed editors
    if (codeEditor) {
      const selectedEditor = allEditors.find(editor => editor.value === codeEditor)
      if (selectedEditor && !selectedEditor.installed) {
        console.log()
        printInfo(`To install ${selectedEditor.name}:`)
        console.log(`  ${colors.blue(selectedEditor.installUrl)}`)
        console.log()
      }
    }

    // Branch prefix configuration
    const branchPrefix = await p.text({
      message: 'Branch prefix (optional - will be prepended to all new branch names)',
      placeholder: 'e.g., your username (leave empty for no prefix)',
      defaultValue: config.branchPrefix || '',
      validate: (value) => {
        if (value.trim() && !/^[a-zA-Z0-9-_]+$/.test(value.trim())) {
          return 'Branch prefix can only contain letters, numbers, hyphens, and underscores'
        }
      }
    })

    if (p.isCancel(branchPrefix)) {
      p.cancel('Configuration cancelled')
      process.exit(0)
    }

    // Server command configuration
    const serverCommand = await p.text({
      message: 'Development server command (optional - use $BAAG_PORT for port)',
      placeholder: 'npm run dev -- --port $BAAG_PORT',
      defaultValue: config.serverCommand || '',
      hint: 'Examples: "rails server -p $BAAG_PORT", "PORT=$BAAG_PORT npm start"'
    })

    if (p.isCancel(serverCommand)) {
      p.cancel('Configuration cancelled')
      process.exit(0)
    }

    // Session hooks configuration
    let sessionHooks = { ...config.sessionHooks } || { onStart: [], onStop: [] }
    
    const configureHooks = await p.confirm({
      message: 'Configure session hooks? (commands to run when starting/stopping sessions)',
      initialValue: false
    })

    if (p.isCancel(configureHooks)) {
      p.cancel('Configuration cancelled')
      process.exit(0)
    }

    if (configureHooks) {
      // Start hooks
      const startHooksInput = await p.text({
        message: 'Start hooks (comma-separated commands to run when creating a session)',
        placeholder: 'npm install, npm run build',
        defaultValue: sessionHooks.onStart.join(', ')
      })

      if (p.isCancel(startHooksInput)) {
        p.cancel('Configuration cancelled')
        process.exit(0)
      }

      // Stop hooks
      const stopHooksInput = await p.text({
        message: 'Stop hooks (comma-separated commands to run when stopping a session)',
        placeholder: 'npm run cleanup',
        defaultValue: sessionHooks.onStop.join(', ')
      })

      if (p.isCancel(stopHooksInput)) {
        p.cancel('Configuration cancelled')
        process.exit(0)
      }

      // Process hooks
      sessionHooks = {
        onStart: startHooksInput.trim() ? startHooksInput.split(',').map(cmd => cmd.trim()).filter(Boolean) : [],
        onStop: stopHooksInput.trim() ? stopHooksInput.split(',').map(cmd => cmd.trim()).filter(Boolean) : []
      }
    }

    // Save configuration
    const newConfig = {
      baseBranch: baseBranch.trim(),
      aiAgent,
      codeEditor,
      branchPrefix: branchPrefix.trim() || null,
      serverCommand: serverCommand.trim() || null,
      sessionHooks,
      portRange: config.portRange || { start: 3000, end: 4000 }
    }

    await saveConfig(newConfig)

    // Show summary
    p.outro(colors.green('Configuration completed!'))
    console.log()
    console.log(colors.bold('Current settings:'))
    console.log(`  Base branch: ${colors.cyan(newConfig.baseBranch)}`)
    console.log(`  AI agent: ${colors.cyan(newConfig.aiAgent || 'None')}`)
    console.log(`  Code editor: ${colors.cyan(newConfig.codeEditor || 'None')}`)
    console.log(`  Branch prefix: ${colors.cyan(newConfig.branchPrefix || 'None')}`)
    console.log(`  Server command: ${colors.cyan(newConfig.serverCommand || 'None')}`)
    if (newConfig.sessionHooks.onStart.length > 0) {
      console.log(`  Start hooks: ${colors.cyan(newConfig.sessionHooks.onStart.length + ' commands')}`)
    }
    if (newConfig.sessionHooks.onStop.length > 0) {
      console.log(`  Stop hooks: ${colors.cyan(newConfig.sessionHooks.onStop.length + ' commands')}`)
    }
    console.log()
    console.log(colors.dim('You can change these settings anytime by running:'))
    console.log(colors.dim(`  ${colors.blue('baag config')}`))

  } catch (error) {
    if (error.message && error.message.includes('User force closed')) {
      p.cancel('Configuration cancelled')
      process.exit(0)
    } else {
      printError(`Configuration failed: ${error.message}`)
      process.exit(1)
    }
  }
}

/**
 * Display current configuration
 */
async function showConfig() {
  const config = await loadConfig()

  console.log(colors.bold('Current baag configuration:'))
  console.log()
  console.log(`  Base branch: ${colors.cyan(config.baseBranch)}`)
  console.log(`  AI agent: ${colors.cyan(config.aiAgent || 'Not configured')}`)
  console.log(`  Code editor: ${colors.cyan(config.codeEditor || 'Not configured')}`)
  console.log(`  Branch prefix: ${colors.cyan(config.branchPrefix || 'Not configured')}`)
  console.log(`  Server command: ${colors.cyan(config.serverCommand || 'Not configured')}`)
  
  const hooks = config.sessionHooks || { onStart: [], onStop: [] }
  if (hooks.onStart.length > 0 || hooks.onStop.length > 0) {
    console.log(`  Session hooks:`)
    if (hooks.onStart.length > 0) {
      console.log(`    Start: ${colors.cyan(hooks.onStart.join(', '))}`)
    }
    if (hooks.onStop.length > 0) {
      console.log(`    Stop: ${colors.cyan(hooks.onStop.join(', '))}`)
    }
  } else {
    console.log(`  Session hooks: ${colors.cyan('Not configured')}`)
  }
  
  console.log(`  Port range: ${colors.cyan(`${config.portRange?.start || 3000}-${config.portRange?.end || 4000}`)}`)
  console.log()
  console.log(colors.dim('Run ') + colors.blue('baag config') + colors.dim(' to update these settings'))
}

/**
 * Get the configured base branch
 */
async function getBaseBranch() {
  const config = await loadConfig()
  return config.baseBranch || 'main'
}

/**
 * Get the configured AI agent
 */
async function getAIAgent() {
  const config = await loadConfig()
  return config.aiAgent
}

/**
 * Get the configured code editor
 */
async function getCodeEditor() {
  const config = await loadConfig()
  return config.codeEditor
}

/**
 * Get the configured branch prefix
 */
async function getBranchPrefix() {
  const config = await loadConfig()
  return config.branchPrefix
}

/**
 * Get the configured server command
 */
async function getServerCommand(repoPath = null) {
  const config = await loadConfig(repoPath)
  return config.serverCommand
}

/**
 * Get the configured session hooks
 */
async function getSessionHooks(repoPath = null) {
  const config = await loadConfig(repoPath)
  return config.sessionHooks || { onStart: [], onStop: [] }
}

/**
 * Get the configured port range
 */
async function getPortRange() {
  const config = await loadConfig()
  return config.portRange || { start: 3000, end: 4000 }
}

/**
 * Open the configured code editor in the given directory
 */
async function openCodeEditor(directory) {
  const editor = await getCodeEditor()

  if (!editor) {
    printInfo('No code editor configured. Run "baag config" to set one up.')
    return false
  }

  // Skip TTY-based editors when not in a proper terminal
  const ttyEditors = ['vim', 'nvim', 'vi', 'nano', 'emacs']
  if (ttyEditors.includes(editor)) {
    if (process.stdout.isTTY !== true || process.stdin.isTTY !== true) {
      printInfo(`Skipping ${editor} launch - not in an interactive terminal`)
      printInfo(`Open ${editor} manually in the tmux session`)
      return false
    }
  }

  try {
    await $`${editor} ${directory}`
    return true
  } catch (error) {
    printError(`Failed to open ${editor}: ${error.message}`)
    return false
  }
}

export {
  loadConfig,
  saveConfig,
  runConfigWizard,
  showConfig,
  getBaseBranch,
  getAIAgent,
  getCodeEditor,
  getBranchPrefix,
  getServerCommand,
  getSessionHooks,
  getPortRange,
  openCodeEditor,
  isCommandAvailable,
  detectAIAgents,
  detectCodeEditors
}