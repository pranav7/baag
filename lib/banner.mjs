#!/usr/bin/env node

import chalk from 'chalk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getVersion() {
  try {
    const packagePath = join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
    return packageJson.version
  } catch {
    return 'unknown'
  }
}

export function showBanner() {
  console.log()
  console.log(`       ${chalk.bold.yellow('██████╗  █████╗  █████╗  ██████╗')}`)
  console.log(`       ${chalk.bold.yellow('██╔══██╗██╔══██╗██╔══██╗██╔════╝')}`)
  console.log(`       ${chalk.bold.yellow('██████╔╝███████║███████║██║  ███╗')}`)
  console.log(`       ${chalk.bold.yellow('██╔══██╗██╔══██║██╔══██║██║   ██║')}`)
  console.log(`       ${chalk.bold.yellow('██████╔╝██║  ██║██║  ██║╚██████╔╝')}`)
  console.log(`       ${chalk.bold.yellow('╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝')}`)
  console.log()
  console.log(`       ${chalk.bold.white('AI Terminal Agent Automation')}`)
  console.log()
}

export function showVersion() {
  showBanner()

  console.log(`Version: ${chalk.bold.green(getVersion())}`)
  console.log(`Author:  ${chalk.bold.cyan('https://github.com/pranav7/baag')}`)
  process.exit(0)
}