# Changelog

All notable changes to Baag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2025-11-05

### Added
- Worktree setup configuration - automatically run commands when creating worktrees
- Platform-specific setup commands (Unix/Windows variants)
- Environment variables for setup scripts: `BAAG_ROOT_PATH`, `BAAG_WORKTREE_PATH`, `BAAG_BASE_BRANCH`

### Enhanced
- Simplified interactive prompts - now just asks for branch name
- Auto-converts spaces to hyphens in branch names
- Consolidated all configuration into `.baag/config.json`

### Changed
- Removed optional prompts (session name, description, split preference)
- Moved worktree setup config from `.baag.json` to `.baag/config.json`

### Removed
- Port management system and `ports` command
- Dev server configuration
- 3-pane layout (already using simple 2-pane layout)

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

[0.0.3]: https://github.com/pranav7/baag/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/pranav7/baag/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/pranav7/baag/releases/tag/v0.0.1
