import { Suspense } from 'react'
import TabBar from '@/components/ui/TabBar'
import DashboardSwitcher from '@/components/dashboard/DashboardSwitcher'

export default function DashboardPage() {
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 96, display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>}>
        <DashboardSwitcher />
      </Suspense>
      <TabBar />
    </div>
  )
}
