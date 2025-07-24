# 🌳 Baag

<img width="3089" height="2215" src="https://github.com/user-attachments/assets/32419973-cf22-4fb8-8734-703c6dda7c23" />

Baag is a simple terminal app that allows you to run Claude Code, Gemini or Codex in a separate isoloated workspaces of the same project.

## 🚀 Usage

```bash
# Create a new worktree and branch
baag start feature-auth

# List all worktrees
baag list

# Submit your work (push + create PR)
baag submit

# Remove a worktree
baag stop feature-auth
```

### Advanced Options

```bash
# Create PR with custom title
baag submit --title "Add user authentication"

# Specify target branch
baag submit --base-branch develop

# Push without creating PR
baag submit --no-pr
```

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

## Installation

### ⚡️ Quick Install (Recommended)

```bash
# Bootstrap install (gets baag command available)
curl -fsSL https://raw.githubusercontent.com/pranav7/baag/main/install.sh | bash

# Full setup (dependency checks and configuration)
baag setup
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

**Required:**
- git
- node

**Optional (enhances features):**
- tmux (enables multi-pane development environment)
- gh (enables PR creation)
- claude (enables AI integration)
