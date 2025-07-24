#!/usr/bin/env node

import { $, path } from 'zx'
import { printError } from './colors.mjs'

// Git repository checks
export async function checkGitRepository() {
  try {
    await $`git rev-parse --git-dir`
    return true
  } catch {
    printError('Not a git repository (or any of the parent directories)')
    return false
  }
}

export async function checkGitStatus() {
  try {
    const result = await $`git status --porcelain`
    if (result.stdout.trim()) {
      printError('Working directory has uncommitted changes')
      printError('Please commit or stash your changes before creating a worktree')
      return false
    }
    return true
  } catch {
    printError('Failed to check git status')
    return false
  }
}

// Branch operations
export async function getCurrentBranch() {
  try {
    const result = await $`git branch --show-current`
    return result.stdout.trim()
  } catch {
    return null
  }
}

export async function branchExists(branchName) {
  try {
    await $`git show-ref --verify --quiet refs/heads/${branchName}`
    return true
  } catch {
    return false
  }
}

export async function getAvailableBranches() {
  try {
    const result = await $`git branch --format='%(refname:short)'`
    return result.stdout.trim().split('\n').filter(Boolean).join(', ')
  } catch {
    return 'Unable to list branches'
  }
}

// Worktree operations
export async function getMainRepoDir() {
  try {
    const result = await $`git rev-parse --show-toplevel`
    return result.stdout.trim()
  } catch {
    return null
  }
}

export function getWorktreesDir() {
  const mainRepo = process.cwd()

  // Check if we're already in a worktree
  if (isInWorktree()) {
    // Find the worktrees directory by going up from current path
    let currentPath = process.cwd()
    while (currentPath !== path.dirname(currentPath)) {
      if (path.basename(currentPath) === 'worktrees') {
        return currentPath
      }
      currentPath = path.dirname(currentPath)
    }

    // Fallback: assume we're in a subdirectory of worktrees
    const parentDir = path.dirname(process.cwd())
    if (path.basename(parentDir) === 'worktrees') {
      return parentDir
    }
  }

  return path.join(mainRepo, 'worktrees')
}

export function isInWorktree() {
  const currentPath = process.cwd()
  return currentPath.includes('/worktrees/')
}

export async function worktreeExists(name) {
  try {
    const worktreesDir = getWorktreesDir()
    const result = await $`git worktree list`
    return result.stdout.includes(`${worktreesDir}/${name}`)
  } catch {
    return false
  }
}

// Git config operations
export async function getStoredBaseBranch(branchName) {
  try {
    const result = await $`git config --get worktree.${branchName}.base`
    return result.stdout.trim()
  } catch {
    return null
  }
}

export async function setWorktreeConfig(name, key, value) {
  try {
    await $`git config worktree.${name}.${key} ${value}`
    return true
  } catch {
    return false
  }
}

export async function getWorktreeConfig(name, key) {
  try {
    const result = await $`git config --get worktree.${name}.${key}`
    return result.stdout.trim()
  } catch {
    return null
  }
}

export async function unsetWorktreeConfig(name, key) {
  try {
    await $`git config --unset worktree.${name}.${key}`
    return true
  } catch {
    return false
  }
}

// Push operations
export async function pushBranch(branchName, noVerify = false) {
  try {
    if (noVerify) {
      await $`git push -u origin ${branchName} --no-verify`
    } else {
      await $`git push -u origin ${branchName}`
    }
    return true
  } catch {
    return false
  }
}