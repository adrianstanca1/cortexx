type UploadIncidentPhoto = (input: {
  companyId: number;
  fileName: string;
  mimeType: string;
  base64Data: string;
  category: 'photo';
  projectId: string;
  tags: string[];
}) => Promise<{ url: string }>;

export type BuildIncidentPayloadInput = {
  companyId: number;
  projectId: number;
  title: string;
  description?: string;
  type: 'near_miss' | 'first_aid' | 'accident' | 'dangerous_occurrence' | 'environmental' | 'security';
  severity: 'near_miss' | 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  reportedBy: string;
  photoUrls: string[];
  immediateAction?: string;
};

export function buildIncidentPayload(input: BuildIncidentPayloadInput) {
  return {
    companyId: input.companyId,
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    type: input.type,
    severity: input.severity,
    location: input.location?.trim() || undefined,
    reportedBy: input.reportedBy,
    photoUrls: input.photoUrls,
    immediateAction: input.immediateAction?.trim() || undefined,
    riddorRequired: input.severity === 'critical',
  };
}

export async function uploadIncidentPhotos(
  photoUris: string[],
  projectId: number,
  companyId: number,
  readBase64: (uri: string) => Promise<string>,
  uploadPhoto: UploadIncidentPhoto,
): Promise<string[]> {
  const uploadedPhotoUrls: string[] = [];
  for (const [index, uri] of photoUris.entries()) {
    const base64 = await readBase64(uri);
    const uploadResult = await uploadPhoto({
      companyId,
      fileName: `incident-${projectId}-${Date.now()}-${index + 1}.jpg`,
      mimeType: 'image/jpeg',
      base64Data: base64,
      category: 'photo',
      projectId: String(projectId),
      tags: ['incident', 'safety'],
    });
    uploadedPhotoUrls.push(uploadResult.url);
  }
  return uploadedPhotoUrls;
}
