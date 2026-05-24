/**
 * NotificationCenter component tests (fetch + auth token flow).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationCenter } from '../components/ui/NotificationCenter';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

const mockNotifications = [
  {
    id: '1',
    type: 'alert' as const,
    title: 'Safety Alert',
    description: 'Hard hat zone',
    timestamp: new Date().toISOString(),
    read: false,
    link: '/safety/alerts/1',
    actionLabel: 'View Alert',
  },
  {
    id: '2',
    type: 'warning' as const,
    title: 'Budget Variance',
    description: 'Over budget',
    timestamp: new Date().toISOString(),
    read: false,
  },
  {
    id: '3',
    type: 'success' as const,
    title: 'Inspection Passed',
    description: 'OK',
    timestamp: new Date().toISOString(),
    read: true,
  },
  {
    id: '4',
    type: 'info' as const,
    title: 'New Document',
    description: 'Uploaded',
    timestamp: new Date().toISOString(),
    read: false,
  },
];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function setupNotificationFetch() {
  let list = [...mockNotifications];
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = init?.method ?? 'GET';

    if (url.includes('/api/notifications?pageSize')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ notifications: list }),
      } as Response;
    }
    if (method === 'PUT' && /\/api\/notifications\/[^/]+\/read$/.test(url)) {
      const id = url.split('/').slice(-2, -1)[0];
      list = list.map(n => (n.id === id ? { ...n, read: true } : n));
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }
    if (method === 'PUT' && url.endsWith('/api/notifications/read-all')) {
      list = list.map(n => ({ ...n, read: true }));
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }
    if (method === 'DELETE' && /\/api\/notifications\/[^/]+$/.test(url) && !url.includes('/read')) {
      const id = url.split('/').pop()!;
      list = list.filter(n => n.id !== id);
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  });
}

describe('NotificationCenter', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupNotificationFetch();
  });

  it('loads notifications and shows unread badge', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading notifications...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('3 unread')).toBeInTheDocument();
    expect(screen.getByText('Safety Alert')).toBeInTheDocument();
    expect(screen.getByText('Budget Variance')).toBeInTheDocument();
    expect(screen.getByText('Inspection Passed')).toBeInTheDocument();
    expect(screen.getByText('New Document')).toBeInTheDocument();
  });

  it('filters with Alerts tab', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Safety Alert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Alerts/i }));

    await waitFor(() => {
      expect(screen.getByText('Safety Alert')).toBeInTheDocument();
      expect(screen.getByText('Budget Variance')).toBeInTheDocument();
      expect(screen.queryByText('New Document')).not.toBeInTheDocument();
    });
  });

  it('marks single notification as read', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getAllByLabelText('Mark as read').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByLabelText('Mark as read')[0]);

    await waitFor(() => {
      expect(screen.getByText('2 unread')).toBeInTheDocument();
    });
  });

  it('marks all notifications as read', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Mark all notifications as read')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByLabelText('Mark all notifications as read'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('All notifications marked as read');
      expect(screen.getByText('0 unread')).toBeInTheDocument();
    });
  });

  it('deletes a notification', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Safety Alert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByLabelText('Delete')[0]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Notification deleted');
      expect(screen.queryByText('Safety Alert')).not.toBeInTheDocument();
    });
  });

  it('calls onClose when clicking close button', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Close notification center')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Close notification center'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows primary action link when provided', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('View Alert')).toBeInTheDocument();
    });

    const view = screen.getByText('View Alert').closest('a');
    expect(view).toHaveAttribute('href', '/safety/alerts/1');
  });

  it('shows footer count for displayed notifications', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/4 notifications displayed/)).toBeInTheDocument();
    });
  });

  it('has settings button', async () => {
    render(<NotificationCenter onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Notification settings')).toBeInTheDocument();
    });
  });
});
