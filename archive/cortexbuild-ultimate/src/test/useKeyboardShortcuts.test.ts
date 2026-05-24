import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderHook, render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts, formatShortcut, DEFAULT_SHORTCUTS } from '../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls the handler when the correct key is pressed', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler: mockHandler, description: 'Test' }]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('does not call the handler when a different key is pressed', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler: mockHandler, description: 'Test' }]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('supports ctrl modifier', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 's', ctrl: true, handler: mockHandler, description: 'Save' }]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: false }));
    expect(mockHandler).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('supports shift modifier', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'n', shift: true, handler: mockHandler, description: 'New' }]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', shiftKey: false }));
    expect(mockHandler).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', shiftKey: true }));
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('supports alt modifier', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'p', alt: true, handler: mockHandler, description: 'Print' }]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', altKey: false }));
    expect(mockHandler).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', altKey: true }));
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('supports combination of modifiers', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'k', ctrl: true, shift: true, handler: mockHandler, description: 'Search' }]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: false }));
    expect(mockHandler).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }));
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('ignores events from INPUT elements', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler: mockHandler, description: 'Test' }]));

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    input.dispatchEvent(event);

    expect(mockHandler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('ignores events from TEXTAREA elements', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler: mockHandler, description: 'Test' }]));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    textarea.dispatchEvent(event);

    expect(mockHandler).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('allows ctrl/meta chords when focus is inside data-allow-chrome-shortcuts', () => {
    function Shell() {
      useKeyboardShortcuts([{ key: 'k', ctrl: true, handler: mockHandler, description: 'Palette' }]);
      return createElement(
        'div',
        { 'data-allow-chrome-shortcuts': '' },
        createElement('input', { 'data-testid': 'palette-q' }),
      );
    }
    render(createElement(Shell));
    const input = document.querySelector('[data-testid="palette-q"]') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true, bubbles: true });
    expect(mockHandler).toHaveBeenCalledTimes(1);
    mockHandler.mockClear();
    fireEvent.keyDown(input, { key: 'k', metaKey: true, bubbles: true });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('ignores events from contentEditable elements', () => {
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler: mockHandler, description: 'Test' }]));

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    div.dispatchEvent(event);

    expect(mockHandler).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts([{ key: 'a', handler: mockHandler, description: 'Test' }]));

    unmount();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

describe('formatShortcut', () => {
  it('formats single keys', () => {
    expect(formatShortcut({ key: 'a' })).toBe('A');
    expect(formatShortcut({ key: '1' })).toBe('1');
  });

  it('formats modifier combinations', () => {
    expect(formatShortcut({ key: 's', ctrl: true })).toBe('⌘S');
    expect(formatShortcut({ key: 'p', alt: true })).toBe('⌥P');
    expect(formatShortcut({ key: 'n', shift: true })).toBe('⇧N');
    expect(formatShortcut({ key: 'k', ctrl: true, shift: true })).toBe('⌘⇧K');
  });

  it('formats special keys', () => {
    expect(formatShortcut({ key: ' ' })).toBe('Space');
    expect(formatShortcut({ key: 'ArrowUp' })).toBe('↑');
    expect(formatShortcut({ key: 'ArrowDown' })).toBe('↓');
    expect(formatShortcut({ key: 'ArrowLeft' })).toBe('←');
    expect(formatShortcut({ key: 'ArrowRight' })).toBe('→');
  });
});

describe('DEFAULT_SHORTCUTS', () => {
  it('is exported and contains valid shortcuts', () => {
    expect(DEFAULT_SHORTCUTS).toBeDefined();
    expect(DEFAULT_SHORTCUTS.goToDashboard).toBeDefined();
    expect(DEFAULT_SHORTCUTS.goToDashboard.key).toBe('1');
    expect(DEFAULT_SHORTCUTS.goToDashboard.ctrl).toBe(true);
  });
});
