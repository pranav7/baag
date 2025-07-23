#!/bin/bash
#
# Baag Installation Script
# Installs baag with dependency checks

set -e

# Color codes and formatting
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  DIM='\033[2m'
  NC='\033[0m' # No Color
else
  RED='' GREEN='' YELLOW='' BLUE='' BOLD='' DIM='' NC=''
fi

# Print functions
print_success() {
  printf "${GREEN}✓${NC} %s\n" "$1"
}

print_error() {
  printf "${RED}✗${NC} %s\n" "$1" >&2
}

print_info() {
  printf "${BLUE}ℹ${NC} %s\n" "$1"
}

print_warning() {
  printf "${YELLOW}⚠${NC} %s\n" "$1"
}

print_header() {
  printf "\n${BOLD}%s${NC}\n" "$1"
  printf "${DIM}%s${NC}\n" "$(printf '%*s' ${#1} '' | tr ' ' '─')"
}

# Installation configuration
INSTALL_DIR="${HOME}/.local/bin"
SCRIPT_NAME="baag"
ALIAS_NAME="wt"

# Dependency tracking
MISSING_DEPS=()
OPTIONAL_DEPS=()

check_dependency() {
  local cmd="$1"
  local required="$2"
  local install_info="$3"

  if command -v "$cmd" >/dev/null 2>&1; then
    print_success "$cmd is available"
    return 0
  else
    if [ "$required" = "true" ]; then
      print_error "$cmd is not installed (required)"
      MISSING_DEPS+=("$cmd|$install_info")
    else
      print_warning "$cmd is not installed (optional - enables enhanced features)"
      OPTIONAL_DEPS+=("$cmd|$install_info")
    fi
    return 1
  fi
}

check_dependencies() {
  print_header "Checking Dependencies"

  # Required dependencies
  check_dependency "git" "true" "Install from: https://git-scm.com/downloads"

  # Optional dependencies
  check_dependency "tmux" "false" "Install with: brew install tmux (macOS) or apt-get install tmux (Ubuntu)"
  check_dependency "gh" "false" "Install from: https://cli.github.com/ (enables PR creation)"
  check_dependency "claude" "false" "Install from: https://claude.ai/claude-cli (enables AI integration)"

  # Check for bash/sh
  if [ -z "$BASH_VERSION" ] && [ -z "$ZSH_VERSION" ]; then
    print_warning "Running in a shell other than bash/zsh - some features may not work optimally"
  fi

  if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    print_header "Missing Required Dependencies"
    for dep in "${MISSING_DEPS[@]}"; do
      cmd=$(echo "$dep" | cut -d'|' -f1)
      info=$(echo "$dep" | cut -d'|' -f2)
      printf "  ${RED}$cmd${NC}: $info\n"
    done
    printf "\nPlease install the required dependencies and run this script again.\n"
    exit 1
  fi

  if [ ${#OPTIONAL_DEPS[@]} -gt 0 ]; then
    print_header "Optional Dependencies"
    printf "${DIM}The following optional dependencies can enhance your workflow:${NC}\n"
    for dep in "${OPTIONAL_DEPS[@]}"; do
      cmd=$(echo "$dep" | cut -d'|' -f1)
      info=$(echo "$dep" | cut -d'|' -f2)
      printf "  ${YELLOW}$cmd${NC}: $info\n"
    done
    printf "\n${DIM}You can install these later to enable additional features.${NC}\n"
  fi
}

setup_install_directory() {
  print_header "Setting Up Installation Directory"

  if [ ! -d "$INSTALL_DIR" ]; then
    print_info "Creating directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
  else
    print_success "Directory exists: $INSTALL_DIR"
  fi

  # Check if install directory is in PATH
  if echo "$PATH" | grep -q "$INSTALL_DIR"; then
    print_success "$INSTALL_DIR is in your PATH"
  else
    print_warning "$INSTALL_DIR is not in your PATH"
    print_info "Add the following to your shell configuration file (~/.bashrc, ~/.zshrc, etc.):"
    printf "${DIM}export PATH=\"\$PATH:$INSTALL_DIR\"${NC}\n"
  fi
}

install_script() {
  print_header "Installing Git Worktree Manager"

  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local source_script="$script_dir/../bin/$SCRIPT_NAME"
  local target_script="$INSTALL_DIR/$SCRIPT_NAME"
  local target_alias="$INSTALL_DIR/$ALIAS_NAME"

  if [ ! -f "$source_script" ]; then
    print_error "Source script not found: $source_script"
    print_info "Make sure you're running this script from the correct directory"
    exit 1
  fi

  # Copy main script
  print_info "Installing $SCRIPT_NAME to $target_script"
  cp "$source_script" "$target_script"
  chmod +x "$target_script"
  print_success "Main script installed"

  # Create alias
  print_info "Creating alias: $ALIAS_NAME -> $SCRIPT_NAME"
  cat > "$target_alias" << 'EOF'
#!/bin/bash
# Baag alias
exec baag "$@"
EOF
  chmod +x "$target_alias"
  print_success "Alias created"
}

verify_installation() {
  print_header "Verifying Installation"

  local target_script="$INSTALL_DIR/$SCRIPT_NAME"
  local target_alias="$INSTALL_DIR/$ALIAS_NAME"

  if [ -x "$target_script" ]; then
    print_success "Main script is executable"
  else
    print_error "Main script is not executable"
    return 1
  fi

  if [ -x "$target_alias" ]; then
    print_success "Alias is executable"
  else
    print_error "Alias is not executable"
    return 1
  fi

  # Test version command (only if in PATH)
  if command -v "$SCRIPT_NAME" >/dev/null 2>&1; then
    print_info "Testing installation..."
    if "$SCRIPT_NAME" version >/dev/null 2>&1; then
      print_success "Installation test passed"
    else
      print_warning "Installation test failed - you may need to restart your shell"
    fi
  else
    print_warning "Command not found in PATH - you may need to restart your shell"
  fi
}

show_usage_info() {
  print_header "Installation Complete"

  printf "Baag has been installed successfully!\n\n"

  printf "${BOLD}Usage:${NC}\n"
  printf "  baag start <name>            # Create new worktree\n"
  printf "  baag stop <name>             # Remove worktree\n"
  printf "  baag list                    # List all worktrees\n"
  printf "  baag submit                  # Create PR and cleanup\n"
  printf "  baag version                 # Show version\n\n"

  printf "${BOLD}Alias:${NC}\n"
  printf "  wt <command>                 # Short alias for baag\n\n"

  printf "${BOLD}Getting Started:${NC}\n"
  printf "1. Navigate to any git repository\n"
  printf "2. Run: ${BLUE}baag start feature-branch${NC}\n"
  printf "3. Work on your feature\n"
  printf "4. Run: ${BLUE}baag submit${NC} to create a PR\n\n"

  if [ ${#OPTIONAL_DEPS[@]} -gt 0 ]; then
    printf "${DIM}Install optional dependencies for enhanced features:${NC}\n"
    for dep in "${OPTIONAL_DEPS[@]}"; do
      cmd=$(echo "$dep" | cut -d'|' -f1)
      info=$(echo "$dep" | cut -d'|' -f2)
      printf "  ${YELLOW}$cmd${NC}: $info\n"
    done
    printf "\n"
  fi

  printf "For more information, run: ${BLUE}baag --help${NC}\n"
}

# Main installation flow
main() {
  print_header "Baag Installation"
  printf "${DIM}Enhanced git worktree workflows with tmux integration${NC}\n"

  check_dependencies
  setup_install_directory
  install_script
  verify_installation
  show_usage_info
}

# Handle command line arguments
case "${1:-install}" in
  install)
    main
    ;;
  check)
    check_dependencies
    ;;
  --help|-h)
    printf "Baag Installation Script\n\n"
    printf "Usage: $0 [command]\n\n"
    printf "Commands:\n"
    printf "  install (default)  Install baag\n"
    printf "  check              Only check dependencies\n"
    printf "  --help, -h         Show this help\n"
    ;;
  *)
    print_error "Unknown command: $1"
    printf "Run '$0 --help' for usage information.\n"
    exit 1
    ;;
esac