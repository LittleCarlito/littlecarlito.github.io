# GitHub Pages Deployment

This document explains how the project is set up for GitHub Pages deployment, how path resolution works, and how to test GitHub Pages compatibility locally.

## Path Resolution

The project uses a central configuration in `apps/portfolio/common/path_config.js` for handling GitHub Pages path resolution. When deployed to GitHub Pages, all assets must be accessed with a base path prefix of `/threejs_site/`.

### Key Components

1. **Central Variable**: The repository name is defined in one place:
   ```javascript
   export const GITHUB_PAGES_BASE = 'threejs_site';
   ```

2. **Path Resolution**: The `getBasePath()` function returns the appropriate base path depending on the environment:
   ```javascript
   export function getBasePath() {
     const isGitHubPages = 
       window.location.hostname === 'littlecarlito.github.io' || 
       window.location.pathname.includes(`${GITHUB_PAGES_BASE}/`);
     
     return isGitHubPages ? `${GITHUB_PAGES_BASE}/` : '';
   }
   ```

3. **Vite Config**: The build configuration in `apps/portfolio/vite.config.js` uses the same variable:
   ```javascript
   const GITHUB_PAGES_BASE = 'threejs_site';
   const isGitHubPages = process.env.GITHUB_PAGES === 'true';
   const base = isGitHubPages ? `${GITHUB_PAGES_BASE}/` : '/';
   ```

## Resource Loading

The project handles resource loading with fallbacks to ensure compatibility with both local development and GitHub Pages:

1. **Manifest Loading**: The `ManifestManager` attempts to load the manifest from multiple paths:
   ```javascript
   const pathsToTry = [
     relativePath,                    // Try the provided path directly
     `/${relativePath}`.replace(/\/+/g, '/'), // With leading slash
     `${basePath}${relativePath}`.replace(/\/+/g, '/'), // With base path
     'manifest.json',                 // In root directory
     `${basePath}manifest.json`.replace(/\/+/g, '/')  // Root with base path
   ];
   ```

2. **Asset Copying**: During build, resources are copied to both their original location and the root:
   ```javascript
   fs.copyFileSync(manifestSrc, manifestDest);
   // Also copy to the root directory for easier access
   fs.copyFileSync(manifestSrc, path.resolve(__dirname, 'dist/manifest.json'));
   ```

## Testing GitHub Pages Locally

To ensure your changes will work correctly on GitHub Pages, you should test with the GitHub Pages environment enabled.

### Available Scripts

- **`pnpm test:gh-pages`**: Runs build integrity tests with GitHub Pages mode enabled
- **`pnpm verify-gh-pages`**: Performs a full build with GitHub Pages mode and runs integrity tests

### Pre-Push Hook

The repository includes a pre-push Git hook that automatically tests GitHub Pages compatibility before allowing a push. This helps catch path resolution issues early.

### Manual Testing Steps

1. **Build with GitHub Pages mode**:
   ```bash
   GITHUB_PAGES=true pnpm build
   ```

2. **Run the integrity tests**:
   ```bash
   pnpm test:gh-pages
   ```

3. **Verify resource loading**:
   - Check that manifest.json is copied to the correct locations
   - Ensure all assets are accessible with the correct base path
   - Test that the application initializes correctly with GitHub Pages paths

## Common Issues

1. **404 Errors**: Usually caused by resources not being found with the GitHub Pages base path.
   - Solution: Use the central `GITHUB_PAGES_BASE` variable and path resolution functions.

2. **Manifest Loading Failures**: The manifest might not be loading from the expected location.
   - Solution: Make sure the manifest is copied to both the resources directory and the root.

3. **Asset Path Resolution**: Images or other assets not loading properly.
   - Solution: Use the `resolvePath()` function for all asset paths.

## Pull Request Checklist

Before submitting a PR, make sure to:

1. Run `pnpm test:gh-pages` to check GitHub Pages compatibility
2. Test path-related changes with both regular and GitHub Pages environments
3. Verify resource loading with the GitHub Pages base path 