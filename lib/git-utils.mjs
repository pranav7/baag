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
    return result.stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// Get the main branch name (main, master, etc.)
export async function getMainBranch() {
  try {
    // First try to get the default branch from remote
    try {
      const result = await $`git symbolic-ref refs/remotes/origin/HEAD`
      const defaultBranch = result.stdout.trim().replace('refs/remotes/origin/', '')
      if (defaultBranch) {
        return defaultBranch
      }
    } catch {
      // If that fails, check common main branch names
    }

    // Check if common main branches exist
    const commonMainBranches = ['main', 'master', 'develop']
    for (const branch of commonMainBranches) {
      try {
        await $`git show-ref --verify --quiet refs/heads/${branch}`
        return branch
      } catch {
        // Branch doesn't exist, try next
      }
    }

    // If no common main branch found, return the first branch
    const branches = await getAvailableBranches()
    return branches.length > 0 ? branches[0] : 'main'
  } catch {
    return 'main'
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
    // Find the .baag/worktrees directory by going up from current path
    let currentPath = process.cwd()
    while (currentPath !== path.dirname(currentPath)) {
      const baseName = path.basename(currentPath)
      const parentBaseName = path.basename(path.dirname(currentPath))

      if (baseName === 'worktrees' && parentBaseName === '.baag') {
        return currentPath
      }
      if (baseName === '.baag') {
        return path.join(currentPath, 'worktrees')
      }
      currentPath = path.dirname(currentPath)
    }

    // Fallback: check if parent is worktrees/.baag
    const parentDir = path.dirname(process.cwd())
    const grandParentDir = path.dirname(parentDir)
    if (path.basename(parentDir) === 'worktrees' && path.basename(grandParentDir) === '.baag') {
      return parentDir
    }
  }

  return path.join(mainRepo, '.baag', 'worktrees')
}

export function isInWorktree() {
  const currentPath = process.cwd()
  return currentPath.includes('/.baag/worktrees/')
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