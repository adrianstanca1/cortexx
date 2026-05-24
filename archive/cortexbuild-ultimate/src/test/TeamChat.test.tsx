/**
 * TeamChat Component Tests
 *
 * Tests for the team chat modal component with messaging,
 * loading state, and typing indicator functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamChat } from '../components/ui/TeamChat';
import { toast } from 'sonner';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('TeamChat', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<TeamChat onClose={mockOnClose} />);

    // Should show loading spinner
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Team chat')).toBeInTheDocument();
  });

  it('displays chat messages after loading', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    // Wait for messages to load
    await waitFor(() => {
      expect(screen.getByText('Team meeting at 2 PM today')).toBeInTheDocument();
      expect(screen.getByText('Project status updated to In Progress')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows member count in header', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('3 members online')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('sends a message when clicking send button', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    // Wait for messages to load first
    await waitFor(() => {
      expect(screen.getByText('Team meeting at 2 PM today')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Type message
    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: 'Hello team!' } });

    // Click send
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    expect(toast.success).toHaveBeenCalledWith('Message sent');
    // Message should appear in chat
    await waitFor(() => {
      expect(screen.getByText('Hello team!')).toBeInTheDocument();
    });
  });

  it('sends a message when pressing Enter', async () => {
    const user = userEvent.setup();
    render(<TeamChat onClose={mockOnClose} />);

    // Wait for messages to load first
    await waitFor(() => {
      expect(screen.getByText('Team meeting at 2 PM today')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Type message and press Enter
    const input = screen.getByLabelText('Message input');
    await user.type(input, 'Press Enter to send{enter}');

    expect(toast.success).toHaveBeenCalledWith('Message sent');
  });

  it('does not send empty messages', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    // Wait for messages to load first
    await waitFor(() => {
      expect(screen.getByText('Team meeting at 2 PM today')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Click send without typing
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking close button', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    // Wait for messages to load first
    await waitFor(() => {
      expect(screen.getByText('Team meeting at 2 PM today')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Click close button
    const closeButton = screen.getByLabelText('Close chat');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays system messages with different styling', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    await waitFor(() => {
      const systemMessage = screen.getByText('Project status updated to In Progress');
      expect(systemMessage).toBeInTheDocument();
      expect(systemMessage).toHaveClass('bg-base-200');
    }, { timeout: 1000 });
  });

  it('displays user avatars with first letter of name', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    await waitFor(() => {
      // Sarah Chen should have 'S' avatar
      expect(screen.getByText('S')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows timestamps for messages', async () => {
    render(<TeamChat onClose={mockOnClose} />);

    await waitFor(() => {
      // Should show time in format like "04:44 AM" - timestamps are in spans with text-gray-500 class
      const timestamps = screen.getAllByText(/\d{2}:\d{2} [AP]M/);
      expect(timestamps.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });
});
