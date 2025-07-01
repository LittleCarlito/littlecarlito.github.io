#!/usr/bin/env node

/**
 * Quality Check Script
 * 
 * Analyzes the monorepo for quality issues and reports findings.
 * Designed to be easily extensible for additional quality checks.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const PACKAGE_DIRS = ['packages', 'apps'];
const QUALITY_THRESHOLDS = {
	maxLines: 1000,
};

class QualityChecker {
	constructor() {
		this.issues = [];
		this.stats = {
			filesChecked: 0,
			issuesFound: 0,
		};
	}

	addIssue(type, file, details) {
		this.issues.push({
			type,
			file: path.relative(process.cwd(), file),
			details,
		});
		this.stats.issuesFound++;
	}

	checkLineLength(filePath) {
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			const lines = content.split('\n');
			const lineCount = lines.length;
			
			if (lineCount > QUALITY_THRESHOLDS.maxLines) {
				this.addIssue('line-length', filePath, {
					actual: lineCount,
					threshold: QUALITY_THRESHOLDS.maxLines,
					excess: lineCount - QUALITY_THRESHOLDS.maxLines,
				});
			}
		} catch (error) {
			console.warn(`⚠️ Could not read file: ${filePath}`);
		}
	}

	shouldCheckFile(filePath) {
		const ext = path.extname(filePath).toLowerCase();
		const jsExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
		
		if (!jsExtensions.includes(ext)) {
			return false;
		}
		
		const relativePath = path.relative(process.cwd(), filePath);
		const excludePatterns = [
			'node_modules',
			'dist',
			'build',
			'coverage',
			'.git',
			'artifacts',
			'pipeline-artifacts',
		];
		
		return !excludePatterns.some(pattern => relativePath.includes(pattern));
	}

	scanDirectory(dir) {
		if (!fs.existsSync(dir)) {
			return;
		}

		const entries = fs.readdirSync(dir, { withFileTypes: true });
		
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			
			if (entry.isDirectory()) {
				this.scanDirectory(fullPath);
			} else if (entry.isFile() && this.shouldCheckFile(fullPath)) {
				this.stats.filesChecked++;
				this.checkLineLength(fullPath);
			}
		}
	}

	runQualityChecks() {
		console.log('🔍 Running quality checks...');
		
		PACKAGE_DIRS.forEach(dirName => {
			const dir = path.join(process.cwd(), dirName);
			if (fs.existsSync(dir)) {
				this.scanDirectory(dir);
			}
		});

		const rootFiles = fs.readdirSync(process.cwd(), { withFileTypes: true });
		for (const entry of rootFiles) {
			if (entry.isFile() && this.shouldCheckFile(path.join(process.cwd(), entry.name))) {
				this.stats.filesChecked++;
				this.checkLineLength(path.join(process.cwd(), entry.name));
			}
		}

		this.reportResults();
	}

	reportResults() {
		if (this.issues.length === 0) {
			console.log('✅ Quality checks passed!');
			return;
		}

		const issuesByType = this.groupIssuesByType();
		
		for (const [type, typeIssues] of Object.entries(issuesByType)) {
			this.reportIssueType(type, typeIssues);
		}

		console.log(`❌ Found ${this.stats.issuesFound} quality issues`);
		process.exit(1);
	}

	groupIssuesByType() {
		const grouped = {};
		for (const issue of this.issues) {
			if (!grouped[issue.type]) {
				grouped[issue.type] = [];
			}
			grouped[issue.type].push(issue);
		}
		return grouped;
	}

	reportIssueType(type, issues) {
		switch (type) {
			case 'line-length':
				this.reportLineLengthIssues(issues);
				break;
			default:
				console.log(`❌ ${type}: ${issues.length} issues`);
				issues.forEach(issue => {
					console.log(`   ${issue.file}`);
				});
		}
	}

	reportLineLengthIssues(issues) {
		console.log(`❌ Files over ${QUALITY_THRESHOLDS.maxLines} lines:`);

		issues.sort((a, b) => b.details.actual - a.details.actual);

		issues.forEach((issue) => {
			const { actual, excess } = issue.details;
			console.log(`   ${issue.file} (${actual} lines, ${excess} over limit)`);
		});
	}
}

function main() {
	const checker = new QualityChecker();
	checker.runQualityChecks();
}

if (require.main === module) {
	main();
}

module.exports = QualityChecker;