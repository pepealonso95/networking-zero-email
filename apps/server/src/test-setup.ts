// Test setup file for Jest
import { jest } from '@jest/globals';

// Mock environment variables for tests (unless already set for integration tests)
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-test-key-123456789') {
  process.env.OPENAI_API_KEY = 'sk-test-key-123456789';
}
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

// Global test utilities - Enable for debug
// global.console = {
//   ...console,
//   // Suppress console.log in tests unless explicitly needed
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// }; 