import { useThemeStore } from '@/stores/themeStore';

beforeEach(() => {
  useThemeStore.setState({
    mode: 'system',
    resolved: 'light',
  });
});

describe('themeStore', () => {
  it('defaults to system mode with light fallback', () => {
    expect(useThemeStore.getState().mode).toBe('system');
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('sets light mode directly', () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('sets dark mode directly', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('system mode resolves to light fallback', () => {
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('toggle switches from light to dark', () => {
    useThemeStore.getState().setMode('light');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('toggle switches from dark to light', () => {
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolved).toBe('light');
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('toggle works from system (resolved light)', () => {
    // system defaults to light
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolved).toBe('dark');
  });
});
