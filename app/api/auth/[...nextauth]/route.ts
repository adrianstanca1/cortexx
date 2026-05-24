// Auth.js v5: handlers are constructed in lib/auth.ts. We re-export them
// as the route's GET/POST.
import { handlers } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const { GET, POST } = handlers
