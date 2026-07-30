// Registry for the generic /api/:collection CRUD surface in index.js.
//
// Extracted so the SQL shape can be asserted in tests against the real
// schema (test/collections-schema.test.js). Three prod incidents came from
// this surface drifting away from server/db/schema.sql:
//   * a table listed here without the `data`/`updated_at` columns the generic
//     writer assumes -> every write to that collection 500s,
//   * an upsert keyed on the globally-unique `id` primary key with no
//     workspace predicate -> writes land in another tenant's row.

// Typed collections — these have first-class DB tables. Anything else falls
// through to the generic `documents_store` JSON catch-all.
//
// NOTE: 'activity' intentionally excluded — activity_log uses a BIGSERIAL id
// (not the TEXT-id + JSONB write shape), so it lives in documents_store like
// the other ~36 lighter collections. Keeps read/write paths consistent.
//
// NOTE: 'siteMaps' intentionally excluded — site_maps is a UUID-id table with
// `marks`/`center` columns and no `data` JSONB, and it is keyed UNIQUE on
// (workspace_id, project_id). It does not fit the generic TEXT-id + `data`
// write shape, so it lives in documents_store too.
const NATIVE = new Set([
  'projects', 'tasks', 'team', 'team_members', 'invoices', 'quotes',
  // v1.3 gap closure (all use TEXT id + data JSONB)
  'receipts', 'cisSubs', 'cisPayments', 'timesheets', 'diary',
  'snags', 'changeOrders', 'rfis', 'subs', 'materials',
  'documentsMeta', 'equipment', 'notifications',
]);

// Tables that have a TEXT id + data JSONB shape (v1.3 gap closure schema).
// Every member MUST have `id TEXT PRIMARY KEY`, `workspace_id`, `data JSONB`
// and `updated_at` in schema.sql — the generic writer below depends on it.
const TYPED_JSONB = new Set([
  'receipts', 'cisSubs', 'cisPayments', 'timesheets', 'diary', 'snags',
  'changeOrders', 'rfis', 'subs', 'materials', 'documentsMeta', 'equipment',
  'notifications',
]);

// camelCase collection name → snake_case table name
const TABLE_NAMES = {
  team:           'team_members',
  cisSubs:        'cis_subs',
  cisPayments:    'cis_payments',
  changeOrders:   'change_orders',
  diary:          'diary_entries',
  documentsMeta:  'documents_meta',
  activity:       'activity_log',
  siteMaps:       'site_maps',
};
const tableFor = (c) => TABLE_NAMES[c] || c;

// Order by a column each table actually has (many lack created_at).
const ORDER = {
  projects: 'created_at', tasks: 'created_at',
  invoices: 'issued', quotes: 'issued',
  team: 'name', team_members: 'name',
  activity: 'at', notifications: 'created_at',
};
const UPDATED_AT_ORDERED = [
  'receipts', 'cisSubs', 'cisPayments', 'timesheets', 'diary', 'snags',
  'changeOrders', 'rfis', 'subs', 'materials', 'documentsMeta', 'equipment',
];
function orderColumnFor(collection) {
  return ORDER[collection]
    || (UPDATED_AT_ORDERED.includes(collection) ? 'updated_at' : 'id');
}

// Upsert for a TYPED_JSONB table.
//
// The conflict target is the workspace-scoped UNIQUE (workspace_id, id) key
// added by migration 007, NOT `id` alone. These tables shipped with a global
// `id TEXT PRIMARY KEY`, and the SPA mints ids from local state
// (`Math.max(...ids) + 1` in lib/backend.js), so every tenant independently
// creates id '1', '2', '3'. Conflicting on `id` alone meant the first tenant to
// claim an id owned that row globally and every other tenant's write was
// silently redirected into it — the writer lost its record and the owner's list
// showed the writer's data.
//
// The extra workspace predicate on DO UPDATE is redundant given the scoped
// conflict target, and is kept as a belt-and-braces guarantee that this
// statement can never write a row belonging to another tenant.
//
// $1 = id, $2 = workspace_id, $3 = data
function typedUpsertSql(tbl) {
  return `INSERT INTO ${tbl} (id, workspace_id, data) VALUES ($1,$2,$3)
       ON CONFLICT (workspace_id, id) DO UPDATE SET data=$3, updated_at=now()
        WHERE ${tbl}.workspace_id = $2
    RETURNING id`;
}

module.exports = {
  NATIVE, TYPED_JSONB, TABLE_NAMES, tableFor, orderColumnFor, typedUpsertSql,
};
