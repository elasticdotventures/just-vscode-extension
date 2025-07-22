// Attribution: Portions of this file are derived from the `vscode-syntax-highlighting-just` repository.
// Repository URL: https://codeberg.org/wolfmah/vscode-syntax-highlighting-just/

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const languageConfigPath = path.resolve(__dirname, '../../language-configuration.json');

describe('Language Configuration Accessibility Tests', () => {
    it('should load the language configuration file', () => {
        const configExists = fs.existsSync(languageConfigPath);
        assert.strictEqual(configExists, true, 'Language configuration file does not exist');
    });

    it('should parse the language configuration file', () => {
        const configContent = fs.readFileSync(languageConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        assert.ok(config, 'Failed to parse language configuration file');
    });

    it('should validate comment configuration', () => {
        const configContent = fs.readFileSync(languageConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        assert.strictEqual(config.comments.lineComment, '#', 'Incorrect line comment symbol');
    });

    it('should validate bracket configuration', () => {
        const configContent = fs.readFileSync(languageConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        assert.deepStrictEqual(config.brackets, [['(', ')']], 'Incorrect bracket configuration');
    });

    it('should validate auto-closing pairs', () => {
        const configContent = fs.readFileSync(languageConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        assert.deepStrictEqual(config.autoClosingPairs, [
            ['{', '}'],
            ['[', ']'],
            ['(', ')'],
            ['"', '"'],
            ["'", "'"]
        ], 'Incorrect auto-closing pairs configuration');
    });

    it('should validate surrounding pairs', () => {
        const configContent = fs.readFileSync(languageConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        assert.deepStrictEqual(config.surroundingPairs, [
            ['{', '}'],
            ['[', ']'],
            ['(', ')'],
            ['"', '"'],
            ["'", "'"]
        ], 'Incorrect surrounding pairs configuration');
    });
});