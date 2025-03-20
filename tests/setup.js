/**
 * Jest setup file
 * Provides necessary browser globals for testing
 */

import { jest } from '@jest/globals';

// Mock window
global.window = {
    innerWidth: 800,
    innerHeight: 600
};

// Mock document
global.document = {
    body: {
        appendChild: jest.fn()
    }
};

// Mock performance
global.performance = {
    now: jest.fn(() => Date.now())
};

// Mock fetch
global.fetch = jest.fn(() => 
    Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
            name: 'Test Scene',
            description: 'Test Scene for Unit Tests',
            version: '1.0.0',
            custom_types: [],
            asset_groups: {
                environment: [],
                props: [],
                characters: []
            },
            scene: {
                background_color: '#000000',
                ambient_light: { intensity: 0.5, color: '#ffffff' }
            }
        })
    })
);

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(callback => setTimeout(callback, 0));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id)); 