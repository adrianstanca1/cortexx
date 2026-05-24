## 2024-04-13 - Layout-Wide Re-renders from Mouse-Driven UI Effects

**Learning:** Attaching a mouse move listener in a top-level layout component that uses React state (like `useState` for parallax cursor tracking) causes continuous, heavy re-renders across the component and potentially the entire app as the mouse moves. This severely degrades performance.
**Action:** When implementing visual effects tied to high-frequency events like mouse movements or scrolling, avoid using React state to store the coordinates. Instead, use a `useRef` to grab the DOM element directly, compute changes within an event listener, and manually apply CSS transforms using `requestAnimationFrame`. Additionally, wrap large or layout-level components in `React.memo` to prevent them from re-rendering if their parents do so unexpectedly.

## 2024-05-19 - N+1 Queries in RAG Context Retrieval

**Learning:** Performing single-row lookups inside a loop after an initial query (N+1 query problem) severely degrades performance, especially in latency-sensitive paths like RAG context retrieval where multiple tables and rows are checked sequentially.
**Action:** Always batch related lookups into a single query using PostgreSQL's `ANY($1)` with array parameters when fetching associated data for multiple rows. Construct an associative object map keyed by row ID in JavaScript to quickly reconstruct the final ordered result from the batched rows.

## 2026-04-14 - Layout-Wide Re-renders from Mouse-Driven UI Effects (MyDesktop.tsx)

**Learning:** The anti-pattern of using React state (`useState`) for mouse-driven window dragging was observed in `MyDesktop.tsx`, causing continuous re-renders of the top-level app state.
**Action:** Use `useRef` to store window coordinates and apply them directly to the DOM element via `requestAnimationFrame`, deferring the React state update until the drag concludes (`mouseup`).

## 2026-04-14 - Layout-Wide Re-renders from scroll events

**Learning:** Setting React state continuously from a `window.addEventListener('scroll')` handler without debouncing or throttling causes the entire component (and its children) to re-render constantly. This degrades performance significantly.
**Action:** Use `useRef` to keep track of high-frequency variables like the last scroll position instead of `useState`. Conditionally call state updates only when the state should genuinely transition, e.g. hiding/showing an element, to save unneeded renders.

## 2024-05-19 - Layout-Wide Re-renders from setInterval (MyDesktop.tsx)

**Learning:** Having a `setInterval` that sets state (like `currentTime`) in a high-level component (`MyDesktop.tsx`) causes the component and all its children to completely re-render on every tick. This is highly inefficient.
**Action:** Isolate high-frequency state updates like timers/clocks into their own small standalone leaf components so that only the localized DOM tree re-renders.

## 2024-05-20 - Layout-Wide Re-renders from Clock intervals

**Learning:** Setting React state using `setInterval` in layout-level components like `Header.tsx` or `SiteStatusBanner.tsx` to display the current time causes the entire top-level component (and potentially many children) to re-render every second. This creates unnecessary overhead and can degrade perceived performance.
**Action:** Isolate the clock/timer state into a dedicated leaf component (e.g., `<Clock />`). This ensures that only the tiny text element re-renders every second, preventing the entire layout from updating.

## 2024-05-21 - Re-renders from interval hooks (MobileTimesheet.tsx)

**Learning:** Using `setInterval` in high-level feature components like `MobileTimesheet.tsx` to drive localized states (like `elapsed` or `billableHours`) forces top-level re-renders and degrades app performance.
**Action:** Always extract high-frequency timers/clocks (e.g., those tracking elapsed time) into dedicated leaf components (`<ElapsedTimer />`, `<LiveBillableHours />`). This limits UI update recalculations to small string DOM nodes rather than the full component subtree.

## 2024-05-22 - Redundant HTTP Polling with WebSockets (TeamChat.tsx)

**Learning:** Running an HTTP polling interval (`setInterval`) to refresh data in a component that already maintains a real-time WebSocket connection for updates creates unnecessary network overhead and causes layout-wide React re-renders.
**Action:** When a WebSocket connection is correctly established and updating state (like `chat_message` events in `TeamChat`), remove any active HTTP polling fallbacks to ensure the component only re-renders when actual real-time events occur.

## 2026-05-04 - Redundant HTTP Polling with WebSockets (useNotifications.ts)

**Learning:** Running an HTTP polling interval (`setInterval`) to refresh data in a hook that already maintains a real-time WebSocket connection for updates creates unnecessary network overhead and causes layout-wide React re-renders.
**Action:** When a WebSocket connection is correctly established and updating state, skip the execution of any active HTTP polling fallbacks (e.g. by returning early if `ws.current && ws.current.readyState === WebSocket.OPEN`) to ensure the component only re-renders when actual real-time events occur.
## 2026-05-06 - N+1 Query Fix via ANY() with ordering
**Learning:** When replacing an N+1 query loop with a batch `ANY($1)` lookup to improve database performance, the ordered structure of the originally requested items is lost if not explicitly re-constructed using a JavaScript lookup map (keyed by the request parameters).
**Action:** Group and batch queries using `ANY($1)`, populate an intermediate JS object map with the results, and map over the original request array to return the correctly ordered structure.
## 2025-03-09 - N+1 Query in Email Bulk Route
**Learning:** Found a major N+1 query loop in `server/routes/email.js` where bulk emails were inserted one-by-one inside a for-loop. When dealing with bulk insertions, passing an array parameter and using PostgreSQL's `SELECT unnest($1::text[])` is a massive performance win.
**Action:** When implementing bulk database inserts, always check for row-by-row iteration anti-patterns and prefer single batch insert queries using `unnest()`, combined with a `try...catch` fallback to individual queries if granular error tracking is strictly required.

## 2024-05-10 - String.prototype.replace() and $$ SQL parameters
**Learning:** When using `String.prototype.replace()` to refactor backend code containing template literal PostgreSQL parameters (e.g., `$$`), the JavaScript string replacement engine interprets `$$` as a special replacement pattern for a single `$`. This inadvertently corrupts query strings by dropping the `$` prefix, resulting in runtime SQL syntax errors (e.g., `LIKE ${tenantParams}` instead of `LIKE $${tenantParams}`).
**Action:** When programmatically modifying backend SQL query code with node ad-hoc scripts, pass a function as the second argument to `replace()` (e.g., `content.replace(oldStr, () => newStr)`) or use file diffing/patching tools to preserve double dollar signs.
