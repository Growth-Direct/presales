import { SELLER_CHANNELS, SELLER_MICROMARKETS } from '@/lib/seller/types'

// Seller charts stack by CHANNEL and by Call_Status, so this palette needs one colour per
// channel and a lifecycle-sentiment colour per status — not the buyer's per-source hue
// ramps. Kept separate from the buyer palette so the two never drift into each other.

const FALLBACK = ['#3a7d5d', '#cf9d5b', '#8ba0b4', '#c7533e', '#7c5cbf', '#5ba88a', '#e5a040', '#4a90d9', '#a9a294']

// One hue per channel. Cold Outreach gets its own teal so it never collides with 3P (red)
// or Referral & WOM (gold). Order matches SELLER_CHANNELS.
const CHANNEL_COLOR: Record<string, string> = {
    'Paid Ads': '#3a7d5d', // green
    '3P': '#c7533e', // red
    'Offline Branding': '#8ba0b4', // slate
    'Society WA Groups & Management Apps': '#7c5cbf', // purple
    Organic: '#4a90d9', // blue
    'Referral & WOM': '#e5a040', // gold
    'Cold Outreach': '#3fa39b', // teal — the seller-only channel
    Unmapped: '#a9a294', // neutral
}

export const CHANNEL_ORDER: string[] = [...SELLER_CHANNELS]

// One hue family per cluster, shades within it running dark → light in SELLER_MICROMARKETS
// order — mirrors the buyer palette's CHANNEL_RAMPS pattern (a source keeps its channel's hue
// family so a stack still reads as its channel at a glance). Here a micromarket keeps its
// cluster's hue family, matching the grouping the Micromarket Analysis tooltips read by
// (MICROMARKET_TO_CLUSTER in lib/seller/shared.ts) and the colours already used on the Visits
// in Pipeline by Cluster chart's cluster axis. Fixed entries rather than the FALLBACK ramp
// below: 11 micromarkets would wrap FALLBACK's 9 colours and silently double up two of them.
const MICROMARKET_COLOR: Record<string, string> = {
    // PAV
    Powai: '#2f6ea8',
    Vegas: '#4a90d9',
    Athens: '#7bb2e8',
    // GLAM
    Glasgow: '#6544a6',
    Amsterdam: '#7c5cbf',
    // BABU
    Boston: '#b5822f',
    Barcelona: '#e5a040',
    Singapore: '#edc07a',
    // HABIBI
    Helsinki: '#1f7a72',
    Berlin: '#3fa39b',
    'Hong Kong': '#7cc4bd',
}

export const MICROMARKET_ORDER: string[] = [...SELLER_MICROMARKETS]

// Call_Status coloured by lifecycle sentiment, so a stack reads at a glance: blues are still
// to be worked (being contacted / untouched), greens are qualified & progressing toward an
// MoU, reds are dead or lost. Shades within a family run dark → light in STATUS_ORDER order.
const STATUS_RAMPS = {
    blue: ['#2f6ea8', '#4a90d9', '#7bb2e8', '#a9cef2'],
    green: ['#26543d', '#2f6349', '#458f6c', '#65b08f'],
    red: ['#8f3729', '#c7533e', '#e0806f', '#efa697'],
    neutral: ['#a9a294'],
} as const

// [family, statuses] — also the stack/legend order (blue → green → red → neutral).
// 'Attempted to Contact' is the folded telephony-junk bucket; 'Blank' is a folded empty
// status. The three greens are exactly the qualified set — kept in sync with the 2026-09-07
// Notion update (SELLER_QUALIFIED_STATUSES in lib/seller/types.ts): 'Prospect' is qualified
// now, 'Already sold the flat' isn't (moved to red — a seller who sold elsewhere is a dead
// end for us, not a status still progressing toward an MoU).
const STATUS_FAMILY: Array<[keyof typeof STATUS_RAMPS, string[]]> = [
    ['blue', ['Fresh', 'Attempted to Contact', 'Call Later', 'Follow Up', 'Blank']],
    ['green', ['Qualified', 'Explore Later', 'Prospect']],
    ['red', ['Not qualified', 'Inactive', 'Invalid number', 'Already sold the flat']],
    ['neutral', ['Duplicate']],
]

export const STATUS_ORDER: string[] = STATUS_FAMILY.flatMap(([, statuses]) => statuses)

const STATUS_COLOR = new Map<string, string>()
for (const [family, statuses] of STATUS_FAMILY) {
    const ramp = STATUS_RAMPS[family]
    statuses.forEach((status, i) => STATUS_COLOR.set(status, ramp[i % ramp.length]!))
}

const assigned = new Map<string, string>()
let nextIdx = 0

/** Colour for a seller series key — a channel keeps its fixed hue and a known status its
 *  sentiment shade; anything else (a new channel/status) falls back to a first-come ramp. */
export function colorFor(key: string): string {
    const fixed = CHANNEL_COLOR[key] ?? STATUS_COLOR.get(key) ?? MICROMARKET_COLOR[key]
    if (fixed) return fixed
    if (!assigned.has(key)) {
        assigned.set(key, FALLBACK[nextIdx % FALLBACK.length]!)
        nextIdx++
    }
    return assigned.get(key)!
}
