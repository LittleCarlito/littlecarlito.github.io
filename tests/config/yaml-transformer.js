/**
 * YAML transformer for Jest
 * Transforms YAML files into JS objects for testing
 */
const yaml = require('js-yaml');
const fs = require('fs');

module.exports = {
	process(sourceText, sourcePath) {
		try {
			const result = yaml.load(sourceText);
			return {
				code: `module.exports = ${JSON.stringify(result, null, 2)};`,
			};
		} catch (error) {
			console.error(`Error processing YAML file ${sourcePath}:`, error);
			return {
				code: `module.exports = {};`,
			};
		}
	}
}; 