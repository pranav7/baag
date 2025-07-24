#!/usr/bin/env node

import chalk from 'chalk'
import boxen from 'boxen'
import figures from 'figures'

// Color utilities using chalk - with proper function calls
export const colors = {
  red: (text) => chalk.red(text),
  green: (text) => chalk.green(text),
  yellow: (text) => chalk.yellow(text),
  blue: (text) => chalk.blue(text),
  magenta: (text) => chalk.magenta(text),
  cyan: (text) => chalk.cyan(text),
  white: (text) => chalk.white(text),
  gray: (text) => chalk.gray(text),
  dim: (text) => chalk.dim(text),
  bold: (text) => chalk.bold(text),
  boldRed: (text) => chalk.bold.red(text),
  boldGreen: (text) => chalk.bold.green(text),
  boldYellow: (text) => chalk.bold.yellow(text),
  boldBlue: (text) => chalk.bold.blue(text),
  boldMagenta: (text) => chalk.bold.magenta(text),
  boldCyan: (text) => chalk.bold.cyan(text),
  boldWhite: (text) => chalk.bold.white(text),
}

// Print utilities
export function printSuccess(message) {
  console.log(`${chalk.green(figures.tick)} ${message}`)
}

export function printError(message) {
  console.log(`${chalk.red(figures.cross)} ${message}`)
}

export function printWarning(message) {
  console.log(`${chalk.yellow(figures.warning)} ${message}`)
}

export function printInfo(message) {
  console.log(`${chalk.blue(figures.info)} ${message}`)
}

export function printHeader(title) {
  console.log(boxen(title, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 0 },
    borderStyle: 'round',
    borderColor: 'blue'
  }))
}

// Path and git element formatters
export function formatPath(path) {
  return chalk.cyan(path)
}

export function formatBranch(branch) {
  return chalk.green(branch)
}

export function formatHash(hash) {
  return chalk.yellow(hash)
}

export function formatCommand(command) {
  return chalk.blue(command)
} 