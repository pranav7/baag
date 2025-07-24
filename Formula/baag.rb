class Baag < Formula
  desc "Enhanced git worktree workflows with tmux integration and PR creation"
  homepage "https://github.com/pranav7/baag"
  url "https://github.com/pranav7/baag/archive/v0.0.1.tar.gz"
  sha256 "6dc86e7f4c55b4c3ebeb0c6afd0a99eeb14de220af70b699f1cd94f1faf0db13"
  license "MIT"

  depends_on "git"

  def install
    bin.install "bin/baag"

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