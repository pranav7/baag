# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Common Development Tasks
- **Start development**: `npm start` (runs `zx bin/baag`)
- **Testing**: `make test` (basic functionality tests)
- **Linting**: `make lint` (uses shellcheck if available)
- **Formatting**: `make format` (uses shfmt if available)
- **Installation**: `make install` or `./install.sh`
- **Dependency check**: `make check` or `baag check`

### Release Commands
- **Create release**: `npm run release` or `./scripts/release.sh`
- **Version bump**: `npm run release:patch|minor|major`

### Development Setup
- **Dev install**: `make dev-install` (creates symlinks for local development)
- **Dev setup**: `make dev-setup` (makes scripts executable)

## Architecture Overview

Baag is a CLI tool for managing git worktrees with tmux and AI integration, built with Node.js and the ZX library.

### Core Components

**Main Entry Point**
- `bin/baag` - Main CLI script using ZX, handles command parsing and routing

**Library Modules** (in `lib/`)
- `worktree-utils.mjs` - Git worktree operations (start, stop, submit, list, cleanup)
- `tmux-utils.mjs` - Tmux session management and Claude integration  
- `git-utils.mjs` - Git repository operations and branch management
- `install-utils.mjs` - Installation, setup, and dependency checking
- `colors.mjs` - Terminal output formatting and styling
- `banner.mjs` - Version display and branding

### Key Workflows

**Worktree Management**
- Creates isolated workspaces in `.baag/` directory
- Manages git branches and worktrees simultaneously
- Integrates with tmux for multi-pane development
- Handles PR creation via GitHub CLI

**Installation System**
- Bootstrap installer (`install.sh`) for initial setup
- Full setup via `baag setup` command with dependency verification
- Homebrew formula support (`Formula/baag.rb`)

### Technology Stack
- **Runtime**: Node.js with ZX for shell scripting
- **Dependencies**: chalk, boxen, figures for terminal UI
- **Integration**: tmux, GitHub CLI, Claude CLI (optional)
- **Package Management**: npm with lockfile

### Directory Structure
- `bin/` - Executable CLI entry point
- `lib/` - Core functionality modules  
- `scripts/` - Build and release automation
- `Formula/` - Homebrew installation formula
- `.baag/` - Created in user projects for worktree storage

## Important Notes

- The codebase uses ES modules exclusively (`type: "module"`)
- ZX provides shell command execution with `$` template literals
- All scripts check for git repository and clean working directory
- Optional dependencies (tmux, gh, claude) enhance but don't break core functionality
- Configuration stored in git config for worktree base branch tracking