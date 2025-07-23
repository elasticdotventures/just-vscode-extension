# Justfile for building, testing, packaging, and installing the VSCode Justfile LSP provider

# 🤓 export display for GUI applications, ALWAYS Use this, it is set correctly on init.
# TODO: only set $DISPLAY if the env $env:DISPALY
#DISPLAY:="localhost:10.0"
DISPLAY := env("DISPLAY", "localhost:10.0")
VSCODE:="~/.dotfiles/vscode.sh"

EXT_VER := `jq -r .version package.json`

run-debug-extension:
    pnpm run compile && DISPLAY={{DISPLAY}} pnpm run test

# Build the VSCode extension
build:
    . $HOME/.nvm/nvm.sh
    pnpm run compile

package-clean:
    rm -rf out && pnpm run compile-tests  

# Test the VSCode extension
test:
    # Upgrade everything to TypeScript and precompile tests
    just build
    NODE_OPTIONS='--import=tsx' pnpm exec mocha ./src/test/language-configuration-accessibility.test.ts
    pnpm run compile-tests || (echo "Precompiled tests failed. Skipping extension host tests." && exit 1)
    # Run extension host tests only if precompiled tests pass
    just package
    export DISPLAY={{DISPLAY}} && pnpm exec vscode-test

test-lsp:
    #!/bin/bash
    # MUST BE RUN AS /bin/bash so that {} aren't interpolated by lsp
    # THIS WONT WORK: no content header
    # echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | just-lsp  
    rm foo || true
    echo -e 'Content-Length: 76\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | just-lsp --log foo
    cat foo

# Package the VSCode extension into a .vsix file
package:
    . $HOME/.nvm/nvm.sh
    pnpm run compile
    node scripts/package.js
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


package-inspect:
    unzip justlang-lsp-{{EXT_VER}}.vsix -d vsix-content
    tree vsix-content
    @echo "🤔 remember to cleanup ./vsix-content when finished"


# Install the VSCode extension
install:
    pnpm install

package-install:
    {{VSCODE}} --install-extension ./justlang-lsp-{{EXT_VER}}.vsix

