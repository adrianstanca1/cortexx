import { lightTheme, darkTheme } from '@/utils/colors';

describe('color themes', () => {
  it('exports lightTheme as an object', () => {
    expect(typeof lightTheme).toBe('object');
    expect(lightTheme.background).toBe('#f8fafc');
    expect(lightTheme.primary).toBe('#0ea5e9');
    expect(lightTheme.danger).toBe('#ef4444');
  });

  it('exports darkTheme as an object', () => {
    expect(typeof darkTheme).toBe('object');
    expect(darkTheme.background).toBe('#020617');
    expect(darkTheme.primary).toBe('#0ea5e9');
    expect(darkTheme.danger).toBe('#ef4444');
  });

  it('light and dark share primary colour', () => {
    expect(lightTheme.primary).toBe(darkTheme.primary);
    expect(lightTheme.primaryDark).toBe(darkTheme.primaryDark);
  });

  it('has background contrast', () => {
    expect(lightTheme.background).not.toBe(darkTheme.background);
    expect(lightTheme.surface).not.toBe(darkTheme.surface);
  });
});
