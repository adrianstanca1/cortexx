import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { AIAvatar } from '../components/dashboard/AIAvatar';
import { sendChatMessage } from '../services/ai';

vi.mock('../services/ai', () => ({
  sendChatMessage: vi.fn(),
}));

describe('AIAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders AI replies from the API response shape', async () => {
    vi.mocked(sendChatMessage).mockResolvedValue({
      reply: 'Local Ollama answer',
      data: null,
      suggestions: [],
      source: 'ollama',
    });

    render(<AIAvatar projectId="project-123" />);

    const input = screen.getByPlaceholderText('Ask me anything...');
    fireEvent.change(input, {
      target: { value: 'Status update' },
    });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Local Ollama answer')).toBeTruthy();
    });

    expect(sendChatMessage).toHaveBeenCalledWith('Status update', { projectId: 'project-123' });
    expect(screen.getByText('Powered by local Ollama')).toBeTruthy();
  });

  it('shows fallback mode when the backend falls back to rules', async () => {
    vi.mocked(sendChatMessage).mockResolvedValue({
      reply: 'Fallback summary',
      data: null,
      suggestions: [],
      source: 'rule-based',
    });

    render(<AIAvatar />);

    const input = screen.getByPlaceholderText('Ask me anything...');
    fireEvent.change(input, {
      target: { value: 'Need a summary' },
    });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Fallback summary')).toBeTruthy();
    });

    expect(screen.getByText('Rule-based fallback active')).toBeTruthy();
  });
});
