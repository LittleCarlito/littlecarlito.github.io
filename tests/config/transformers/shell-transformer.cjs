/**
 * Shell script transformer for Jest
 * Converts shell scripts to string modules for coverage
 */

module.exports = {
	process(sourceText, sourcePath) {
		return {
			code: `module.exports = ${JSON.stringify(sourceText)};`,
		};
	}
}; 