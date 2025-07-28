# Changelog

All notable changes to Baag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2025-07-28

### Added
- Interactive shell for creating new development sessions
- Session resuming capability - continue work on existing worktrees
- Branch prefix configuration for automatic branch naming conventions
- Enhanced configuration wizard with branch prefix setup

### Enhanced  
- Improved worktree creation workflow with interactive prompts
- Better session management and state tracking
- More robust tmux integration with session persistence

### Fixed
- Help text formatting and alignment improvements
- Branch prefix application to worktree creation process

## [0.0.1] - 2024-01-15

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

[0.0.2]: https://github.com/your-username/baag/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/your-username/baag/releases/tag/v0.0.1
