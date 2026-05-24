import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCompany } from '@/lib/company-context';

export default function ProjectDetailRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { currentProject } = useCompany();
  const targetId = id ?? (currentProject ? String(currentProject.id) : undefined);

  if (!targetId) {
    return <Redirect href="/(tabs)/projects" />;
  }

  return <Redirect href={`/projects/${targetId}` as any} />;
}
