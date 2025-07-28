# Justfile for building, testing, packaging, and installing the VSCode Justfile LSP provider


# 🤓 export display for GUI applications, ALWAYS Use this, it is set correctly on init.
# TODO: only set $DISPLAY if the env $env:DISPALY
#DISPLAY:="localhost:10.0"
DISPLAY := env("DISPLAY", "localhost:10.0")
VSCODE:="~/.dotfiles/vscode.sh"

EXT_VER := `jq -r .version package.json`

bump-patch:
    git add -u .
    git commit -m "Bump patch version v{{EXT_VER}}"
    pnpm version patch

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

# Publish the packaged extension to VS Code Marketplace
publish:
    #!/bin/bash
    # First ensure we have the latest package
    just package-check
    VSIX_FILE="./justlang-lsp-{{EXT_VER}}.vsix"
    echo "🚀 Publishing $VSIX_FILE to VS Code Marketplace..."
    pnpm exec vsce publish --packagePath "$VSIX_FILE"
    echo "✅ Published version {{EXT_VER}} successfully!"

# Package and publish in one step
release:
    @echo "🔨 Building and packaging extension..."
    just package
    @echo "🚀 Publishing to marketplace..."
    just publish

# Set up GitHub secrets for automated publishing
setup-secrets:
    #!/bin/bash
    echo "🔐 Setting up GitHub secrets for automated publishing..."
    echo ""
    echo "You'll need a VS Code Marketplace Personal Access Token (PAT):"
    echo "1. Go to https://marketplace.visualstudio.com/manage/publishers/promptexecution"
    echo "2. Click 'Personal Access Tokens' → 'New Token'"
    echo "3. Name: 'GitHub Actions Release' with Full access"
    echo "4. Copy the token when generated"
    echo ""
    read -p "Enter your VSCE_PAT token: " -s VSCE_PAT
    echo ""
    gh secret set VSCE_PAT --body "$VSCE_PAT"
    echo "✅ VSCE_PAT secret set successfully!"
    echo ""
    echo "Optional: Set OVSX_PAT for Open VSX Registry:"
    read -p "Enter OVSX_PAT (or press Enter to skip): " -s OVSX_PAT
    if [ ! -z "$OVSX_PAT" ]; then
        gh secret set OVSX_PAT --body "$OVSX_PAT"
        echo "✅ OVSX_PAT secret set successfully!"
    else
        echo "⏭️  Skipped OVSX_PAT setup"
    fi

