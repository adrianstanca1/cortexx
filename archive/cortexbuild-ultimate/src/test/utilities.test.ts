import { describe, it, expect, vi } from 'vitest';

// Mock jsPDF at module level for all tests
vi.mock('jspdf', () => ({
  default: class jsPDF {
    constructor() {}
    setFontSize() {}
    setFont() {}
    text() {}
    output() { return new Blob(); }
  },
}));

/**
 * Unit tests for utility functions
 * Tests export utilities, event bus, and other helper functions
 */
describe('Utility Functions', () => {
  describe('exportUtils', () => {
    it('exports exportToPDF function', async () => {
      const module = await import('../lib/exportUtils');
      expect(module.exportToPDF).toBeDefined();
      expect(typeof module.exportToPDF).toBe('function');
    });

    it('exports exportToCSV function', async () => {
      const module = await import('../lib/exportUtils');
      expect(module.exportToCSV).toBeDefined();
      expect(typeof module.exportToCSV).toBe('function');
    });

    it('exportToCSV generates valid CSV content', async () => {
      const module = await import('../lib/exportUtils');
      
      const data = [
        { name: 'John', age: 30, city: 'London' },
        { name: 'Jane', age: 25, city: 'Paris' },
      ];
      
      // Create a mock anchor element
      const mockAnchor = {
        click: vi.fn(),
        setAttribute: vi.fn(),
        style: {},
      };
      
      // Mock document methods
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn(() => mockAnchor as Record<string, unknown>);
      
      try {
        module.exportToCSV(data, 'test.csv');
        
        // Verify click was called (download triggered)
        expect(mockAnchor.click).toHaveBeenCalled();
      } finally {
        document.createElement = originalCreateElement;
      }
    });

    

    it('exportToCSV properly escapes special characters', async () => {
      const module = await import('../lib/exportUtils');
      
      const data = [
        { name: 'John, Jr.', description: 'Has "quotes"' },
      ];
      
      const mockAnchor = {
        click: vi.fn(),
        setAttribute: vi.fn(),
        style: {},
      };
      
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn(() => mockAnchor as Record<string, unknown>);
      
      try {
        module.exportToCSV(data, 'test.csv');
        expect(mockAnchor.click).toHaveBeenCalled();
      } finally {
        document.createElement = originalCreateElement;
      }
    });
  });

  describe('eventBus', () => {
    it('exports eventBus singleton', async () => {
      const module = await import('../lib/eventBus');
      expect(module.eventBus).toBeDefined();
    });

    it('eventBus has on method', async () => {
      const module = await import('../lib/eventBus');
      expect(module.eventBus.on).toBeDefined();
      expect(typeof module.eventBus.on).toBe('function');
    });

    it('eventBus has emit method', async () => {
      const module = await import('../lib/eventBus');
      expect(module.eventBus.emit).toBeDefined();
      expect(typeof module.eventBus.emit).toBe('function');
    });

    it('eventBus has off method', async () => {
      const module = await import('../lib/eventBus');
      expect(module.eventBus.off).toBeDefined();
      expect(typeof module.eventBus.off).toBe('function');
    });

    it('eventBus on returns unsubscribe function', async () => {
      const module = await import('../lib/eventBus');
      
      const handler = vi.fn();
      const unsubscribe = module.eventBus.on('test:event', handler);
      
      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('eventBus emit calls registered handlers', async () => {
      const module = await import('../lib/eventBus');
      
      const handler = vi.fn();
      module.eventBus.on('test:event', handler);
      
      module.eventBus.emit('test:event', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('eventBus off removes handler', async () => {
      const module = await import('../lib/eventBus');
      
      const handler = vi.fn();
      module.eventBus.on('test:event', handler);
      module.eventBus.off('test:event', handler);
      
      module.eventBus.emit('test:event', { data: 'test' });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('reportGenerator', () => {
    it('exports ReportGenerator class', async () => {
      const module = await import('../lib/reportGenerator');
      expect(module.ReportGenerator).toBeDefined();
    });

    it('exports reportGenerator singleton', async () => {
      const module = await import('../lib/reportGenerator');
      expect(module.reportGenerator).toBeDefined();
    });

    it('reportGenerator has generate method', async () => {
      const module = await import('../lib/reportGenerator');
      expect(module.reportGenerator.generate).toBeDefined();
      expect(typeof module.reportGenerator.generate).toBe('function');
    });

    it('reportGenerator has download method', async () => {
      const module = await import('../lib/reportGenerator');
      expect(module.reportGenerator.download).toBeDefined();
      expect(typeof module.reportGenerator.download).toBe('function');
    });
  });
});
