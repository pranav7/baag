#!/bin/sh
#
# Baag Common Library
# Shared functions for baag and install script

# =============================================================================
# COLOR DEFINITIONS AND FORMATTING
# =============================================================================

# Color codes and formatting
if [ -t 1 ]; then
  # Colors
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  MAGENTA='\033[0;35m'
  CYAN='\033[0;36m'
  WHITE='\033[0;37m'

  # Bold colors
  BOLD_RED='\033[1;31m'
  BOLD_GREEN='\033[1;32m'
  BOLD_YELLOW='\033[1;33m'
  BOLD_BLUE='\033[1;34m'
  BOLD_MAGENTA='\033[1;35m'
  BOLD_CYAN='\033[1;36m'
  BOLD_WHITE='\033[1;37m'

  # Background colors
  BG_RED='\033[41m'
  BG_GREEN='\033[42m'
  BG_YELLOW='\033[43m'
  BG_BLUE='\033[44m'
  BG_MAGENTA='\033[45m'
  BG_CYAN='\033[46m'

  # Formatting
  BOLD='\033[1m'
  DIM='\033[2m'
  UNDERLINE='\033[4m'
  REVERSE='\033[7m'

  # Reset
  NC='\033[0m' # No Color
else
  # No colors if not in terminal
  RED='' GREEN='' YELLOW='' BLUE='' MAGENTA='' CYAN='' WHITE=''
  BOLD_RED='' BOLD_GREEN='' BOLD_YELLOW='' BOLD_BLUE='' BOLD_MAGENTA='' BOLD_CYAN='' BOLD_WHITE=''
  BG_RED='' BG_GREEN='' BG_YELLOW='' BG_BLUE='' BG_MAGENTA='' BG_CYAN=''
  BOLD='' DIM='' UNDERLINE='' REVERSE='' NC=''
fi

# =============================================================================
# PRINT FUNCTIONS
# =============================================================================

print_success() {
  printf "${BOLD_GREEN}✓${NC} %s\n" "$1"
}

print_error() {
  printf "${BOLD_RED}✗${NC} %s\n" "$1" >&2
}

print_info() {
  printf "${BOLD_BLUE}ℹ${NC} %s\n" "$1"
}

print_warning() {
  printf "${BOLD_YELLOW}⚠${NC} %s\n" "$1"
}

print_header() {
  printf "\n${BOLD_CYAN}%s${NC}\n" "$1"
  printf "${DIM}%s${NC}\n" "$(printf '%*s' ${#1} '' | tr ' ' '─')"
}

# Specialized print functions for baag
print_branch() {
  printf "${BG_MAGENTA}${WHITE} %s ${NC}" "$1"
}

print_path() {
  printf "${CYAN}%s${NC}" "$1"
}

print_hash() {
  printf "${BG_BLUE}${WHITE} %s ${NC}" "$1"
}

# =============================================================================
# COMMAND DETECTION UTILITIES
# =============================================================================

# Enhanced command detection that works with aliases, functions, and binaries
check_command_enhanced() {
  local cmd="$1"

  # Try multiple methods to detect the command
  # 1. Standard command -v check
  # 2. which command (for aliases and functions)
  # 3. type command (bash builtin)
  # 4. Check known installation paths for specific tools
  # 5. Direct execution test
  if command -v "$cmd" >/dev/null 2>&1 || \
     which "$cmd" >/dev/null 2>&1 || \
     type "$cmd" >/dev/null 2>&1 || \
     check_special_command_paths "$cmd" || \
     "$cmd" --version >/dev/null 2>&1 || \
     "$cmd" --help >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Check special installation paths for known commands
check_special_command_paths() {
  local cmd="$1"

  case "$cmd" in
    claude)
      [ -x "$HOME/.claude/local/claude" ]
      ;;
    *)
      return 1
      ;;
  esac
}

# Check if both tmux and claude are available
check_tmux_claude() {
  # Check tmux
  if ! check_command_enhanced "tmux"; then
    return 1
  fi

  # Check claude
  if check_command_enhanced "claude"; then
    return 0
  else
    return 1
  fi
}

# =============================================================================
# SHELL DETECTION UTILITIES
# =============================================================================

# Detect which shell configuration file to use
detect_shell_config() {
  # Detect which shell configuration file to use
  if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "$(which zsh 2>/dev/null)" ]; then
    if [ -f "$HOME/.zshrc" ]; then
      echo "$HOME/.zshrc"
      return 0
    fi
  fi

  if [ -n "$BASH_VERSION" ] || [ "$SHELL" = "$(which bash 2>/dev/null)" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      echo "$HOME/.bashrc"
      return 0
    elif [ -f "$HOME/.bash_profile" ]; then
      echo "$HOME/.bash_profile"
      return 0
    fi
  fi

  # Fallback - try to detect from SHELL environment variable
  case "$SHELL" in
    */zsh)
      echo "$HOME/.zshrc"
      ;;
    */bash)
      if [ -f "$HOME/.bashrc" ]; then
        echo "$HOME/.bashrc"
      else
        echo "$HOME/.bash_profile"
      fi
      ;;
    */fish)
      echo "$HOME/.config/fish/config.fish"
      ;;
    *)
      # Default fallback
      if [ -f "$HOME/.profile" ]; then
        echo "$HOME/.profile"
      else
        echo "$HOME/.bashrc"
      fi
      ;;
  esac
}

# =============================================================================
# PATH AND DIRECTORY UTILITIES
# =============================================================================

# Get the directory containing this script (library directory)
get_lib_dir() {
  cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd
}

# Get the root directory of the baag project
get_baag_root() {
  echo "$(dirname "$(get_lib_dir)")"
}

# Get the worktrees directory - handle case where we're already in a worktree
get_worktrees_dir() {
  # If we're already in a worktree, find the worktrees directory
  if echo "$PWD" | grep -q "/worktrees/"; then
    # Extract the worktrees directory from current path
    echo "$PWD" | sed 's|/worktrees/.*|/worktrees|'
  else
    # Standard case: one level up from current directory
    echo "$(dirname "$PWD")/worktrees"
  fi
}

# Get the main repository directory from git worktree list
get_main_repo_dir() {
  # Go up until we find the main repo (the one that contains .git directory, not .git file)
  current="$(pwd)"
  while [ "$current" != "/" ]; do
    if [ -d "$current/.git" ] && [ ! -f "$current/.git" ]; then
      echo "$current"
      return
    fi
    current="$(dirname "$current")"
  done

  # Fallback: try to get it from git worktree list
  git worktree list | head -1 | awk '{print $1}'
}

# =============================================================================
# GIT UTILITIES
# =============================================================================

# Check if we're in a git repository
check_git_repository() {
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    print_error "Not in a git repository"
    printf "${DIM}Please run this command from within a git repository.${NC}\n"
    return 1
  fi

  if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
    print_error "Could not determine git repository root"
    return 1
  fi

  return 0
}

# Check if git is working properly
check_git_status() {
  if ! git status >/dev/null 2>&1; then
    print_error "Git repository appears to be corrupted or inaccessible"
    return 1
  fi
  return 0
}

# Get current git branch name
get_current_branch() {
  git branch --show-current
}

# Check if current directory is in a worktree
is_in_worktree() {
  current_dir="$(pwd)"
  # Check if current directory is in worktrees directory
  echo "$current_dir" | grep -q "/worktrees/"
}