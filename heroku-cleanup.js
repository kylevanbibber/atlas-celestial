#!/usr/bin/env node
/**
 * Heroku post-build cleanup script
 * Removes unnecessary files and folders to reduce slug size
 */

const fs = require('fs');
const path = require('path');

function removeRecursive(targetPath) {
  if (fs.existsSync(targetPath)) {
    console.log(`Removing: ${targetPath}`);
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

console.log('🧹 Starting Heroku frontend cleanup...');

// Remove source directories (already built into /build)
// These should already be excluded by .slugignore, but cleanup just in case
const dirsToRemove = [
  'src',
  'public'
];

dirsToRemove.forEach(dir => removeRecursive(dir));

// Remove large node_modules subdirectories that aren't needed in production
const nodeModulesCleanup = [
  'node_modules/react-scripts',
  'node_modules/webpack',
  'node_modules/webpack-dev-server',
  'node_modules/@testing-library',
  'node_modules/eslint',
  'node_modules/typescript',
  'node_modules/@babel/core',
  'node_modules/@babel/preset-env',
  'node_modules/@babel/preset-react',
  'node_modules/@types',
  'node_modules/.cache'
];

nodeModulesCleanup.forEach(dir => removeRecursive(dir));

console.log('✅ Cleanup complete!');
