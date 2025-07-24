class Baag < Formula
  desc "Enhanced git worktree workflows with tmux integration and PR creation"
  homepage "https://github.com/pranav7/baag"
  url "https://github.com/pranav7/baag/archive/v0.0.1.tar.gz"
  sha256 "ed9ec250130e09cf0e585277a21bb2623e6da6c9003b4f81ade5831c7b722099"
  license "MIT"

  depends_on "git"

  def install
    bin.install "bin/baag"
    lib.install "lib/common.sh"

    # Create alias
    (bin/"wt").write <<~EOS
      #!/bin/bash
      # Baag alias
      exec baag "$@"
    EOS

    # Make alias executable
    chmod 0755, bin/"wt"
  end

  def caveats
    <<~EOS
      Baag has been installed!

      Basic usage:
        baag start feature-branch
        baag list
        baag submit
        baag stop feature-branch

      Short alias:
        wt start feature-branch

      Optional dependencies for enhanced features:
        brew install tmux    # Multi-pane development environment
        brew install gh      # GitHub CLI for PR creation

      For more information:
        baag --help
    EOS
  end

  test do
    system "#{bin}/baag", "version"
  end
end