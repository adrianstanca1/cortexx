import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/types';

const mockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj_1',
  name: 'Test Project',
  description: 'A test project',
  status: 'active',
  location: { lat: 51.5, lng: -0.1 },
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  budget: 100000,
  orgId: 'org_1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  useProjectStore.setState({
    projects: [],
    isLoading: false,
    selectedProject: null,
  });
});

describe('projectStore', () => {
  it('initializes with empty state', () => {
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useProjectStore.getState().isLoading).toBe(false);
    expect(useProjectStore.getState().selectedProject).toBeNull();
  });

  it('sets projects', () => {
    const p1 = mockProject();
    const p2 = mockProject({ id: 'proj_2', name: 'Second Project' });
    useProjectStore.getState().setProjects([p1, p2]);
    expect(useProjectStore.getState().projects).toHaveLength(2);
  });

  it('adds a project to the front', () => {
    useProjectStore.getState().setProjects([mockProject()]);
    useProjectStore.getState().addProject(mockProject({ id: 'proj_2' }));
    const projects = useProjectStore.getState().projects;
    expect(projects).toHaveLength(2);
    expect(projects[0].id).toBe('proj_2');
  });

  it('updates a project by id', () => {
    useProjectStore.getState().setProjects([mockProject()]);
    useProjectStore.getState().updateProject('proj_1', { name: 'Updated Name' });
    const updated = useProjectStore.getState().projects[0];
    expect(updated.name).toBe('Updated Name');
    expect(updated.updatedAt).toBeDefined();
  });

  it('does not affect unmatching projects on update', () => {
    useProjectStore.getState().setProjects([mockProject()]);
    useProjectStore.getState().updateProject('nonexistent', { name: 'Changed' });
    expect(useProjectStore.getState().projects[0].name).toBe('Test Project');
  });

  it('removes a project by id', () => {
    useProjectStore.getState().setProjects([mockProject(), mockProject({ id: 'proj_2' })]);
    useProjectStore.getState().removeProject('proj_1');
    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().projects[0].id).toBe('proj_2');
  });

  it('selects a project', () => {
    const p = mockProject();
    useProjectStore.getState().selectProject(p);
    expect(useProjectStore.getState().selectedProject).toEqual(p);
  });

  it('sets loading state', () => {
    useProjectStore.getState().setLoading(true);
    expect(useProjectStore.getState().isLoading).toBe(true);
  });
});
