# Baag

🚀 Enhanced git worktree workflows with tmux integration and PR creation

Baag simplifies the creation and management of git worktrees, allowing you to work on multiple branches simultaneously with integrated development environments.

## ✨ Features

- **🌿 Easy Worktree Management**: Create and destroy worktrees with simple commands
- **🎯 Smart Branch Tracking**: Remembers base branches for accurate PR targeting
- **🖥️ Tmux Integration**: Auto-creates tmux sessions with Claude AI when available
- **🔄 PR Automation**: Create pull requests directly from your worktree
- **🧹 Automatic Cleanup**: Removes tmux sessions and cleans up configurations
- **🎨 Beautiful Output**: Color-coded status messages and progress indicators
- **⚡ Fast Workflow**: Streamlined commands for rapid development cycles

## 📦 Installation

### Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/your-username/baag/main/scripts/install.sh | bash
```

### Manual Install

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/baag.git
   cd baag
   ```

2. Run the installation script:
   ```bash
   ./scripts/install.sh
   ```

3. Add `~/.local/bin` to your PATH if not already present:
   ```bash
   echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc  # or ~/.zshrc
   source ~/.bashrc  # or ~/.zshrc
   ```

### Homebrew (Coming Soon)

```bash
brew install your-username/tap/baag
```

## 🎯 Dependencies

### Required
- **git**: Core git functionality

### Optional (Enables Enhanced Features)
- **tmux**: Multi-pane development environment
- **gh**: GitHub CLI for PR creation
- **claude**: AI-powered development assistance

## 🚀 Usage

### Basic Commands

```bash
# Create a new worktree and branch
baag start feature-auth

# List all worktrees and their status
baag list

# Submit your work (push + create PR)
baag submit

# Remove a worktree
baag stop feature-auth

# Show version
baag version
```

### Using the Alias

```bash
# All commands work with the shorter alias
wt start feature-auth
wt list
wt submit
wt stop feature-auth
```

### Advanced Usage

#### Custom PR Options
```bash
# Create PR with custom title
baag submit --title "Add user authentication system"

# Specify target branch
baag submit --base-branch develop

# Push without creating PR
baag submit --no-pr

# Skip git hooks
baag submit --no-verify
```

## 📁 Workflow Example

```bash
# 1. Start in your main repository
cd my-project

# 2. Create a new worktree for a feature
baag start user-dashboard
# → Creates worktree in ../worktrees/user-dashboard
# → Remembers 'main' as the base branch
# → Opens tmux session with Claude (if available)

# 3. Work on your feature
# Your work happens in the worktree directory
# Tmux session has Claude on the left, terminal on the right

# 4. Submit your work
baag submit
# → Pushes branch to origin
# → Creates PR against remembered base branch ('main')
# → Optionally cleans up worktree

# 5. Alternative: Manual cleanup later
baag stop user-dashboard
```

## 🏗️ How It Works

### Directory Structure
```
my-project/                 # Main repository
├── .git/
├── src/
└── ...

../worktrees/              # Worktrees directory
├── feature-auth/          # Worktree for auth feature
├── bug-fix-login/         # Worktree for bug fix
└── user-dashboard/        # Worktree for dashboard
```

### Base Branch Memory
Git Worktree Manager remembers which branch you were on when creating a worktree:
- Starting from `main` branch → PRs target `main`
- Starting from `develop` branch → PRs target `develop`
- Custom targeting with `--base-branch`

### Tmux Integration
When both `tmux` and `claude` are available:
- Left pane: Claude AI assistance
- Right pane: Your terminal
- Session name: `worktree-<branch-name>`
- Automatic cleanup on worktree removal

## 🔧 Configuration

Baag stores configuration in your git config:

```bash
# View stored base branches
git config --get-regexp "worktree\..*\.base"

# View active tmux sessions
git config --get-regexp "worktree\..*\.tmux-session"
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `baag start amazing-feature`
3. Commit your changes: `git commit -am 'Add amazing feature'`
4. Submit your work: `baag submit`

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by git's powerful worktree functionality
- Built for developers who love efficient workflows
- Special thanks to the git, tmux, and GitHub CLI teams

## 📞 Support

- 🐛 [Report Issues](https://github.com/your-username/baag/issues)
- 💡 [Feature Requests](https://github.com/your-username/baag/issues)
- 📖 [Documentation](https://github.com/your-username/baag/wiki)

---

*Made with ❤️ for developers who want to move fast and ship quality code*