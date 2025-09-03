# 🌳 Baag - AI Terminal Agent Automation

<img width="2613" height="2206" alt="screenshot_3x_postspark_2025-07-25_23-02-24" src="https://github.com/user-attachments/assets/eda82a65-bfad-4617-ad4b-00f5af31d68a" />

Baag is a powerful CLI tool that manages git worktrees with tmux integration, enabling you to run AI agents (Claude, Aider, etc.) in isolated workspaces. Perfect for managing multiple features, experiments, or bug fixes simultaneously without branch switching.

## Installation

### ⚡️ Quick Install (Recommended)

```bash
# One-line install with automatic setup
curl -fsSL https://raw.githubusercontent.com/pranav7/baag/main/install.sh | bash
```

After installation, in any git repository:

```bash
# Initialize baag in your project (first time only)
baag setup

# Configure your preferences (optional)
baag config
```

## 🚀 Quick Start

```bash
# Start a new feature in isolated workspace with tmux + AI
baag start feature-auth

# List all active worktrees and sessions
baag list

# Create PR and optionally clean up when done
baag submit  # or: baag finish

# Remove a worktree (auto-detects current if inside one)
baag stop

# Resume work on existing worktree
baag resume feature-auth
```

## 📚 Commands

### Core Workflow

```bash
# Start new worktree with auto-tmux session
baag start feature-name
baag start feature-name --base main        # Specify base branch
baag start feature-name --hs               # Horizontal split layout

# Stop/remove worktree (auto-detects current)
baag stop                                   # Removes current worktree
baag stop feature-name                      # Remove specific worktree

# Resume or create worktree with session
baag resume feature-name                    # Attach or create session

# Submit work (creates PR)
baag submit                                 # Use commit messages as PR title
baag submit --title "Custom PR title"      # Custom title
baag submit --base-branch develop          # Target specific branch
baag submit --no-pr                        # Push only, no PR
baag submit --no-verify                    # Skip git hooks

# List and monitor
baag list                                   # Show all worktrees
baag preview                                # Live AI agent activity dashboard
```

### Setup & Maintenance

```bash
# Initial setup in new project
baag setup                                  # Initialize .baag directory and config

# Configuration
baag config                                 # Interactive configuration wizard
baag config --show                          # Display current settings

# System health
baag check                                  # Check dependencies
baag cleanup                                # Remove orphaned worktrees

# Help & info
baag --help                                 # Show all commands
baag --version                              # Show version
```

## ⚙️ Configuration

Run the interactive configuration wizard:

```bash
baag config
```

Configurable options:
- **Base Branch**: Default branch for creating worktrees (main/master/develop)
- **AI Agent**: Preferred AI assistant (claude/aider/none)
- **Code Editor**: Auto-open editor (cursor/code/vim/none)  
- **Branch Prefix**: Naming convention for branches

Settings are stored in git config per repository. View with:

```bash
baag config --show
```

## 📁 How It Works

Baag creates isolated git worktrees in a `.baag/` directory (automatically added to `.gitignore`):

```
my-project/
├── .git/
├── .baag/                  # Auto-created and gitignored
│   ├── feature-auth/       # Complete isolated workspace
│   ├── bug-fix-login/      # Another workspace
│   └── experiment-ai/      # Parallel development
├── src/                    # Your main working tree
└── ...
```

Each worktree:
- Has its own branch and working directory
- Runs in a dedicated tmux session with AI agent
- Shares the same git history
- Can be worked on simultaneously

### 🔧 Alternative Installation Methods

**From Source:**
```bash
git clone https://github.com/pranav7/baag.git
cd baag
./install.sh
```

**Via Homebrew (coming soon):**
```bash
brew install pranav7/tap/baag
```

### 🔧 Development Setup

For contributors and local development:

```bash
git clone https://github.com/pranav7/baag.git
cd baag
make dev-install    # Creates symlinks for live development

# Make changes and test immediately
baag --version

# Clean up
make dev-uninstall
```

## 📋 Requirements

**Required:**
- Git
- Node.js (v18+)

**Optional (but recommended):**
- **tmux** - Multi-pane terminal sessions with AI agents
- **gh** - GitHub CLI for PR creation
- **claude** - Claude CLI for AI pair programming
- **aider** - Alternative AI coding assistant

## 🔄 Updating

```bash
# Update to latest version from any baag repository
baag update
```

## 🩺 Troubleshooting

```bash
# Check all dependencies
baag check

# Clean up orphaned worktrees
baag cleanup

# Reinstall/repair
curl -fsSL https://raw.githubusercontent.com/pranav7/baag/main/install.sh | bash
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

Report issues at: https://github.com/pranav7/baag/issues
