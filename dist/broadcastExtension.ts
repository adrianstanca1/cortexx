import { Prisma } from '@prisma/client'
import { broadcastNewActivity } from './broadcastServer'
import type { Activity } from './types'

/**
 * Prisma client extension that auto-broadcasts newly created activity records
 * to same-origin sibling tabs via BroadcastChannel.
 *
 * This removes the need for every API route to remember to broadcast manually.
 * `createMany` is intentionally skipped because it returns only a count; seeders
 * and bulk importers should rely on the SSE poll for eventual sync.
 */
export const broadcastExtension = Prisma.defineExtension({
  name: 'activity-broadcast',
  query: {
    activity: {
      async create({ args, query }) {
        const activity = await query(args)
        if (activity?.id) broadcastNewActivity(activity as Activity)
        return activity
      },
    },
  },
})
