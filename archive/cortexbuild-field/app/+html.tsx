import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

/**
 * Custom HTML template for static web export.
 *
 * Expo Router's default template emits `<title data-rh="true"></title>`
 * — an empty react-helmet slot intended to be filled by client-side
 * `<Head>` components. But Expo's static-export pre-render does NOT
 * capture client-rendered Head children into the per-route HTML files,
 * and the SPA fallback (nginx `try_files ... /index.html`) means every
 * URL serves the same shell anyway. Result: every cold-load HTML has
 * an empty `<title>`, breaking SEO, social-share scrapers, and any
 * crawler without JS execution.
 *
 * This template hardcodes a sensible default title + description.
 * Per-route `<Head>` blocks (e.g. in `app/welcome.tsx`) continue to
 * override at client-hydration time, so JS-aware visitors still see
 * the route-specific title. No-JS crawlers fall back to this default,
 * which is much better than the empty string.
 *
 * If you change the app branding, update both this file AND
 * `app.config.ts:env.appName`.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>CortexBuild Field — AI Construction Management</title>
        <meta
          name="description"
          content="The construction-site app for UK companies that ship. Capture defects, run permits to work, file daily reports, and chase invoices — even with the signal halfway down the mast."
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
