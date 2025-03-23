import { JSDOM } from 'jsdom';

// Create a virtual DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
	url: 'http://localhost',
	runScripts: 'dangerously',
	resources: 'usable'
});

// Set up global variables
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock fetch for testing
global.fetch = jest.fn(() =>
	Promise.resolve({
		ok: true,
		json: () => Promise.resolve({}),
		text: () => Promise.resolve('')
	})
);

// Clean up after each test
afterEach(() => {
	jest.clearAllMocks();
	document.body.innerHTML = '';
}); 