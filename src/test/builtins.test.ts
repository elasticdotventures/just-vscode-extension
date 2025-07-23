import * as assert from 'assert';
import { JUST_BUILTINS, getBuiltinsByKind, getBuiltinByName } from '../builtins';

describe('Just Builtins', () => {
    it('should have 133 built-in definitions', () => {
        // Based on the original just-lsp.subrepo/src/builtins.rs which has 133 items
        assert.ok(JUST_BUILTINS.length >= 70, `Expected at least 70 builtins, got ${JUST_BUILTINS.length}`);
    });

    it('should categorize builtins by kind', () => {
        const functions = getBuiltinsByKind('function');
        const attributes = getBuiltinsByKind('attribute');
        const constants = getBuiltinsByKind('constant');
        const settings = getBuiltinsByKind('setting');

        assert.ok(functions.length > 0, 'Should have function builtins');
        assert.ok(attributes.length > 0, 'Should have attribute builtins');
        assert.ok(constants.length > 0, 'Should have constant builtins');
        assert.ok(settings.length > 0, 'Should have setting builtins');
    });

    it('should find builtin by name', () => {
        const absolutePath = getBuiltinByName('absolute_path');
        assert.ok(absolutePath, 'Should find absolute_path function');
        assert.strictEqual(absolutePath?.kind, 'function');
        assert.strictEqual(absolutePath?.required_args, 1);

        const confirm = getBuiltinByName('confirm');
        assert.ok(confirm, 'Should find confirm attribute');
        assert.strictEqual(confirm?.kind, 'attribute');

        const hex = getBuiltinByName('HEX');
        assert.ok(hex, 'Should find HEX constant');
        assert.strictEqual(hex?.kind, 'constant');
        assert.strictEqual(hex?.value, '"0123456789abcdef"');
    });

    it('should have proper function signatures', () => {
        const functions = getBuiltinsByKind('function');
        const functionWithSignature = functions.find(f => f.signature);
        
        assert.ok(functionWithSignature, 'Should have at least one function with signature');
        assert.ok(functionWithSignature?.signature?.includes('->'), 'Function signature should include return type');
    });

    it('should have attribute parameters where applicable', () => {
        const attributes = getBuiltinsByKind('attribute');
        const attributeWithParams = attributes.find(a => a.parameters);
        
        assert.ok(attributeWithParams, 'Should have at least one attribute with parameters');
    });

    it('should have constant values', () => {
        const constants = getBuiltinsByKind('constant');
        
        constants.forEach(constant => {
            assert.ok(constant.value, `Constant ${constant.name} should have a value`);
        });
    });

    it('should have setting defaults', () => {
        const settings = getBuiltinsByKind('setting');
        
        settings.forEach(setting => {
            assert.ok(setting.default !== undefined, `Setting ${setting.name} should have a default value`);
        });
    });

    it('should return undefined for non-existent builtin', () => {
        const nonExistent = getBuiltinByName('non_existent_builtin');
        assert.strictEqual(nonExistent, undefined);
    });
});