# App Store screenshots

This folder will hold the PNGs you upload to App Store Connect → **Media** → **6.9" Display**.

## Requirements

Apple's iPhone 6.9" slot (iPhone 16 Pro Max, 15 Pro Max) needs **PNG at exactly 1320 × 2868 px**. Submit minimum 3, recommended 6–10. The first PNG is your hero — it's what appears in search results.

If you also support iPad, add **2064 × 2752 px** PNGs for the iPad Pro 13" M4 slot.

## How to generate from `screenshots-generator.html`

The template at `app-store/screenshots-generator.html` produces five App-Store-ready hero shots at the exact 1320×2868 size:

| File | Hero message |
|---|---|
| `iphone-69-01.png` | Cortex AI — "Your AI ops manager" |
| `iphone-69-02.png` | Dashboard — "The dashboard that knows" |
| `iphone-69-03.png` | Quotes — "Quote in 30 seconds" |
| `iphone-69-04.png` | Photo → Snag — "Point. Snap. Snags filed." |
| `iphone-69-05.png` | UK Compliance — "CIS, RAMS, CSCS, HMRC" |

### Option A — DevTools (zero install, 30 seconds)

1. Open `app-store/screenshots-generator.html` in **Chrome** or **Edge**.
2. Open DevTools (⌥⌘I).
3. ⌘⇧P → type `Capture node screenshot`.
4. Select the artboard (`#shot-01`, then `#shot-02`, … `#shot-05`) in the Elements panel before triggering the command. DevTools saves a PNG at the element's exact rendered size.
5. Rename downloads `iphone-69-01.png` … `iphone-69-05.png` and drop into this folder.

### Option B — Puppeteer / Playwright (scriptable)

```js
// node capture.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
await page.goto('file://' + process.cwd() + '/app-store/screenshots-generator.html');
for (let i = 1; i <= 5; i++) {
  const el = await page.locator(`#shot-0${i}`);
  await el.screenshot({ path: `app-store/screenshots/iphone-69-0${i}.png` });
}
await browser.close();
```

### Option C — actually-in-app screenshots from a Mac simulator

If you'd rather submit real product screenshots (no marketing copy, just the app UI), build the iOS app on a Mac per `../../ios/README.md`, run it on the **iPhone 16 Pro Max simulator**, navigate to each screen, and use **⌘S** to save a screenshot. The simulator produces 1320×2868 PNGs natively.

## Tips that get apps approved faster

- The **hero (first) screenshot** must show the app's actual UI, not just marketing text. Apple has rejected pure-text screenshots in the past.
- Don't use the phrases "Powered by AI" or "ChatGPT" in screenshot copy without backing it up — Apple is sensitive to AI claims in 2026.
- Show real (or realistic) data. Lorem ipsum looks lazy.
- Keep readable type at ≥40 px in headlines.
- Avoid Apple's competitor logos (other dev tools, accounting brands) inside screenshots.
- Avoid showing a Home Indicator at the bottom; render it on or remove it consistently.

## What about the older iPhone 6.5" slot?

Apple no longer requires it as of 2024 if you supply 6.9". But if your audience uses older devices, render the same designs at **1284 × 2778** and drop them in here as `iphone-65-0X.png` — App Store Connect has a separate slot for them.
