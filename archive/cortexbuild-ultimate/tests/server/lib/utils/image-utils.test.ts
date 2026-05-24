import { describe, it, expect } from 'vitest';
import { estimateBase64Size, processMultipleImages } from '../../../../server/lib/utils/image-utils';

describe('estimateBase64Size', () => {
  it('should return 0 for an empty string', () => {
    expect(estimateBase64Size('')).toBe(0);
  });

  it('should correctly estimate size of a base64 string with no padding', () => {
    // "Man" -> "TWFu" (3 bytes encoded as 4 chars)
    expect(estimateBase64Size('TWFu')).toBe(3);
  });

  it('should correctly estimate size of a base64 string with 1 padding character', () => {
    // "Ma" -> "TWE=" (2 bytes encoded as 4 chars)
    expect(estimateBase64Size('TWE=')).toBe(2);
  });

  it('should correctly estimate size of a base64 string with 2 padding characters', () => {
    // "M" -> "TQ==" (1 byte encoded as 4 chars)
    expect(estimateBase64Size('TQ==')).toBe(1);
  });

  it('should estimate larger strings correctly', () => {
    // Repeating "Man" 10 times -> 30 bytes
    // "TWFu" repeated 10 times = 40 chars
    const base64Data = 'TWFu'.repeat(10);
    expect(estimateBase64Size(base64Data)).toBe(30);
  });
});


describe('processMultipleImages', () => {
  it('should return an empty array when given an empty array', () => {
    expect(processMultipleImages([])).toEqual([]);
  });

  it('should process multiple base64 strings correctly', () => {
    const input = ['base64data1', 'base64data2'];
    const result = processMultipleImages(input);

    expect(result).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'base64data1' } },
      { inlineData: { mimeType: 'image/jpeg', data: 'base64data2' } }
    ]);
  });

  it('should process multiple data URLs correctly', () => {
    const input = [
      'data:image/png;base64,pngdata1',
      'data:image/webp;base64,webpdata2'
    ];
    const result = processMultipleImages(input);

    expect(result).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'pngdata1' } },
      { inlineData: { mimeType: 'image/webp', data: 'webpdata2' } }
    ]);
  });

  it('should apply the optional mimeType parameter to all images', () => {
    const input = ['data1', 'data:image/png;base64,data2'];
    const result = processMultipleImages(input, 'image/gif');

    expect(result).toEqual([
      { inlineData: { mimeType: 'image/gif', data: 'data1' } },
      { inlineData: { mimeType: 'image/gif', data: 'data2' } }
    ]);
  });
});
