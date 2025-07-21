// Test setup file for Jest
import { jest } from '@jest/globals';

// Mock environment variables for tests
process.env.OPENAI_API_KEY = 'sk-test-key-123456789';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 