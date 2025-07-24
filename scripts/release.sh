#!/bin/bash
#
# Release script for baag
# Usage: ./scripts/release.sh [patch|minor|major|x.y.z]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
fi

# Check if working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    log_error "Working directory is not clean. Please commit or stash changes."
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
log_info "Current version: $CURRENT_VERSION"

# Parse version bump type
VERSION_TYPE=${1:-patch}

# Function to increment version
increment_version() {
    local version=$1
    local type=$2
    
    IFS='.' read -ra VERSION_PARTS <<< "$version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    case $type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            # Assume it's a specific version like "1.2.3"
            if [[ $type =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "$type"
                return
            else
                log_error "Invalid version type: $type. Use patch, minor, major, or x.y.z"
                exit 1
            fi
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# Calculate new version
NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$VERSION_TYPE")
log_info "New version: $NEW_VERSION"

# Confirm release
read -p "$(echo -e "${YELLOW}?${NC} Release version $NEW_VERSION? (y/N): ")" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Release cancelled"
    exit 0
fi

# Update package.json version
log_info "Updating package.json version..."
node -e "
const pkg = require('./package.json');
pkg.version = '$NEW_VERSION';
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"
log_success "Updated package.json to version $NEW_VERSION"

# Update Formula/baag.rb URL
log_info "Updating Homebrew formula URL..."
sed -i.bak "s|archive/v[0-9]\+\.[0-9]\+\.[0-9]\+\.tar\.gz|archive/v${NEW_VERSION}.tar.gz|g" Formula/baag.rb
rm Formula/baag.rb.bak
log_success "Updated formula URL to v$NEW_VERSION"

# Commit version changes
log_info "Committing version changes..."
git add package.json Formula/baag.rb
git commit -m "Release v$NEW_VERSION"
log_success "Committed version changes"

# Create and push tag
log_info "Creating and pushing tag..."
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"
log_success "Created and pushed tag v$NEW_VERSION"

# Create GitHub release
log_info "Creating GitHub release..."
gh release create "v$NEW_VERSION" \
    --title "v$NEW_VERSION" \
    --notes "🌳 Baag v$NEW_VERSION

## 🚀 Installation
\`\`\`bash
brew install baag
\`\`\`

## Usage
\`\`\`bash
baag start feature-branch
baag submit
baag stop feature-branch
\`\`\`

For full changelog, see: https://github.com/pranav7/baag/compare/v$CURRENT_VERSION...v$NEW_VERSION"

log_success "Created GitHub release v$NEW_VERSION"

# Calculate new SHA256
log_info "Calculating SHA256 for new release..."
sleep 2  # Give GitHub a moment to process the release
NEW_SHA256=$(curl -sL "https://github.com/pranav7/baag/archive/v$NEW_VERSION.tar.gz" | sha256sum | cut -d' ' -f1)
log_info "New SHA256: $NEW_SHA256"

# Update Formula with new SHA256
log_info "Updating Homebrew formula SHA256..."
sed -i.bak "s/sha256 \"[a-f0-9]\{64\}\"/sha256 \"$NEW_SHA256\"/g" Formula/baag.rb
rm Formula/baag.rb.bak
log_success "Updated formula SHA256"

# Commit SHA256 update
log_info "Committing SHA256 update..."
git add Formula/baag.rb
git commit -m "Update SHA256 for v$NEW_VERSION"
git push origin main
log_success "Committed and pushed SHA256 update"

# Test installation
log_info "Testing local installation..."
if command -v brew >/dev/null 2>&1; then
    # Uninstall if already installed
    if brew list baag >/dev/null 2>&1; then
        brew uninstall baag
    fi
    
    # Install from local formula
    brew install --formula ./Formula/baag.rb
    
    # Test basic functionality
    if baag version >/dev/null 2>&1; then
        log_success "Local installation test passed"
        brew uninstall baag  # Clean up
    else
        log_error "Local installation test failed"
        exit 1
    fi
else
    log_warning "Homebrew not found, skipping installation test"
fi

echo
log_success "🎉 Release v$NEW_VERSION completed successfully!"
echo
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update your tap repository if you have one"
echo "2. Submit to homebrew-core if desired"
echo "3. Update documentation if needed"
echo
echo -e "${BLUE}Users can now install with:${NC}"
echo "brew install --formula https://raw.githubusercontent.com/pranav7/baag/main/Formula/baag.rb"