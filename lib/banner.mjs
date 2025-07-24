#!/usr/bin/env node

import chalk from 'chalk'

export function showBanner() {
  console.log()
  console.log(`       ${chalk.bold.yellow('██████╗  █████╗  █████╗  ██████╗')}`)
  console.log(`       ${chalk.bold.yellow('██╔══██╗██╔══██╗██╔══██╗██╔════╝')}`)
  console.log(`       ${chalk.bold.yellow('██████╔╝███████║███████║██║  ███╗')}`)
  console.log(`       ${chalk.bold.yellow('██╔══██╗██╔══██║██╔══██║██║   ██║')}`)
  console.log(`       ${chalk.bold.yellow('██████╔╝██║  ██║██║  ██║╚██████╔╝')}`)
  console.log(`       ${chalk.bold.yellow('╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝')}`)
  console.log()
  console.log(`         ${chalk.bold.white('AI Terminal Agent Automation')}`)
  console.log()
}

export function showVersion() {
  showBanner()
  console.log(`Version: ${chalk.bold.green('0.0.1')}`)
  console.log(`Author: ${chalk.bold.cyan('https://github.com/your-username/baag')}`)
  console.log(`License: ${chalk.bold.yellow('MIT')}`)
  process.exit(0)
} 