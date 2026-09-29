// One-off generator, NOT a real test: freezes the Buyer tab's fact table into
// public/buyer-snapshot.json from raw Zoho rows saved on disk, by running the real
// fetchBuyerFacts against a stand-in for lib/zoho.ts.
//
//   SNAPSHOT_RAW_DIR=<dir with leads_p0.json, lsh_jul_p0.json, warm_p0.json, ...> \
//     npx vitest run scripts/build-snapshot.test.ts
//
// Skipped unless SNAPSHOT_RAW_DIR is set, so `vitest run` stays green in CI.
// Writes data/snapshot-needed-ids.json when the raw data is missing rows that Zoho would have
// been asked for by id (deals behind visits, leads created before the window) — fetch those
// into eventdeals_p*.json / missingleads_p*.json and run again.

import { createHash, randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

const RAW = process.env.SNAPSHOT_RAW_DIR

const h = vi.hoisted(() => ({ needed: { deals: new Set<string>(), leads: new Set<string>() } }))

function load(name: string): any[] {
    if (!RAW) return []
    const rows = new Map<string, any>()
    for (const f of fs.readdirSync(RAW)) {
        if (!new RegExp(`^${name}_p\\d+\\.json$`).test(f)) continue
        const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'))
        for (const r of j.data?.data ?? j.data ?? j) rows.set(r.id, r)
    }
    return [...rows.values()]
}

function between(query: string): [number, number] | null {
    const m = query.match(/between '([^']+)' and '([^']+)'/i)
    return m ? [new Date(m[1]!).getTime(), new Date(m[2]!).getTime()] : null
}

vi.mock('@/lib/zoho', () => ({
    executeCOQL: async (q: string) => {
        if (/FROM Leads WHERE Created_Time/i.test(q)) return load('leads')
        if (/FROM Deals WHERE Was_Bid_Warm/i.test(q)) return load('warm')
        if (/FROM Deals WHERE Stage = 'Closed - Won'/i.test(q)) return load('won')
        if (/FROM Deals WHERE Blocking_received_date/i.test(q)) return load('block')
        if (/FROM Deals WHERE Created_Time/i.test(q)) return load('bids')
        if (/FROM Events/i.test(q)) return load('events')
        if (/FROM Lead_Source_History/i.test(q)) {
            const win = between(q)
            const firstOnly = /Serial_Number = 1/.test(q)
            return [...load('lsh_jul'), ...load('lsh_aug'), ...load('lsh_sep')].filter((r) => {
                const t = new Date(r.Timestamp).getTime()
                if (win && !(t >= win[0] && t < win[1])) return false
                return firstOnly ? Number(r.Serial_Number) === 1 : true
            })
        }
        throw new Error(`snapshot builder: unhandled COQL: ${q}`)
    },
    fetchRecords: async (module: string) => {
        if (module === 'Products') return load('prod')
        if (module === 'Leads') return [...load('pipe'), ...load('pipe_a'), ...load('pipe_b')]
        throw new Error(`snapshot builder: unhandled fetchRecords(${module})`)
    },
    fetchRecordsByIds: async (module: string, _fields: string[], ids: string[]) => {
        const pool =
            module === 'Deals'
                ? [...load('alldeals_a'), ...load('alldeals_b'), ...load('warm'), ...load('won'), ...load('block')]
                : [...load('missingleads'), ...load('leads')]
        const byId = new Map(pool.map((r) => [r.id, r]))
        const out: any[] = []
        for (const id of ids) {
            const r = byId.get(id)
            if (r) out.push(r)
            else (module === 'Deals' ? h.needed.deals : h.needed.leads).add(id)
        }
        return out
    },
}))

describe.skipIf(!RAW)('build buyer snapshot', () => {
    it('writes public/buyer-snapshot.json', async () => {
        const { fetchBuyerFacts } = await import('@/lib/buyer/aggregate')
        const { quarterEndOfIST, quarterStartOfIST } = await import('@/lib/buyer/shared')
        const { QUARTER_END_ISO, QUARTER_LABEL, QUARTER_START_ISO } = await import('@/lib/buyer/types')

        const start = quarterStartOfIST(new Date(QUARTER_START_ISO))
        const end = quarterEndOfIST(new Date(QUARTER_START_ISO))
        const facts = await fetchBuyerFacts(start, end)

        // The snapshot is a static file anyone who can open the site can download, so raw phone
        // numbers must not ride in it. derive.ts only ever uses dedupKey as an opaque "same
        // person" key, so replace the phone digits with a salted hash. The salt is random and
        // thrown away, which makes the hashes impossible to reverse by guessing numbers.
        const salt = randomBytes(16).toString('hex')
        const mask = (phone: string) => 'p:' + createHash('sha256').update(salt + phone).digest('hex').slice(0, 16)
        // Names are reduced to initials ("Romeo Fernandes" -> "R. F."), which is enough to tell
        // rows apart in the drill-down lists; the Zoho record id still opens the real lead for
        // people who have CRM access. The telephony lead id is only ever tested for presence.
        const initials = (name: string): string => {
            const parts = name
                .split(/[\s|]+/)
                .map((p) => p.replace(/[^\p{L}]/gu, ''))
                .filter(Boolean)
                .slice(0, 3)
                .map((p) => p[0]!.toUpperCase() + '.')
            return parts.length ? parts.join(' ') : '—'
        }
        for (const l of facts.leads) {
            l.name = initials(l.name)
            if (l.acefoneLeadId) l.acefoneLeadId = '1'
            if (l.phoneKey) {
                const masked = mask(l.phoneKey)
                if (l.dedupKey === l.phoneKey) l.dedupKey = masked
                l.phoneKey = masked
            }
        }

        fs.mkdirSync('data', { recursive: true })
        fs.writeFileSync(
            'data/snapshot-needed-ids.json',
            JSON.stringify({ deals: [...h.needed.deals], leads: [...h.needed.leads] })
        )
        const response = {
            cachedAt: new Date().toISOString(),
            quarterStart: new Date(QUARTER_START_ISO).toISOString(),
            quarterEnd: new Date(QUARTER_END_ISO).toISOString(),
            quarterLabel: QUARTER_LABEL,
            windowStart: start.toISOString(),
            windowEnd: end.toISOString(),
            facts,
        }
        fs.writeFileSync('public/buyer-snapshot.json', JSON.stringify(response))
        console.log(
            `snapshot: leads=${facts.leads.length} visits=${facts.visits.length} conversions=${facts.conversions.length} ` +
                `houses=${facts.houses.length} lshTouches=${facts.lshTouches.length} bidSources=${facts.bidSources.length} ` +
                `missing deals=${h.needed.deals.size} leads=${h.needed.leads.size}`
        )
        expect(facts.leads.length).toBeGreaterThan(0)
    })
})
