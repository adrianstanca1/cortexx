import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/types';

const mockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif_1',
  userId: 'user_1',
  title: 'Test Notification',
  body: 'You have a new task assigned',
  type: 'task',
  read: false,
  data: { projectId: 'proj_1' },
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
  });
});

describe('notificationStore', () => {
  it('initializes with empty notifications', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
  });

  it('sets notifications and computes unread count', () => {
    useNotificationStore.getState().setNotifications([
      mockNotification(),
      mockNotification({ id: 'notif_2', read: true }),
    ]);
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('adds a notification and increments unread for unread items', () => {
    useNotificationStore.getState().addNotification(mockNotification());
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it('adds a read notification without incrementing unread', () => {
    useNotificationStore.getState().addNotification(mockNotification({ read: true }));
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('marks a notification as read', () => {
    useNotificationStore.getState().addNotification(mockNotification());
    useNotificationStore.getState().markAsRead('notif_1');
    const state = useNotificationStore.getState();
    expect(state.notifications[0].read).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it('marks all notifications as read', () => {
    useNotificationStore.getState().setNotifications([
      mockNotification(),
      mockNotification({ id: 'notif_2', read: false }),
    ]);
    useNotificationStore.getState().markAllRead();
    const state = useNotificationStore.getState();
    expect(state.notifications.every((n) => n.read)).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it('removes a notification and decrements unread correctly', () => {
    useNotificationStore.getState().setNotifications([
      mockNotification(),
      mockNotification({ id: 'notif_2', read: true }),
    ]);
    useNotificationStore.getState().removeNotification('notif_1');
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(0);
  });

  it('removes a read notification without affecting unread count', () => {
    useNotificationStore.getState().setNotifications([
      mockNotification({ read: true }),
      mockNotification({ id: 'notif_2', read: false }),
    ]);
    useNotificationStore.getState().removeNotification('notif_1');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });
});
