// Attribution: Portions of this file are derived from the `vscode-syntax-highlighting-just` repository.
// Repository URL: https://codeberg.org/wolfmah/vscode-syntax-highlighting-just/

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { loadCommentedJson } from '../utils/json-loader.js';

const languageConfigPath = path.resolve(__dirname, '../../language-configuration.json');

describe('Language Configuration Accessibility Tests', () => {
    it('should load the language configuration file', () => {
        const configExists = fs.existsSync(languageConfigPath);
        assert.strictEqual(configExists, true, 'Language configuration file does not exist');
    });

    it('should parse the language configuration file', () => {
        const config = loadCommentedJson(languageConfigPath);
        assert.ok(config, 'Failed to parse language configuration file');
    });

    it('should validate comment configuration', () => {
        const config = loadCommentedJson(languageConfigPath);
        assert.strictEqual(config.comments.lineComment, '#', 'Incorrect line comment symbol');
    });

    it('should validate bracket configuration', () => {
        const config = loadCommentedJson(languageConfigPath);
        assert.deepStrictEqual(config.brackets, [
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
        ], 'Incorrect bracket configuration');
    });

    it('should validate auto-closing pairs', () => {
        const config = loadCommentedJson(languageConfigPath);
        assert.deepStrictEqual(config.autoClosingPairs, [
            { "open": "{", "close": "}" },
            { "open": "[", "close": "]" },
            { "open": "(", "close": ")" },
            { "open": "\"", "close": "\"" },
            { "open": "'", "close": "'" },
            { "open": "`", "close": "`" }
        ], 'Incorrect auto-closing pairs configuration');
    });

    it('should validate surrounding pairs', () => {
        const config = loadCommentedJson(languageConfigPath);
        assert.deepStrictEqual(config.surroundingPairs, [
            { "open": "{", "close": "}" },
            { "open": "[", "close": "]" },
            { "open": "(", "close": ")" },
            { "open": "\"", "close": "\"" },
            { "open": "'", "close": "'" },
            { "open": "`", "close": "`" }
        ], 'Incorrect surrounding pairs configuration');
    });
});