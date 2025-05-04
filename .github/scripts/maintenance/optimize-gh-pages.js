#!/usr/bin/env node

/**
 * GitHub Pages Optimization Script
 * 
 * This script optimizes files for GitHub Pages deployment by:
 * 1. Removing source maps
 * 2. Compressing images
 * 3. Optimizing large files
 * 4. Reporting statistics
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Configuration
const CONFIG = {
  // Path to the distribution folder (relative to repo root)
  distPath: 'apps/portfolio/dist',
  
  // Thresholds for optimization
  thresholds: {
    largeImageSize: 500 * 1024, // 500KB
    largeFileSize: 1024 * 1024, // 1MB
    maxFileCount: 10000, // GitHub Pages has limits
  },
  
  // File types to optimize
  fileTypes: {
    // Files to remove entirely
    remove: ['.map', '.DS_Store', 'thumbs.db'],
    
    // Images to compress
    compressImages: ['.png', '.jpg', '.jpeg', '.gif'],
    
    // Large binary files to check
    checkLarge: ['.glb', '.gltf', '.mp4', '.webm', '.obj']
  }
};

// Utilities
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Statistics tracking
const stats = {
  before: {
    totalSize: 0,
    fileCount: 0,
    largeFiles: 0
  },
  after: {
    totalSize: 0,
    fileCount: 0,
    largeFiles: 0
  },
  removed: {
    count: 0,
    size: 0
  },
  compressed: {
    count: 0,
    sizeBefore: 0,
    sizeAfter: 0
  }
};

// Main optimization functions
function removeUnnecessaryFiles(files) {
  console.log(chalk.blue('🧹 Removing unnecessary files...'));
  
  const extensions = CONFIG.fileTypes.remove;
  let removed = 0;
  let removedSize = 0;
  
  files.forEach(file => {
    const ext = path.extname(file);
    if (extensions.includes(ext)) {
      const stats = fs.statSync(file);
      removedSize += stats.size;
      fs.unlinkSync(file);
      console.log(chalk.gray(`  Removed: ${file} (${formatSize(stats.size)})`));
      removed++;
    } else if (file.includes('.map.')) {
      // Handle files like main.js.map
      const stats = fs.statSync(file);
      removedSize += stats.size;
      fs.unlinkSync(file);
      console.log(chalk.gray(`  Removed: ${file} (${formatSize(stats.size)})`));
      removed++;
    }
  });
  
  stats.removed.count = removed;
  stats.removed.size = removedSize;
  
  console.log(chalk.green(`✅ Removed ${removed} files (${formatSize(removedSize)})`));
}

function compressImages(files) {
  console.log(chalk.blue('🖼️ Optimizing images...'));
  
  const imageExtensions = CONFIG.fileTypes.compressImages;
  let compressed = 0;
  let sizeBefore = 0;
  let sizeAfter = 0;
  
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (imageExtensions.includes(ext)) {
      const fileStats = fs.statSync(file);
      
      // Only compress images larger than threshold
      if (fileStats.size > CONFIG.thresholds.largeImageSize) {
        sizeBefore += fileStats.size;
        
        try {
          // Try to compress using built-in tools
          if (ext === '.png') {
            execSync(`pngquant --force --quality=65-80 --skip-if-larger --strip "${file}" --output "${file}"`);
          } else if (['.jpg', '.jpeg'].includes(ext)) {
            execSync(`jpegoptim --max=85 --strip-all "${file}"`);
          } else if (ext === '.gif') {
            execSync(`gifsicle -O3 "${file}" -o "${file}"`);
          }
          
          const newStats = fs.statSync(file);
          sizeAfter += newStats.size;
          
          console.log(chalk.gray(`  Compressed: ${file} (${formatSize(fileStats.size)} → ${formatSize(newStats.size)})`));
          compressed++;
        } catch (error) {
          // If compression tools are not available, resize large images
          if (fileStats.size > CONFIG.thresholds.largeFileSize) {
            try {
              execSync(`convert "${file}" -resize 1024x1024\\> "${file}"`);
              const newStats = fs.statSync(file);
              sizeAfter += newStats.size;
              console.log(chalk.yellow(`  Resized (no compression tools): ${file} (${formatSize(fileStats.size)} → ${formatSize(newStats.size)})`));
              compressed++;
            } catch (resizeError) {
              console.log(chalk.red(`  ❌ Could not optimize: ${file} - missing compression tools`));
              sizeAfter += fileStats.size;
            }
          } else {
            console.log(chalk.yellow(`  Skipped: ${file} - missing compression tools`));
            sizeAfter += fileStats.size;
          }
        }
      } else {
        // Image is already small enough
        sizeBefore += fileStats.size;
        sizeAfter += fileStats.size;
      }
    }
  });
  
  stats.compressed.count = compressed;
  stats.compressed.sizeBefore = sizeBefore;
  stats.compressed.sizeAfter = sizeAfter;
  
  console.log(chalk.green(`✅ Compressed ${compressed} images (${formatSize(sizeBefore - sizeAfter)} saved)`));
}

function checkLargeFiles(files) {
  console.log(chalk.blue('📦 Checking for oversized files...'));
  
  const largeFileExtensions = CONFIG.fileTypes.checkLarge;
  let largeFiles = [];
  
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (largeFileExtensions.includes(ext)) {
      const fileStats = fs.statSync(file);
      if (fileStats.size > CONFIG.thresholds.largeFileSize) {
        largeFiles.push({
          path: file,
          size: fileStats.size
        });
      }
    }
  });
  
  if (largeFiles.length > 0) {
    console.log(chalk.yellow('⚠️ Large files detected that may cause deployment issues:'));
    largeFiles.forEach(file => {
      console.log(chalk.yellow(`  ${file.path} (${formatSize(file.size)})`));
    });
  } else {
    console.log(chalk.green('✅ No problematic large files detected'));
  }
  
  return largeFiles.length;
}

function calculateStatistics(distPath) {
  let totalSize = 0;
  let fileCount = 0;
  let largeFiles = 0;
  
  const files = getAllFiles(distPath);
  
  files.forEach(file => {
    const stats = fs.statSync(file);
    totalSize += stats.size;
    fileCount++;
    
    if (stats.size > CONFIG.thresholds.largeFileSize) {
      largeFiles++;
    }
  });
  
  return {
    totalSize,
    fileCount,
    largeFiles,
    files
  };
}

// Main function
function main() {
  const distPath = path.resolve(process.cwd(), CONFIG.distPath);
  
  if (!fs.existsSync(distPath)) {
    console.log(chalk.red(`❌ Distribution folder not found: ${distPath}`));
    process.exit(1);
  }
  
  console.log(chalk.blue('🚀 Starting GitHub Pages optimization...'));
  console.log(chalk.gray(`Working directory: ${distPath}`));
  
  // Calculate statistics before optimization
  const beforeStats = calculateStatistics(distPath);
  stats.before = {
    totalSize: beforeStats.totalSize,
    fileCount: beforeStats.fileCount,
    largeFiles: beforeStats.largeFiles
  };
  
  console.log(chalk.blue(`📊 Before optimization: ${beforeStats.fileCount} files (${formatSize(beforeStats.totalSize)})`));
  
  // Run optimizations
  removeUnnecessaryFiles(beforeStats.files);
  compressImages(beforeStats.files.filter(f => fs.existsSync(f))); // Filter out removed files
  checkLargeFiles(beforeStats.files.filter(f => fs.existsSync(f)));
  
  // Calculate statistics after optimization
  const afterStats = calculateStatistics(distPath);
  stats.after = {
    totalSize: afterStats.totalSize,
    fileCount: afterStats.fileCount,
    largeFiles: afterStats.largeFiles
  };
  
  // Report results
  const sizeDiff = stats.before.totalSize - stats.after.totalSize;
  const fileDiff = stats.before.fileCount - stats.after.fileCount;
  
  console.log(chalk.blue('\n📊 Optimization Summary:'));
  console.log(chalk.green(`✅ Total size reduction: ${formatSize(sizeDiff)} (${(sizeDiff / stats.before.totalSize * 100).toFixed(2)}%)`));
  console.log(chalk.green(`✅ Files removed: ${fileDiff}`));
  console.log(chalk.green(`✅ Before: ${stats.before.fileCount} files (${formatSize(stats.before.totalSize)})`));
  console.log(chalk.green(`✅ After: ${stats.after.fileCount} files (${formatSize(stats.after.totalSize)})`));
  
  if (stats.after.fileCount > CONFIG.thresholds.maxFileCount) {
    console.log(chalk.yellow(`⚠️ Warning: File count (${stats.after.fileCount}) exceeds recommended limit (${CONFIG.thresholds.maxFileCount})`));
  }
  
  // Exit with appropriate code
  if (sizeDiff > 0) {
    console.log(chalk.green('✅ Optimization completed successfully!'));
    process.exit(0);
  } else {
    console.log(chalk.yellow('⚠️ No significant optimization achieved.'));
    process.exit(0); // Still exit with 0 to not fail the build
  }
}

// Run the main function
main(); 