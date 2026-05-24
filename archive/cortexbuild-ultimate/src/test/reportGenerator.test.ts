import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerator } from '../lib/reportGenerator';

import autoTable from 'jspdf-autotable';

// Mock jsPDF correctly as a constructor
vi.mock('jspdf', () => {
  const MockJsPDF = class {
    setFontSize = vi.fn();
    setFont = vi.fn();
    text = vi.fn();
    splitTextToSize = vi.fn((text) => [text]); // mock simple split
    output = vi.fn(() => new Blob(['mock-pdf']));
    lastAutoTable = { finalY: 100 };
  };
  return { default: MockJsPDF };
});

// Mock jspdf-autotable
vi.mock('jspdf-autotable', () => {
  return { default: vi.fn() };
});

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new ReportGenerator();

    // Mock global URL
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock document.createElement
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
  });

  describe('generate', () => {
    it('should sanitize title and subtitle, and output a blob', async () => {
      const config = {
        title: '<script>alert("xss")</script>My Report',
        subtitle: 'Subtitle <with> tags',
        sections: []
      };

      const result = await generator.generate(config as Parameters<typeof generator.generate>[0]);

      expect(result).toBeInstanceOf(Blob);

      // Access the doc instance directly to verify calls since we can't easily spy on the class constructor return
      const doc = (generator as unknown as { doc: { text: (text: string | string[], x: number, y: number) => void, splitTextToSize: (text: string, maxW: number) => string[] } }).doc;

      // It should strip out < and >
      expect(doc.text).toHaveBeenCalledWith('scriptalert("xss")/scriptMy Report', 14, 20);
      expect(doc.text).toHaveBeenCalledWith('Subtitle with tags', 14, 28);
    });

    it('should process text section', async () => {
      const config = {
        title: 'Test',
        sections: [
          { type: 'text', title: 'Text Section', data: 'Some text content' }
        ]
      };

      await generator.generate(config as Parameters<typeof generator.generate>[0]);

      const doc = (generator as unknown as { doc: { text: (text: string | string[], x: number, y: number) => void, splitTextToSize: (text: string, maxW: number) => string[] } }).doc;

      expect(doc.text).toHaveBeenCalledWith('Text Section', 14, expect.any(Number));
      expect(doc.text).toHaveBeenCalledWith(['Some text content'], 14, expect.any(Number));
      expect(doc.splitTextToSize).toHaveBeenCalledWith('Some text content', 180);
    });

    it('should process table section', async () => {
      const config = {
        title: 'Test',
        sections: [
          {
            type: 'table',
            title: 'Table Section',
            data: { columns: ['A', 'B'], rows: [['1', '2']] }
          }
        ]
      };

      await generator.generate(config as Parameters<typeof generator.generate>[0]);

      const doc = (generator as unknown as { doc: { text: (text: string | string[], x: number, y: number) => void, splitTextToSize: (text: string, maxW: number) => string[] } }).doc;

      expect(doc.text).toHaveBeenCalledWith('Table Section', 14, expect.any(Number));
      expect(autoTable).toHaveBeenCalledWith(doc, expect.objectContaining({
        head: [['A', 'B']],
        body: [['1', '2']]
      }));
    });

    it('should process kpi section', async () => {
      const config = {
        title: 'Test',
        sections: [
          {
            type: 'kpi',
            title: 'KPI Section',
            data: [
              { label: 'Users', value: 100 },
              { label: 'Revenue', value: '$500' }
            ]
          }
        ]
      };

      await generator.generate(config as Parameters<typeof generator.generate>[0]);

      const doc = (generator as unknown as { doc: { text: (text: string | string[], x: number, y: number) => void, splitTextToSize: (text: string, maxW: number) => string[] } }).doc;

      expect(doc.text).toHaveBeenCalledWith('KPI Section', 14, expect.any(Number));
      expect(doc.text).toHaveBeenCalledWith('Users', 14, expect.any(Number));
      expect(doc.text).toHaveBeenCalledWith('100', 14, expect.any(Number));
      expect(doc.text).toHaveBeenCalledWith('Revenue', 74, expect.any(Number)); // 14 + 60 = 74
      expect(doc.text).toHaveBeenCalledWith('$500', 74, expect.any(Number));
    });
  });

  describe('download', () => {
    it('should generate PDF and trigger download', async () => {
      const config = { title: 'Test', sections: [] };
      await generator.download(config as Parameters<typeof generator.generate>[0], 'test.pdf');

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');

      const mockLink = vi.mocked(document.createElement).mock.results[0].value;
      expect(mockLink.href).toBe('mock-url');
      expect(mockLink.download).toBe('test.pdf');
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });
  });
});
