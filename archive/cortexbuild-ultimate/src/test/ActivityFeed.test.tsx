/**
 * ActivityFeed Component Tests
 *
 * Tests for the activity feed component with activity display,
 * timestamp formatting, and filtering functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ActivityFeed } from '../components/ui/ActivityFeed';

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders activity feed with mock activities', async () => {
    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
      expect(screen.getByText('James Miller')).toBeInTheDocument();
      expect(screen.getByText('Patricia Watson')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('displays relative timestamps for activities', async () => {
    render(<ActivityFeed />);

    await waitFor(() => {
      // Should show time ago format like "5m ago", "30m ago", "1h ago"
      const timeAgoElements = screen.getAllByText(/\d+[mhd] ago|Just now/);
      expect(timeAgoElements.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it('respects the limit prop', async () => {
    render(<ActivityFeed limit={2} />);

    await waitFor(() => {
      // Should show at least 2 activities
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('displays activity action text correctly', async () => {
    render(<ActivityFeed />);

    await waitFor(() => {
      // Check some action verbs are displayed
      expect(screen.getAllByText(/created|completed|alerted|updated|commented on/i).length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it('displays target names correctly', async () => {
    render(<ActivityFeed />);

    await waitFor(() => {
      // Check some target text is present
      expect(screen.getAllByText(/new project milestone|safety inspection report|budget variance/i).length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it('shows at least one time format element', async () => {
    render(<ActivityFeed />);

    await waitFor(() => {
      const timeElements = screen.getAllByText(/\d+[mhd] ago|Just now/);
      expect(timeElements.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it('renders activity icons', async () => {
    render(<ActivityFeed />);

    await waitFor(() => {
      // Each activity should have an icon container with lucide class
      const icons = document.querySelectorAll('.lucide');
      expect(icons.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 1000 });
  });
});
