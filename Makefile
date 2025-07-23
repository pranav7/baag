# Baag Makefile

.PHONY: install uninstall test check clean help

# Installation directory
INSTALL_DIR ?= $(HOME)/.local/bin
SCRIPT_NAME = baag
ALIAS_NAME = wt

help: ## Show this help message
	@echo "Baag - Development Commands"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install baag to ~/.local/bin
	@echo "Installing Baag..."
	@./scripts/install.sh

uninstall: ## Remove baag from ~/.local/bin
	@echo "Uninstalling Baag..."
	@rm -f "$(INSTALL_DIR)/$(SCRIPT_NAME)"
	@rm -f "$(INSTALL_DIR)/$(ALIAS_NAME)"
	@echo "✓ Uninstalled successfully"

test: ## Run basic functionality tests
	@echo "Testing Baag..."
	@chmod +x bin/$(SCRIPT_NAME)
	@echo "✓ Script is executable"
	@if bin/$(SCRIPT_NAME) version >/dev/null 2>&1; then \
		echo "✓ Version command works"; \
	else \
		echo "✗ Version command failed"; \
		exit 1; \
	fi
	@echo "✓ All tests passed"

check: ## Check dependencies and installation
	@echo "Checking dependencies..."
	@./scripts/install.sh check

lint: ## Check script for common issues
	@echo "Linting scripts..."
	@if command -v shellcheck >/dev/null 2>&1; then \
		shellcheck bin/$(SCRIPT_NAME); \
		shellcheck scripts/install.sh; \
		echo "✓ Shellcheck passed"; \
	else \
		echo "⚠ shellcheck not found, skipping lint check"; \
		echo "  Install with: brew install shellcheck"; \
	fi

clean: ## Clean up temporary files
	@echo "Cleaning up..."
	@find . -name "*.log" -delete
	@find . -name ".DS_Store" -delete
	@echo "✓ Cleanup complete"

format: ## Format shell scripts
	@echo "Formatting scripts..."
	@if command -v shfmt >/dev/null 2>&1; then \
		shfmt -i 2 -w bin/$(SCRIPT_NAME); \
		shfmt -i 2 -w scripts/install.sh; \
		echo "✓ Formatting complete"; \
	else \
		echo "⚠ shfmt not found, skipping format"; \
		echo "  Install with: brew install shfmt"; \
	fi

package: ## Create a release package
	@echo "Creating release package..."
	@mkdir -p dist
	@tar -czf dist/git-worktree-manager-1.0.0.tar.gz \
		--exclude=dist \
		--exclude=.git \
		--exclude="*.log" \
		.
	@echo "✓ Package created: dist/git-worktree-manager-1.0.0.tar.gz"

dev-setup: ## Set up development environment
	@echo "Setting up development environment..."
	@chmod +x bin/$(SCRIPT_NAME)
	@chmod +x scripts/install.sh
	@echo "✓ Development environment ready"

# Development helpers
dev-install: dev-setup ## Install for development (symlink)
	@echo "Installing for development..."
	@mkdir -p "$(INSTALL_DIR)"
	@ln -sf "$(PWD)/bin/$(SCRIPT_NAME)" "$(INSTALL_DIR)/$(SCRIPT_NAME)"
	@ln -sf "$(PWD)/bin/$(SCRIPT_NAME)" "$(INSTALL_DIR)/$(ALIAS_NAME)"
	@echo "✓ Development installation complete (symlinked)"

dev-uninstall: ## Remove development installation
	@echo "Removing development installation..."
	@rm -f "$(INSTALL_DIR)/$(SCRIPT_NAME)"
	@rm -f "$(INSTALL_DIR)/$(ALIAS_NAME)"
	@echo "✓ Development installation removed"