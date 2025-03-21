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
				'common',
				'core',
				'docs',
				'release',
				'no-release'
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
				'semantic-versioning-check': (parsed) => {
					const { type, scope } = parsed;
					
					// Check if the commit would trigger a release
					let willTriggerRelease = false;
					let releaseType = null;
					
					if (scope === 'no-release') {
						return [true, 'Commit will not trigger a release (no-release scope)'];
					}
					
					if (type === 'feat') {
						willTriggerRelease = true;
						releaseType = 'minor';
					} else if (['fix', 'perf'].includes(type)) {
						willTriggerRelease = true;
						releaseType = 'patch';
					} else if (['docs', 'style', 'refactor', 'test', 'chore', 'build'].includes(type)) {
						// These may or may not trigger a release depending on config
						willTriggerRelease = true;
						releaseType = 'patch (potentially)';
					}
					
					if (willTriggerRelease) {
						return [true, `Commit will trigger a ${releaseType} release`];
					} else {
						return [true, 'Commit will not trigger a release'];
					}
				}
			}
		}
	]
}; 