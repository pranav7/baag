# Changelog

All notable changes to Baag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Baag
- Core worktree management commands (start, stop, list, submit)
- Smart base branch tracking and remembering
- Tmux integration with automatic session management
- Claude AI integration for enhanced development workflow
- GitHub CLI integration for automated PR creation
- Beautiful color-coded output and progress indicators
- Automatic cleanup of tmux sessions and configurations
- Comprehensive installation script with dependency checking
- Support for custom PR titles and base branches
- Option to push without creating PRs (--no-pr flag)
- Option to bypass git hooks (--no-verify flag)
- Cross-platform compatibility (macOS, Linux)
- Short alias (wt) for faster workflow

### Features
- **Enhanced Workflow**: Streamlined git worktree creation and management
- **Development Environment**: Auto-creates tmux sessions with AI assistance
- **PR Automation**: One-command push and PR creation
- **Memory System**: Remembers base branches for accurate targeting
- **Cleanup Management**: Automatic cleanup of sessions and configurations
- **Flexibility**: Optional cleanup prompts and custom configurations

### Dependencies
- **Required**: git
- **Optional**: tmux (multi-pane environment), gh (PR creation), claude (AI assistance)

### Installation Methods
- Direct script installation via curl
- Manual installation from source
- Homebrew formula (coming soon)

---

## Release Notes

### v1.0.0 - Initial Release

This is the first stable release of Baag, bringing together all the core functionality needed for an enhanced git worktree workflow.

#### Key Highlights
- 🚀 **Rapid Development**: Create isolated development environments in seconds
- 🧠 **Smart Automation**: Remembers your workflow preferences and automates repetitive tasks
- 🔗 **Seamless Integration**: Works beautifully with existing git, tmux, and GitHub workflows
- 🎨 **Developer Experience**: Beautiful, informative output that keeps you in the flow

#### Perfect For
- Developers working on multiple features simultaneously
- Teams using feature branch workflows
- Anyone who wants to speed up their git workflow
- Developers who love automation and efficient tooling

[Unreleased]: https://github.com/your-username/baag/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-username/baag/releases/tag/v1.0.0