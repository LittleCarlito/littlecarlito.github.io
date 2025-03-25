const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Force jest to recognize this as a test file
const test = global.test || jest.test;
const describe = global.describe || jest.describe;
const expect = global.expect || jest.expect;
const beforeAll = global.beforeAll || jest.beforeAll;

describe('GitHub Pages Workflow Configuration', () => {
	const workflowFilePath = path.resolve(__dirname, '../../.github/workflows/ci-main.yml');
	let workflowConfig;

	beforeAll(() => {
		// Load the workflow file
		const workflowContent = fs.readFileSync(workflowFilePath, 'utf8');
		workflowConfig = yaml.load(workflowContent);
	});

	test('workflow file exists', () => {
		expect(fs.existsSync(workflowFilePath)).toBe(true);
	});

	test('workflow has GitHub Pages permissions', () => {
		expect(workflowConfig.permissions).toBeDefined();
		expect(workflowConfig.permissions.pages).toBe('write');
		expect(workflowConfig.permissions).toHaveProperty('id-token');
	});

	test('workflow has build-site job for GitHub Pages', () => {
		expect(workflowConfig.jobs['build-site']).toBeDefined();
		const buildSiteJob = workflowConfig.jobs['build-site'];
    
		// Check for GitHub Pages environment
		expect(buildSiteJob.environment).toBeDefined();
		expect(buildSiteJob.environment.name).toBe('github-pages');
	});

	test('build-site job includes GITHUB_PAGES environment variable', () => {
		const buildSiteJob = workflowConfig.jobs['build-site'];
    
		// Find the build step
		const buildStep = buildSiteJob.steps.find(step => 
			step.name && step.name.includes('Build for GitHub Pages')
		);
    
		expect(buildStep).toBeDefined();
		expect(buildStep.run).toContain('GITHUB_PAGES=true');
	});

	test('workflow ensures _headers file is copied to dist', () => {
		const buildSiteJob = workflowConfig.jobs['build-site'];
    
		// Find the headers copy step
		const headersStep = buildSiteJob.steps.find(step => 
			step.name && step.name.includes('_headers')
		);
    
		expect(headersStep).toBeDefined();
		expect(headersStep.run).toContain('cp apps/portfolio/public/_headers apps/portfolio/dist/');
	});

	test('workflow ensures .nojekyll file is created', () => {
		const buildSiteJob = workflowConfig.jobs['build-site'];
    
		// Find the nojekyll step
		const nojekyllStep = buildSiteJob.steps.find(step => 
			step.name && step.name.includes('.nojekyll')
		);
    
		expect(nojekyllStep).toBeDefined();
		expect(nojekyllStep.run).toContain('touch apps/portfolio/dist/.nojekyll');
	});

	test('workflow includes proper deployment step', () => {
		const buildSiteJob = workflowConfig.jobs['build-site'];
		
		// Find the deployment step
		const deployStep = buildSiteJob.steps.find(step => 
			step.name === 'Deploy to GitHub Pages'
		);
		
		expect(deployStep).toBeDefined();
		expect(deployStep.uses).toBe('actions/deploy-pages@v4');
		expect(deployStep.id).toBe('deployment');
		
		// Check for upload artifact step
		const uploadStep = buildSiteJob.steps.find(step =>
			step.name === 'Upload artifact'
		);
		expect(uploadStep).toBeDefined();
		expect(uploadStep.uses).toBe('actions/upload-pages-artifact@v3');
		expect(uploadStep.with.path).toBe('apps/portfolio/dist');
	});
}); 