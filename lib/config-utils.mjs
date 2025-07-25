#!/usr/bin/env node

import { $ } from 'zx'
import path from 'path'
import fs from 'fs/promises'
import * as p from '@clack/prompts'
import { colors, printSuccess, printError, printInfo } from './colors.mjs'

// Configuration file path
const CONFIG_DIR = '.baag'
const CONFIG_FILE = 'config.json'

// Default configuration
const DEFAULT_CONFIG = {
  baseBranch: 'main',
  aiAgent: null,
  codeEditor: null
}

/**
 * Get the configuration directory path
 */
async function getConfigDir() {
  // Find the git root directory
  try {
    const gitRoot = (await $`git rev-parse --show-toplevel`).stdout.trim()
    return path.join(gitRoot, CONFIG_DIR)
  } catch (error) {
    printError('Not in a git repository')
    process.exit(1)
  }
}

/**
 * Get the configuration file path
 */
async function getConfigPath() {
  const configDir = await getConfigDir()
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
async function loadConfig() {
  const configPath = await getConfigPath()

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
  try {
    await $`which ${command}`
    return true
  } catch {
    return false
  }
}

/**
 * Detect available AI agents
 */
async function detectAIAgents() {
  const agents = [
    { name: 'Claude', command: 'claude', value: 'claude' },
    { name: 'GitHub Copilot CLI', command: 'gh', value: 'copilot' },
    { name: 'OpenAI CLI', command: 'openai', value: 'openai' }
  ]

  const available = []

  for (const agent of agents) {
    if (await isCommandAvailable(agent.command)) {
      available.push(agent)
    }
  }

  return available
}

/**
 * Detect available code editors
 */
async function detectCodeEditors() {
  const editors = [
    { name: 'Cursor', command: 'cursor', value: 'cursor' },
    { name: 'Visual Studio Code', command: 'code', value: 'code' }
  ]

  const available = []

  for (const editor of editors) {
    if (await isCommandAvailable(editor.command)) {
      available.push(editor)
    }
  }

  return available
}

/**
 * Run interactive configuration setup
 */
async function runConfigWizard() {
  console.clear()

  p.intro(colors.bgBlue(colors.white(' baag configuration ')))

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
    const availableAI = await detectAIAgents()

    let aiAgent = null
    if (availableAI.length > 0) {
      const aiOptions = [
        { label: 'None', value: null },
        ...availableAI.map(agent => ({ label: agent.name, value: agent.value }))
      ]

      aiAgent = await p.select({
        message: 'Which AI agent would you like to use by default?',
        options: aiOptions,
        initialValue: config.aiAgent
      })

      if (p.isCancel(aiAgent)) {
        p.cancel('Configuration cancelled')
        process.exit(0)
      }
    } else {
      printInfo('No AI agents detected. Install claude, gh copilot, or openai CLI for AI integration.')
    }

    // Code editor configuration
    printInfo('Detecting available code editors...')
    const availableEditors = await detectCodeEditors()

    let codeEditor = null
    if (availableEditors.length > 0) {
      const editorOptions = [
        { label: 'None', value: null },
        ...availableEditors.map(editor => ({ label: editor.name, value: editor.value }))
      ]

      codeEditor = await p.select({
        message: 'Which code editor would you like to open by default?',
        options: editorOptions,
        initialValue: config.codeEditor
      })

      if (p.isCancel(codeEditor)) {
        p.cancel('Configuration cancelled')
        process.exit(0)
      }
    } else {
      printInfo('No supported code editors detected. Install cursor or code (VS Code) for editor integration.')
    }

    // Save configuration
    const newConfig = {
      baseBranch: baseBranch.trim(),
      aiAgent,
      codeEditor
    }

    await saveConfig(newConfig)

    // Show summary
    p.outro(colors.green('Configuration completed!'))
    console.log()
    console.log(colors.bold('Current settings:'))
    console.log(`  Base branch: ${colors.cyan(newConfig.baseBranch)}`)
    console.log(`  AI agent: ${colors.cyan(newConfig.aiAgent || 'None')}`)
    console.log(`  Code editor: ${colors.cyan(newConfig.codeEditor || 'None')}`)
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
 * Open the configured code editor in the given directory
 */
async function openCodeEditor(directory) {
  const editor = await getCodeEditor()

  if (!editor) {
    printInfo('No code editor configured. Run "baag config" to set one up.')
    return false
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
  openCodeEditor,
  isCommandAvailable,
  detectAIAgents,
  detectCodeEditors
}