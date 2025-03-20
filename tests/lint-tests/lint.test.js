import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEST_DIR = path.join(process.cwd(), 'tests/lint-tests');
const ESLINT_CONFIG = path.join(process.cwd(), 'eslint.config.js');

describe('ESLint Rules', () => {
	// Helper function to run ESLint on a string of code
	const lintCode = (code) => {
		const tempFile = path.join(TEST_DIR, 'temp-test.js');
		fs.writeFileSync(tempFile, code);
		try {
			const result = execSync(`pnpm eslint ${tempFile} --fix --config ${ESLINT_CONFIG}`, { 
				stdio: 'pipe',
				encoding: 'utf8'
			});
			const fixedCode = fs.readFileSync(tempFile, 'utf8');
			fs.unlinkSync(tempFile);
			return fixedCode;
		} catch (error) {
			fs.unlinkSync(tempFile);
			throw error;
		}
	};

	describe('Indentation', () => {
		test('should convert spaces to tabs', () => {
			const code = `
function test() {
    const x = 1;
    if (x) {
        console.log(x);
    }
}`;
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});

		test('should maintain proper indentation in nested structures', () => {
			const code = `
function test() {
    if (true) {
        if (true) {
            if (true) {
                console.log('deeply nested');
            }
        }
    }
}`;
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});
	});

	describe('Blank Lines', () => {
		test('should remove extra blank lines within functions', () => {
			const code = `
function test() {

    const x = 1;

    const y = 2;
    
    return x + y;
}`;
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});

		test('should add blank lines between functions', () => {
			const code = `
function first() {
    return 1;
}
function second() {
    return 2;
}`;
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});
	});

	describe('JSDoc', () => {
		test('should add proper JSDoc to functions', () => {
			const code = `
function test(x, y) {
    return x + y;
}`;
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});

		test('should fix incomplete JSDoc', () => {
			const code = `
/**
 * This function adds numbers
 */
function add(x, y) {
    return x + y;
}`;
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});
	});

	describe('Quotes', () => {
		test('should convert double quotes to single quotes', () => {
			const code = `
const str = "test";
const obj = {"key": "value"};`;
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});
	});

	describe('Complex Cases', () => {
		test('should handle multiple linting issues in one file', () => {
			const code = `
function test(x,y) {
    if(x==y) {
        console.log("equal")
    }
    return x+y
}

function another() {
    const obj = {"key": "value"}
    return obj
}`
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});

		test('should handle async/await functions', () => {
			const code = `
async function test() {
    const result = await fetch("https://api.example.com")
    return result.json()
}`
			const fixed = lintCode(code);
			expect(fixed).toMatchSnapshot();
		});
	});
}); 