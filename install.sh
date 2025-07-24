#!/bin/bash
# Baag Bootstrap Installer
# This minimal script just gets baag command available, then hands off to "baag setup"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/.local/bin"
LIB_DIR="$HOME/.local/lib/baag"
REPO_URL="https://github.com/pranav7/baag"

print_header() {
    echo -e "\n${CYAN}${BOLD}$1${NC}"
    echo -e "${DIM}$(printf '%*s' ${#1} '' | tr ' ' '─')${NC}"
}

print_success() {
    echo -e "${GREEN}✔${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

# Check required dependencies
check_deps() {
    print_header "Checking Dependencies"

    local missing=()

    for cmd in git node curl; do
        if command -v "$cmd" >/dev/null 2>&1; then
            print_success "$cmd is available"
        else
            print_error "$cmd is not installed"
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "\n${RED}Missing required dependencies: ${missing[*]}${NC}"
        echo -e "${YELLOW}Please install the missing dependencies and try again.${NC}"
        exit 1
    fi
}

# Create installation directories
setup_dirs() {
    print_header "Setting Up Directories"

    mkdir -p "$INSTALL_DIR" "$LIB_DIR"
    print_success "Created installation directories"

    # Check PATH
    if [[ ":$PATH:" == *":$INSTALL_DIR:"* ]]; then
        print_success "$INSTALL_DIR is in your PATH"
    else
        print_warning "$INSTALL_DIR is not in your PATH"
        echo -e "${DIM}Add this to your shell config (~/.bashrc, ~/.zshrc):${NC}"
        echo -e "${BLUE}export PATH=\"$INSTALL_DIR:\$PATH\"${NC}"
        echo -e "${DIM}Then restart your terminal or run: source ~/.bashrc${NC}"
    fi
}

# Minimal installation - just get baag command working
install_baag() {
    print_header "Installing Baag Bootstrap"

    # Clone or download the repository files we need
    local temp_dir
    temp_dir=$(mktemp -d)

    print_info "Downloading baag source..."
    if git clone --depth 1 "$REPO_URL" "$temp_dir" >/dev/null 2>&1; then
        print_success "Downloaded source code"
    else
        print_error "Failed to download source code"
        print_info "Make sure you have internet connection and git is installed"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Copy essential files
    print_info "Installing essential files..."
    cp -r "$temp_dir/lib"/* "$LIB_DIR/"
    cp "$temp_dir/bin/baag" "$LIB_DIR/baag.mjs"

    # Create minimal wrapper script
    cat > "$INSTALL_DIR/baag" << 'EOF'
#!/bin/bash
# Baag bootstrap wrapper
export NODE_PATH="$HOME/.local/lib/baag/node_modules:$NODE_PATH"
exec node "$HOME/.local/lib/baag/baag.mjs" "$@"
EOF

    chmod +x "$INSTALL_DIR/baag"

    # Install minimal dependencies
    print_info "Installing Node.js dependencies..."
    cd "$LIB_DIR"
    cat > package.json << 'EOF'
{
  "name": "baag",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "zx": "^8.0.0",
    "chalk": "^5.3.0",
    "boxen": "^7.1.1",
    "figures": "^6.1.0"
  }
}
EOF

    npm install --silent >/dev/null 2>&1
    cd - >/dev/null

    # Cleanup
    rm -rf "$temp_dir"

    print_success "Baag bootstrap installed"
}

# Test installation
test_install() {
    print_header "Testing Installation"

    if command -v baag >/dev/null 2>&1; then
        print_success "baag command is available"
    else
        print_warning "baag command not found in PATH"
        echo -e "${YELLOW}You may need to restart your terminal or update your PATH${NC}"
        return 1
    fi
}

# Main installation
main() {
    cat << 'EOF'

       ██████╗  █████╗  █████╗  ██████╗
       ██╔══██╗██╔══██╗██╔══██╗██╔════╝
       ██████╔╝███████║███████║██║  ███╗
       ██╔══██╗██╔══██║██╔══██║██║   ██║
       ██████╔╝██║  ██║██║  ██║╚██████╔╝
       ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝

         Baag Bootstrap Installer

EOF

    check_deps
    setup_dirs
    install_baag

    if test_install; then
        print_header "Bootstrap Complete!"
        echo -e "${GREEN}✔ Baag has been bootstrapped successfully!${NC}\n"

        echo -e "${BOLD}Next Steps:${NC}"
        echo -e "1. Restart your terminal (or update PATH if needed)"
        echo -e "2. Run: ${BLUE}baag setup${NC} (for full installation & configuration)"
        echo -e "3. Run: ${BLUE}baag --help${NC} (to see all available commands)\n"

        echo -e "${DIM}This bootstrap just made the 'baag' command available.${NC}"
        echo -e "${DIM}Run 'baag setup' for full dependency checks and configuration.${NC}"
    else
        print_error "Bootstrap installation may have issues"
        echo -e "${YELLOW}Try restarting your terminal and running: baag setup${NC}"
    fi
}

main "$@"