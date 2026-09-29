import { executeCOQL } from '@/lib/zoho'
import { type LeadAttribution, type RawLsh, resolveFirstTouches } from './attribution'
import { toZohoDateTime } from './shared'

// Fetches first-touch attribution for every lead whose first Lead_Source_History row
// (Serial_Number = 1) falls in the window, bucketed on Timestamp. That is exactly the
// new-lead population for the window: 99.9% one-to-one with leads created, and if a
// lead's first touch predates the window its acquisition spend does too, so it correctly
// stays out of this window's denominator.
//
// COQL needs explicit parenthesisation once BETWEEN meets another predicate, or it
// returns a spurious "SYNTAX_ERROR near where". executeCOQL already pages (200/req) and
// throws on real errors; a quarter is ~4,800 rows, well under the 10k cap, and callers
// pass month slices for wider windows.

export async function fetchFirstTouches(slices: Array<[Date, Date]>): Promise<Map<string, LeadAttribution>> {
    const rows: RawLsh[] = []
    for (const [a, b] of slices) {
        const q = `SELECT id, Lead, Source, Micromarket, Timestamp, Serial_Number FROM Lead_Source_History WHERE (Timestamp between '${toZohoDateTime(a)}' and '${toZohoDateTime(b)}') and (Serial_Number = 1)`
        const page = (await executeCOQL(q).catch((e) => {
            throw new Error(`firstTouchesQ failed for ${a.toISOString()}: ${e.message}`)
        })) as RawLsh[]
        rows.push(...page)
    }
    return resolveFirstTouches(rows)
}

// Every Lead_Source_History row in the window, any Serial_Number — a lead that re-enquires
// gets a second (third, ...) row here, unlike fetchFirstTouches which keeps only the
// earliest. This is the raw touch count the Overall Funnel's "Total Leads" block wants,
// against LeadFact's one-row-per-lead "Unique Leads".
export async function fetchAllTouches(slices: Array<[Date, Date]>): Promise<Array<{ leadId: string; timestamp: string }>> {
    const out: Array<{ leadId: string; timestamp: string }> = []
    for (const [a, b] of slices) {
        const q = `SELECT id, Lead, Timestamp FROM Lead_Source_History WHERE (Timestamp between '${toZohoDateTime(a)}' and '${toZohoDateTime(b)}')`
        const page = (await executeCOQL(q).catch((e) => {
            throw new Error(`allTouchesQ failed for ${a.toISOString()}: ${e.message}`)
        })) as RawLsh[]
        for (const r of page) {
            const leadId = typeof r.Lead === 'string' ? r.Lead : r.Lead?.id
            const timestamp = (r.Timestamp ?? '').trim()
            if (leadId && timestamp) out.push({ leadId, timestamp })
        }
    }
    return out
}
