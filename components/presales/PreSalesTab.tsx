'use client'

import ChartCard from '@/components/shared/ChartCard'

// Placeholder for v1 of the Pre Sales tab (buyer pre-sales only). The charts and their metric
// definitions are still to be agreed with the growth team.
export default function PreSalesTab() {
    return (
        <ChartCard title="Pre Sales" subtitle="Buyer pre-sales calls — charts coming soon" height={200}>
            <div style={{ color: '#9a948a', fontSize: 13 }}>
                The pre-sales charts will appear here once their definitions are agreed.
            </div>
        </ChartCard>
    )
}
