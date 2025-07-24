# 🌳 Baag

Work on multiple branches with claude code. Baag simplifies git worktree management for efficient development workflows.

## ✨ Features

- **🌿 Easy Worktree Management**: Create and manage git worktrees with simple commands
- **🎯 Smart Branch Tracking**: Remembers base branches for accurate PR targeting  
- **🖥️ Tmux Integration**: Auto-creates tmux sessions with Claude AI when available
- **🔄 PR Automation**: Create pull requests directly from your worktree
- **🧹 Automatic Cleanup**: Clean removal of worktrees and sessions

## 📦 Installation

```bash
npm install
npm run install
```

Add `~/.local/bin` to your PATH:
```bash
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc
source ~/.bashrc
```

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

Baag creates worktrees in a `.baag` directory within your git repository:

```
my-project/
├── .git/
├── .baag/
│   ├── feature-auth/      # Worktree for auth feature
│   └── bug-fix-login/     # Worktree for bug fix
├── src/
└── ...
```

## 🎯 Dependencies

**Required:**
- Node.js
- git

**Optional (for enhanced features):**
- tmux - Multi-pane development environment
- gh - GitHub CLI for PR creation  
- claude - AI development assistance

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.