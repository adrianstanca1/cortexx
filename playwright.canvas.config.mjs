import { defineConfig, devices } from '@playwright/test'
export default defineConfig({testDir:'./test/e2e',testMatch:'design-canvas.spec.mjs',reporter:'list',workers:1,projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['Pixel 7']}}]})
