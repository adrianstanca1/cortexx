import { useTaskStore } from '@/stores/taskStore';
import type { Task } from '@/types';

const mockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task_1',
  projectId: 'proj_1',
  title: 'Test Task',
  description: 'A test task',
  status: 'todo',
  priority: 'medium',
  assigneeId: 'user_1',
  dueDate: '2026-06-01',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  useTaskStore.setState({
    tasks: [],
    isLoading: false,
    selectedTask: null,
  });
});

describe('taskStore', () => {
  it('initializes empty', () => {
    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useTaskStore.getState().selectedTask).toBeNull();
  });

  it('sets tasks', () => {
    useTaskStore.getState().setTasks([mockTask()]);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  it('adds a task to the front', () => {
    useTaskStore.getState().setTasks([mockTask()]);
    useTaskStore.getState().addTask(mockTask({ id: 'task_2' }));
    expect(useTaskStore.getState().tasks[0].id).toBe('task_2');
  });

  it('updates a task by id', () => {
    useTaskStore.getState().setTasks([mockTask()]);
    useTaskStore.getState().updateTask('task_1', { title: 'Updated' });
    expect(useTaskStore.getState().tasks[0].title).toBe('Updated');
  });

  it('removes a task by id', () => {
    useTaskStore.getState().setTasks([mockTask(), mockTask({ id: 'task_2' })]);
    useTaskStore.getState().removeTask('task_1');
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  it('selects a task', () => {
    const t = mockTask();
    useTaskStore.getState().selectTask(t);
    expect(useTaskStore.getState().selectedTask).toEqual(t);
  });

  it('filters tasks by project', () => {
    useTaskStore.getState().setTasks([
      mockTask(),
      mockTask({ id: 'task_2', projectId: 'proj_2' }),
    ]);
    const result = useTaskStore.getState().tasksByProject('proj_1');
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe('proj_1');
  });

  it('filters tasks by status', () => {
    useTaskStore.getState().setTasks([
      mockTask(),
      mockTask({ id: 'task_2', status: 'done' }),
    ]);
    const result = useTaskStore.getState().tasksByStatus('done');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('done');
  });

  it('status filter returns empty when no match', () => {
    useTaskStore.getState().setTasks([mockTask()]);
    expect(useTaskStore.getState().tasksByStatus('review')).toEqual([]);
  });
});
