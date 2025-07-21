# Justfile for building, testing, packaging, and installing the VSCode Justfile LSP provider

# 🤓 export display for GUI applications, ALWAYS Use this, it is set correctly on init.
DISPLAY:="localhost:10.0"
VSCODE:="~/.dotfiles/vscode.sh"

EXT_VER := `jq -r .version package.json`

run-debug-extension:
    pnpm run compile && DISPLAY={{DISPLAY}} pnpm run test

# Build the VSCode extension
build:
    . $HOME/.nvm/nvm.sh
    pnpm install
    pnpm run compile

# Test the VSCode extension
test:
    # this will appear on operators screen (useful for debugging)
    just package
    just install
    export DISPLAY={{DISPLAY}} && pnpm run test

# Package the VSCode extension into a .vsix file
package:
    . $HOME/.nvm/nvm.sh
    pnpm run compile
    pnpm install -g @vscode/vsce
    vsce package

# Install the VSCode extension
install:
    {{VSCODE}} --install-extension ./vscode-just-lsp-*.vsix
