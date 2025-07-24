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

### ⚡️ Quick

```bash
curl -sSL https://raw.githubusercontent.com/pranav7/baag/main/scripts/install | node
```

### 🐢 Manual

```bash
# Clone the repository
git clone https://github.com/pranav7/baag.git
cd baag

# Make install script executable and run it
chmod +x scripts/install && ./scripts/install
```

## Dependencies

**Required:**
- git
- node
- tmux (for session management)
- gh (for PR creation)
- claude (default) / gemini / codex (for AI agents)
