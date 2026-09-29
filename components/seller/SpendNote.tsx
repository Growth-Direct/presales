'use client'

import type { SellerSpendIngest } from '@/lib/seller/facts'

// The one-line provenance note under the Target vs Achieved table. Seller spend is a
// hand-built snapshot of a hand-filled sheet, so two things have to be visible or the Spend
// and cost-per rows above are unreadable:
//
//  1. HOW STALE it is. The snapshot is rebuilt by hand (pnpm build:spend:seller), so it goes
//     out of date the moment the growth team types into the sheet.
//  2. HOW MUCH SPEND A PLACE FILTER DROPPED. ~20% of seller spend carries no micromarket
//     ("All MM", blank, or a cluster typed into the column) and there is no basis to split it
//     across markets. Every cost-per metric under a micromarket filter is therefore computed
//     on a smaller numerator, which makes the channel look CHEAPER than it is. Saying so is
//     the difference between a caveat and a wrong number.
//
// The Buyer tab plumbs the same ingest report and renders none of it. That was survivable at
// 24% unallocated with no cost row anyone acted on; it isn't here.

const wrap: React.CSSProperties = {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid #f4efe7',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5,
    lineHeight: 1.6,
    color: '#9a948a',
}

function inrShort(n: number): string {
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`
    return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function builtOn(iso: string | null): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

export default function SpendNote({
    ingest,
    excludedUnallocated,
}: {
    ingest: SellerSpendIngest
    /** Spend dropped by the active place filter for having no micromarket. 0 without one. */
    excludedUnallocated: number
}) {
    if (ingest.status !== 'ok') {
        return (
            <div style={{ ...wrap, color: '#c7533e' }}>
                Spend unavailable — {ingest.error ?? 'unknown error'}. Spend and cost rows show no data.
            </div>
        )
    }

    const built = builtOn(ingest.builtAt)
    const parts: string[] = []
    parts.push(built ? `Spend snapshot built ${built} from the "Seller side spends" sheet.` : 'Spend from the "Seller side spends" sheet.')
    if (excludedUnallocated > 0) {
        parts.push(
            `${inrShort(excludedUnallocated)} carries no micromarket and is excluded by the current filter, so the cost-per rows read low.`
        )
    }
    // Anomalies the growth team can fix in their own sheet. Deliberately not shown when clean,
    // so that seeing anything here means something needs attention.
    if (ingest.unknownMicromarkets.length > 0) {
        parts.push(`Unrecognised micromarket${ingest.unknownMicromarkets.length > 1 ? 's' : ''}: ${ingest.unknownMicromarkets.join(', ')}.`)
    }
    if (ingest.unmappedSources.length > 0) {
        parts.push(`Unmapped source${ingest.unmappedSources.length > 1 ? 's' : ''}: ${ingest.unmappedSources.join(', ')}.`)
    }
    if (ingest.droppedBadDate > 0 || ingest.droppedBadSpend > 0) {
        parts.push(`${ingest.droppedBadDate + ingest.droppedBadSpend} sheet row(s) dropped for an unreadable date or amount.`)
    }

    return <div style={wrap}>{parts.join(' ')}</div>
}
