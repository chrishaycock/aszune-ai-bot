/**
 * Tests for testUtils-helper.js
 */
const { createMockObject, delay, deepClone } = require('../../src/utils/testUtils-helper');

describe('Test Utils Helper', () => {
  describe('createMockObject', () => {
    it('creates mock functions for all methods in an object', () => {
      const baseObj = {
        method1: () => {},
        method2: () => {},
        property1: 'value1'
      };

      const mockObj = createMockObject(baseObj);

      expect(typeof mockObj.method1).toBe('function');
      expect(typeof mockObj.method2).toBe('function');
      expect(mockObj.property1).toBe('value1');
      expect(jest.isMockFunction(mockObj.method1)).toBe(true);
      expect(jest.isMockFunction(mockObj.method2)).toBe(true);
    });
  });

  describe('delay', () => {
    it('returns a promise that resolves after specified time', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      
      // Allow some flexibility in timing
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe('deepClone', () => {
    it('creates a deep clone of an object', () => {
      const original = {
        prop1: 'value1',
        nested: {
          prop2: 'value2',
          array: [1, 2, { key: 'value' }]
        }
      };

      const clone = deepClone(original);
      
      // Should be equal in value
      expect(clone).toEqual(original);
      
      // But not the same reference
      expect(clone).not.toBe(original);
      expect(clone.nested).not.toBe(original.nested);
      expect(clone.nested.array).not.toBe(original.nested.array);
      
      // Modifying the clone should not affect the original
      clone.nested.prop2 = 'changed';
      clone.nested.array[2].key = 'changed';
      expect(original.nested.prop2).toBe('value2');
      expect(original.nested.array[2].key).toBe('value');
    });
  });
});
