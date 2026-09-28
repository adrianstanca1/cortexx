import { test, expect } from '@playwright/test'
import { buildSync } from 'esbuild'

const bundle = buildSync({
  stdin: {
    contents: `import React from 'react';
      import { createRoot } from 'react-dom/client';
      import Pill from './components/ui/Pill.tsx';
      const cases = [undefined, '#10b981', 'rgb(100, 150, 200)', 'var(--t3)'];
      createRoot(document.getElementById('root')).render(
        React.createElement('div', null, cases.flatMap((color, index) =>
          [false, true].map(ghost => React.createElement('div', {key:index + '-' + ghost, 'data-ghost':String(ghost)},
            React.createElement(Pill, {label:'draft', color, ghost}))))));`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"test"' },
}).outputFiles[0].text

test('status badge backgrounds and borders support every CSS colour format', async ({ page }) => {
  await page.setContent('<!doctype html><html><head><style>:root{--t3:#a0aec0}</style></head><body><div id="root"></div></body></html>')
  await page.addScriptTag({ content: bundle })
  await expect(page.locator('[data-ghost] > span')).toHaveCount(8)
  for (const pill of await page.locator('[data-ghost] > span').all()) {
    const style = await pill.evaluate(el => {
      const computed = getComputedStyle(el)
      return {
        ghost: el.parentElement.dataset.ghost === 'true',
        background: computed.backgroundColor,
        borderWidth: computed.borderTopWidth,
        parsedBackground: el.style.background,
        parsedBorder: el.style.border,
      }
    })
    expect(style.parsedBackground).not.toBe('')
    if (style.ghost) {
      expect(style.parsedBorder).not.toBe('')
      expect(style.borderWidth).toBe('1px')
    } else {
      expect(style.background).not.toBe('rgba(0, 0, 0, 0)')
    }
  }
})
