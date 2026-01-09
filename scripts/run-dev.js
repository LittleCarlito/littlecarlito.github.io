/**
 * Script to run the 3d-portfolio dev command
 */

const { execSync } = require('child_process');

console.log('Running 3d-portfolio dev script...');

try {
  execSync('pnpm --filter="@littlecarlito/3d-portfolio" dev', {
    stdio: 'inherit',
    shell: true
  });
} catch (error) {
  console.error('Error running 3d-portfolio dev script:', error.message);
  process.exit(1);
}
