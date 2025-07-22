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
    pnpm run compile

# Test the VSCode extension
test:
    # Upgrade everything to TypeScript and precompile tests
    just build
    pnpm run compile-tests || (echo "Precompiled tests failed. Skipping extension host tests." && exit 1)
    # Run extension host tests only if precompiled tests pass
    just package
    export DISPLAY={{DISPLAY}} && pnpm run test

# Package the VSCode extension into a .vsix file
package:
    . $HOME/.nvm/nvm.sh
    pnpm run compile
    # pnpm install -g @vscode/vsce
    vsce package
    @just package-check


package-check:
    #!/bin/bash
    # check if the extension file is less than 1 minute old using {{EXT_VER}}
    FILENAME="./justlang-lsp-{{EXT_VER}}.vsix"
    if [ -f "$FILENAME" ] && [ $(($(date +%s) - $(stat -c %Y "$FILENAME"))) -lt 60 ]; then \
        echo "👍🏻 file $FILENAME"
    else \
        echo "😭 file $FILENAME missing or too old"; \
    fi  


# Install the VSCode extension
install:
    pnpm install

package-install:
    {{VSCODE}} --install-extension ./justlang-lsp-{{EXT_VER}}.vsix

