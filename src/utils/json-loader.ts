import * as fs from 'fs';
import { parse } from 'jsonc-parser';

/**
 * Loads and parses a JSON file with comment support using jsonc-parser
 */
export function loadCommentedJson(filePath: string): any {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parse(content);
    if (result === undefined) {
        throw new Error('Invalid JSON format');
    }
    return result;
}

/**
 * Loads and parses a JSON file with comment support, with error handling
 */
export function loadCommentedJsonSafe(filePath: string): any | null {
    try {
        return loadCommentedJson(filePath);
    } catch (error) {
        return null;
    }
}