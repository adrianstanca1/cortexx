import { test, expect } from '@playwright/test'
import { buildSync } from 'esbuild'
import { readFileSync } from 'node:fs'

// Exercise the shipped canvas with real React and native browser key/click events.
// No account, database, CDN, or production data is needed for this fixture.
const bundle = buildSync({
  stdin: {
    contents: `import React from 'react';
      import * as ReactDOM from 'react-dom';
      import { createRoot } from 'react-dom/client';
      ${readFileSync(new URL('../../dist/design-canvas.js', import.meta.url), 'utf8')}
      createRoot(document.getElementById('root')).render(
        React.createElement(DesignCanvas, null,
          React.createElement(DCSection, {id:'plans', title:'Plans'},
            React.createElement(DCArtboard, {id:'first', label:'First', width:160, height:200},
              React.createElement('button', {type:'button', onClick:()=>window.cardClicks++}, 'Card action')),
            React.createElement(DCArtboard, {id:'second', label:'Second', width:160, height:200}))))`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"test"' },
}).outputFiles[0].text

async function mount(page) {
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
  await page.evaluate(() => { window.cardClicks = 0 })
  await page.addScriptTag({ content: bundle })
  await expect(page.locator('[data-dc-slot="first"]')).toBeVisible()
}

function backdrop(page) { return page.getByRole('button', { name: 'Exit artboard focus', exact: true }) }

test('renaming retains spaces and Enter commits without opening focus', async ({ page }) => {
  await mount(page)
  const label = page.locator('[data-dc-slot="first"] .dc-editable')
  await label.fill('Site')
  await label.press('End')
  await label.press('Space')
  await label.pressSequentially('Plan')
  await label.press('Enter')
  await expect(label).toHaveText('Site Plan')
  await expect(label).not.toBeFocused()
  await expect(backdrop(page)).toHaveCount(0)
  const focus = page.locator('[data-dc-slot="first"] .dc-labeltext')
  await focus.focus()
  await focus.press('Space')
  await expect(backdrop(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(backdrop(page)).toHaveCount(0)
  await focus.focus()
  await focus.press('Enter')
  await expect(backdrop(page)).toBeVisible()
})

test('focus closes from backdrop and margins while card actions stay open', async ({ page }) => {
  await mount(page)
  await page.locator('[data-dc-slot="first"] .dc-labeltext').press('Enter')
  await expect(backdrop(page)).toBeVisible()
  // Only the portal action is visible above the modal backdrop.
  await page.getByRole('button', { name: 'Card action', exact: true }).last().click()
  expect(await page.evaluate(() => window.cardClicks)).toBe(1)
  await expect(backdrop(page)).toBeVisible()
  // The centered flex container covers this margin: it must pass clicks through.
  await page.mouse.click(105, 90)
  await expect(backdrop(page)).toHaveCount(0)
  await page.locator('[data-dc-slot="first"] .dc-labeltext').press('Enter')
  await expect(backdrop(page)).toBeVisible()
  await backdrop(page).click({ position: { x: 10, y: 90 } })
  await expect(backdrop(page)).toHaveCount(0)
})
