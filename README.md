# 🌳 Baag

<img width="2613" height="2206" alt="screenshot_3x_postspark_2025-07-25_23-02-24" src="https://github.com/user-attachments/assets/eda82a65-bfad-4617-ad4b-00f5af31d68a" />

Baag is a simple terminal app that allows you to run Claude Code, Gemini or Codex in separate isoloated workspaces of the same project.

## Installation

### ⚡️ Quick Install (Recommended)

```bash
# Bootstrap install (gets baag command available)
curl -fsSL https://raw.githubusercontent.com/pranav7/baag/main/install.sh | bash

# Full setup (dependency checks and configuration)
baag setup
```

## 🚀 Usage

```bash
# Create a new worktree and branch
baag start feature-auth

# List all worktrees
baag list

# Submit your work (push + create PR)
baag submit

# Submit with custom PR title
baag submit --title "Add user authentication system"

# Remove a worktree
baag stop feature-auth

# Configure your preferences
baag config

# Show current configuration
baag config --show
```

### Submit/Finish Options

The `submit` command (also available as `finish`) pushes your changes and creates a pull request:

```bash
# Basic submit - creates PR with commit messages as title
baag submit

# Create PR with custom title
baag submit --title "Add user authentication system"

# Submit to specific target branch
baag submit --base-branch develop

# Submit with custom title and target branch
baag submit --title "Hotfix: Fix login bug" --base-branch main

# Push changes without creating PR
baag submit --no-pr

# Skip git hooks when pushing
baag submit --no-verify

# Combined example
baag submit --title "Feature: OAuth integration" --base-branch develop --no-verify
```

## ⚙️ Configuration

Baag allows you to configure your preferences for a personalized experience:

```bash
# Run interactive configuration
baag config
```

This will prompt you to configure:
- **Base Branch**: Default branch for new worktrees (e.g., `main`, `develop`)
- **AI Agent**: Your preferred AI assistant (`claude`, `copilot`, `openai`)
- **Code Editor**: Default editor to open (`cursor`, `code`)

```bash
# View current settings
baag config --show
```

Your preferences are stored in `.baag/config.json` and will be used automatically when creating new worktrees.

## 📁 Directory Structure

Baag creates multiple workspaces in a `.baag` directory within your git repository (make sure to add it to your `.gitignore`)

```
my-project/
├── .git/
├── .baag/
│   ├── feature-auth/      # Worktree for auth feature
│   └── bug-fix-login/     # Worktree for bug fix
├── src/
└── ...
```

### 🐢 Manual Install

```bash
# Clone the repository
git clone https://github.com/pranav7/baag.git
cd baag

# Run bootstrap installer
./install.sh

# Then run full setup
baag setup
```

### 🔄 Updating

```bash
# Update to latest version
baag setup
```

### 🩺 Health Check

```bash
# Check system dependencies and health
baag check    # or: baag doctor
```

## Dependencies

- git + gh
- node
- tmux (enables multi-pane development environment)
- claude / codex / gemini
