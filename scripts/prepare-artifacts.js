/**
 * Prepare artifacts for deployment
 * This script handles the preparation of artifacts for deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');

// Ensure artifacts directory exists
if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// Copy necessary files to artifacts directory
const filesToCopy = [
    {
        src: path.join(__dirname, '..', 'packages', 'blorkpack', 'dist'),
        dest: path.join(ARTIFACTS_DIR, 'blorkpack')
    },
    {
        src: path.join(__dirname, '..', 'packages', 'blorktools', 'dist'),
        dest: path.join(ARTIFACTS_DIR, 'blorktools')
    },
    // Add coverage report to artifacts
    {
        src: path.join(__dirname, '..', 'coverage-report'),
        dest: path.join(ARTIFACTS_DIR, 'coverage-report')
    }
];

// Copy directories recursively
function copyDir(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`Warning: Source directory ${src} does not exist, skipping.`);
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Process each file/directory to copy
for (const { src, dest } of filesToCopy) {
    if (fs.existsSync(src)) {
        console.log(`Copying ${src} to ${dest}`);
        copyDir(src, dest);
    } else {
        console.warn(`Warning: Source path ${src} does not exist`);
    }
}

// Generate a summary file with timestamp
const summaryPath = path.join(ARTIFACTS_DIR, 'build-summary.json');
const summary = {
    timestamp: new Date().toISOString(),
    artifacts: filesToCopy.map(f => path.basename(f.dest)),
    buildNumber: process.env.BUILD_NUMBER || 'local'
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(`Generated build summary at ${summaryPath}`);

console.log('Artifact preparation completed successfully!'); 