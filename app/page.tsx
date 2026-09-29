'use client'

import BuyerTab from '@/components/buyer/BuyerTab'
import PreSalesTab from '@/components/presales/PreSalesTab'
import Footer from '@/components/shared/Footer'
import Nav, { type NavView } from '@/components/shared/Nav'
import type { BuyerFactsResponse } from '@/lib/buyer/aggregate'
import { type TimeRange } from '@/lib/buyer/timePresets'
import { useHashState } from '@/lib/useHashState'
import { useState } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) =>
    fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
    })

export default function Home() {
    const [view, setView] = useHashState('view', 'buyer')
    const activeView = (view as NavView) || 'buyer'

    // Empty means the reporting quarter, which is what the tab opens on.
    const [buyerPeriods, setBuyerPeriods] = useState<TimeRange[]>([])

    // The Buyer facts are a frozen snapshot served as a static file, so there is one fixed URL.
    // Paging to a period outside the snapshot quarter shows no data until a new snapshot is built.
    const buyerKey = '/buyer-snapshot.json'

    const buyer = useSWR<BuyerFactsResponse>(buyerKey, fetcher, {
        revalidateOnFocus: false,
        keepPreviousData: true,
    })

    return (
        <>
            <Nav activeView={activeView} onViewChange={(v) => setView(v)} />
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 40px 60px' }}>
                {activeView === 'presales' ? (
                    <PreSalesTab />
                ) : buyer.error ? (
                    <div style={{ color: '#c7533e', fontSize: 13 }}>Failed to load: {buyer.error.message}</div>
                ) : buyer.isLoading || !buyer.data ? (
                    <div style={{ color: '#9a948a', fontSize: 13 }}>Loading…</div>
                ) : (
                    <BuyerTab
                        response={buyer.data}
                        periods={buyerPeriods}
                        onPeriods={setBuyerPeriods}
                        loading={buyer.isValidating}
                    />
                )}
            </div>
            <Footer cachedAt={activeView === 'presales' ? undefined : buyer.data?.cachedAt} />
        </>
    )
}
