# 🌳 Baag

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


## 📦 Installation

### Quick Install

```bash
# Clone the repository
git clone https://github.com/pranav7/baag.git
cd baag

# Run the install script
node scripts/install
```

The install script will:
- Check for required dependencies (git, node)
- Install baag to `~/.local/bin/baag`
- Verify your PATH configuration
- Display setup instructions

### Manual Installation

If you prefer to install manually:

```bash
# Make sure ~/.local/bin is in your PATH
export PATH="$PATH:$HOME/.local/bin"

# Copy the binary
cp bin/baag.mjs ~/.local/bin/baag
chmod +x ~/.local/bin/baag
```

## Dependencies

**Required:**
- git
- node

**Optional (for enhanced features):**
- tmux (for session management)
- gh (for PR creation)
- claude / gemini / codex (for AI integration)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
