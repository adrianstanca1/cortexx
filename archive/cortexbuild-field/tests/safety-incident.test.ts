import { describe, expect, it, vi } from 'vitest';
import { buildIncidentPayload, uploadIncidentPhotos } from '../lib/safety-incident';

describe('safety incident helpers', () => {
  it('builds an incident payload using the selected project and reporter', () => {
    expect(buildIncidentPayload({
      companyId: 3,
      projectId: 42,
      title: '  Trip hazard  ',
      description: '  Cable across walkway  ',
      type: 'near_miss',
      severity: 'critical',
      location: '  Level 2  ',
      reportedBy: 'Alice Site Manager',
      photoUrls: ['https://files.example/photo.jpg'],
      immediateAction: '  Barrier installed  ',
    })).toEqual({
      companyId: 3,
      projectId: 42,
      title: 'Trip hazard',
      description: 'Cable across walkway',
      type: 'near_miss',
      severity: 'critical',
      location: 'Level 2',
      reportedBy: 'Alice Site Manager',
      photoUrls: ['https://files.example/photo.jpg'],
      immediateAction: 'Barrier installed',
      riddorRequired: true,
    });
  });

  it('uploads local incident photos before returning persisted URLs', async () => {
    const readBase64 = vi.fn(async (uri: string) => `base64:${uri}`);
    const upload = vi.fn(async (payload) => ({ url: `https://files.example/${payload.fileName}` }));

    const urls = await uploadIncidentPhotos(
      ['file:///one.jpg', 'file:///two.jpg'],
      7,
      3,
      readBase64,
      upload,
    );

    expect(readBase64).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][0]).toMatchObject({
      companyId: 3,
      mimeType: 'image/jpeg',
      base64Data: 'base64:file:///one.jpg',
      category: 'photo',
      projectId: '7',
      tags: ['incident', 'safety'],
    });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatch(/^https:\/\/files\.example\/incident-7-/);
  });
});
