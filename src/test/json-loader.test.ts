import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadCommentedJson, loadCommentedJsonSafe } from '../utils/json-loader.js';

describe('JSON Loader Tests', () => {
    let tempDir: string;
    let testFilePath: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-loader-test-'));
        testFilePath = path.join(tempDir, 'test.json');
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should parse valid JSON without comments', () => {
        const testJson = '{"key": "value", "number": 42}';
        fs.writeFileSync(testFilePath, testJson);
        
        const result = loadCommentedJson(testFilePath);
        assert.deepStrictEqual(result, { key: "value", number: 42 });
    });

    it('should parse JSON with line comments', () => {
        const testJson = `{
    // This is a line comment
    "key": "value", // Another comment
    "number": 42
}`;
        fs.writeFileSync(testFilePath, testJson);
        
        const result = loadCommentedJson(testFilePath);
        assert.deepStrictEqual(result, { key: "value", number: 42 });
    });

    it('should parse JSON with block comments', () => {
        const testJson = `{
    /* This is a block comment */
    "key": "value",
    /* Multi-line
       block comment */
    "number": 42
}`;
        fs.writeFileSync(testFilePath, testJson);
        
        const result = loadCommentedJson(testFilePath);
        assert.deepStrictEqual(result, { key: "value", number: 42 });
    });

    it('should parse JSON with mixed comments', () => {
        const testJson = `{
    // Line comment
    "key": "value", /* inline block comment */
    "number": 42, // another line comment
    /* block comment */
    "bool": true
}`;
        fs.writeFileSync(testFilePath, testJson);
        
        const result = loadCommentedJson(testFilePath);
        assert.deepStrictEqual(result, { key: "value", number: 42, bool: true });
    });

    it('should throw error for invalid JSON', () => {
        const invalidJson = '{"key": "value"'; // Missing closing brace
        fs.writeFileSync(testFilePath, invalidJson);
        
        assert.throws(() => {
            loadCommentedJson(testFilePath);
        }, /JSON/);
    });

    it('should return null for invalid JSON with safe loader', () => {
        const invalidJson = '{"key": "value"'; // Missing closing brace
        fs.writeFileSync(testFilePath, invalidJson);
        
        const result = loadCommentedJsonSafe(testFilePath);
        assert.strictEqual(result, null);
    });

    it('should throw error for non-existent file', () => {
        const nonExistentPath = path.join(tempDir, 'nonexistent.json');
        
        assert.throws(() => {
            loadCommentedJson(nonExistentPath);
        }, /ENOENT/);
    });

    it('should return null for non-existent file with safe loader', () => {
        const nonExistentPath = path.join(tempDir, 'nonexistent.json');
        
        const result = loadCommentedJsonSafe(nonExistentPath);
        assert.strictEqual(result, null);
    });
});