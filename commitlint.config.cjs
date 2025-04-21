module.exports = {
	extends: ['@commitlint/config-conventional'],
	ignores: [
		// Ignore GitHub's auto-generated squash commit messages
		(message) => /^.+\(#\d+\)$/m.test(message)
	],
	rules: {
		'body-leading-blank': [1, 'always'],
		'body-max-line-length': [2, 'always', 100],
		'footer-leading-blank': [1, 'always'],
		'footer-max-line-length': [2, 'always', 100],
		'header-max-length': [2, 'always', 100],
		'subject-case': [
			2,
			'never',
			['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
		],
		'subject-empty': [2, 'never'],
		'subject-full-stop': [2, 'never', '.'],
		'type-case': [2, 'always', 'lower-case'],
		'type-empty': [2, 'never'],
		'type-enum': [
			2,
			'always',
			[
				'build',
				'chore',
				'ci',
				'docs',
				'feat',
				'fix',
				'perf',
				'refactor',
				'revert',
				'slice',
				'style',
				'test'
			],
		],
		// Define valid scopes
		'scope-enum': [
			2,
			'always',
			[
				'blorkboard',
				'blorkpack',
				'blorktools',
				'portfolio',
				'common',
				'core',
				'docs',
				'pipeline',
				'release',
				'no-release',
				'tests'
			]
		],
		// Ensure scopes are lowercase
		'scope-case': [2, 'always', 'lower-case'],
		// Allow multiple scopes with comma delimiter
		'scope-empty': [0, 'never'],
	},
	parserPreset: {
		parserOpts: {
			headerPattern: /^(\w*)(?:\(([\w,]+)\))?: (.*)$/,
			headerCorrespondence: ['type', 'scope', 'subject']
		}
	},
	plugins: [
		{
			rules: {
				'manual-versioning-check': (parsed) => {
					const { type, scope } = parsed;
					
					// Check if the commit would trigger a version bump
					let willTriggerBump = false;
					let bumpType = null;
					
					// Do not trigger releases for no-release or pipeline scopes
					if (scope === 'no-release' || scope === 'pipeline' || scope === 'tests') {
						return [true, `Commit will not trigger a version bump (${scope} scope)`];
					}
					
					// Check for breaking changes
					if (parsed.header.includes('!')) {
						willTriggerBump = true;
						bumpType = 'major';
					} else if (type === 'feat') {
						willTriggerBump = true;
						bumpType = 'minor';
					} else if (['fix', 'perf'].includes(type)) {
						willTriggerBump = true;
						bumpType = 'patch';
					} else if (['docs', 'style', 'refactor', 'test', 'chore', 'build'].includes(type)) {
						// These may or may not trigger a release depending on config
						willTriggerBump = true;
						bumpType = 'patch (potentially)';
					}
					
					if (willTriggerBump) {
						return [true, `Commit will trigger a ${bumpType} version bump`];
					} else {
						return [true, 'Commit will not trigger a version bump'];
					}
				}
			}
		}
	]
}; 