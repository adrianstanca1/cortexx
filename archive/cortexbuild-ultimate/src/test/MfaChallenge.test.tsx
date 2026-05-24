import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MfaChallenge } from '../components/auth/MfaChallenge';

describe('MfaChallenge Component', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  const tempToken = 'test-temp-token';

  beforeEach(() => {
    mockOnSuccess.mockClear();
    mockOnCancel.mockClear();
  });

  it('should render TOTP input by default', () => {
    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Verify your identity')).toBeInTheDocument();
    expect(screen.getByLabelText('Authentication Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
  });

  it('should allow numeric input only in TOTP field', () => {
    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc123def' } });
    expect(input.value).toBe('123');
  });

  it('should limit TOTP input to 6 digits', () => {
    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('000000') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567890' } });
    expect(input.value).toBe('123456');
  });

  it('should switch to recovery code mode when toggled', () => {
    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const toggleButton = screen.getByText(/Use recovery code instead/i);
    fireEvent.click(toggleButton);

    expect(screen.getByLabelText('Recovery Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('XXXXXXXX')).toBeInTheDocument();
  });

  it('should uppercase recovery code input', () => {
    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const toggleButton = screen.getByText(/Use recovery code instead/i);
    fireEvent.click(toggleButton);

    const input = screen.getByPlaceholderText('XXXXXXXX') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'testcode' } });
    expect(input.value).toBe('TESTCODE');
  });

  it('should call onCancel when back button is clicked', () => {
    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const backButton = screen.getByText('Back to login');
    fireEvent.click(backButton);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should display error messages', () => {
    // Mock fetch to fail
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid code' }),
      })
    );

    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('000000');
    const button = screen.getByText('Verify');

    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.click(button);

    waitFor(() => {
      expect(screen.getByText('Invalid code')).toBeInTheDocument();
    });
  });

  it('should call onSuccess when verification succeeds', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'MFA challenge passed' }),
      })
    );

    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('000000');
    const button = screen.getByText('Verify');

    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should send correct payload for TOTP verification', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' }),
      })
    );

    render(
      <MfaChallenge
        tempToken={tempToken}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText('000000');
    const button = screen.getByText('Verify');

    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(button);

    waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/auth/mfa/challenge'),
        expect.objectContaining({
          body: expect.stringContaining('"tempToken":"test-temp-token"'),
          body: expect.stringContaining('"token":"123456"'),
        })
      );
    });
  });
});
