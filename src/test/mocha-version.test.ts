const assert = require('assert');
const { execSync } = require('child_process');

describe('Mocha Version Test', () => {
    it('should verify Mocha version is greater than 11', () => {
        const mochaVersion = execSync('mocha --version').toString().trim();
        const majorVersion = parseInt(mochaVersion.split('.')[0], 10);
        assert.ok(majorVersion >= 11, `Expected Mocha version >= 11, but got ${mochaVersion}`);
    });
});