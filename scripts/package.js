#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;
const outputFile = `justlang-lsp-${version}.vsix`;

console.log('📦 Creating VSCode extension package ... using scripts/package.js');

// Create temporary packaging directory
const tempDir = '.temp-packaging';
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
}
fs.mkdirSync(tempDir);

try {
    // Create minimal package.json for VSCode extension (runtime dependencies only)
    const runtimeDeps = {
        // Only include actual runtime dependencies needed by the extension
        // Based on your main entry point in dist/extension.js, most of these are build-time only
    };

    const prodPkg = {
        name: pkg.name,
        publisher: pkg.publisher,
        displayName: pkg.displayName,
        description: pkg.description,
        repository: pkg.repository,
        version: pkg.version,
        engines: pkg.engines,
        categories: pkg.categories,
        activationEvents: pkg.activationEvents,
        main: pkg.main,
        contributes: pkg.contributes,
        dependencies: runtimeDeps,
        // Remove all scripts to avoid any execution during packaging
        scripts: {}
    };
    
    fs.writeFileSync(
        path.join(tempDir, 'package.json'), 
        JSON.stringify(prodPkg, null, 2)
    );

    // Copy essential files for VSCode extension
    const filesToCopy = [
        'dist',
        'icons',
        'syntaxes', 
        'language-configuration.json',
        'justfile',
        'README.md',
        'CHANGELOG.md',
        'LICENSE.md'
    ];

    filesToCopy.forEach(file => {
        if (fs.existsSync(file)) {
            const destPath = path.join(tempDir, file);
            const stat = fs.statSync(file);
            
            if (stat.isDirectory()) {
                fs.cpSync(file, destPath, { recursive: true });
                console.log(`✅ Copied directory: ${file}`);
            } else {
                fs.copyFileSync(file, destPath);
                console.log(`✅ Copied file: ${file}`);
            }
        } else {
            console.log(`⚠️  File not found, skipping: ${file}`);
        }
    });

    // Package using vsce from the temp directory (no dependencies to install)
    console.log('🔨 Running vsce package...');
    const outputPath = path.resolve(outputFile);
    
    execSync(`pnpm exec vsce package --out "${outputPath}"`, {
        cwd: tempDir,
        stdio: 'inherit'
    });

    console.log(`🎉 Package created: ${outputFile}`);

} catch (error) {
    console.error('❌ Packaging failed:', error.message);
    process.exit(1);
} finally {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
    }
}