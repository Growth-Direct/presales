import type { SellerSpendFact, SellerSpendIngest } from '../facts'
import { EMPTY_SELLER_SPEND_INGEST } from './parse'
import snapshot from './spend-jas26.json'

// Where seller spend comes from. Today: a committed snapshot built by hand from a CSV export
// of the "Seller side spends" tab (see scripts/README.md). Defined behind this thin boundary
// so a live Google Drive read is a swap HERE and not a change anywhere downstream — both
// return the same `{ facts, ingest }` shape.
//
// A live read is the right end state, since the growth team fills this tab by hand and the
// snapshot is stale the moment they type. It needs `drive.readonly` on the service account
// behind GOOGLE_SA_CREDENTIALS_JSON (currently Directory-scoped only) plus a Drive
// export/convert step, because the workbook is an uploaded .xlsx and not a native Sheet.

export interface SellerSpendSnapshot {
    facts: SellerSpendFact[]
    ingest: SellerSpendIngest
}

export function loadSellerSpend(): SellerSpendSnapshot {
    const snap = snapshot as SellerSpendSnapshot
    // Defensive: a truncated or hand-edited JSON must degrade to "no spend", which renders as
    // dashes everywhere, rather than throwing and taking the whole seller tab down.
    if (!snap || !Array.isArray(snap.facts)) {
        return {
            facts: [],
            ingest: { ...EMPTY_SELLER_SPEND_INGEST, error: 'Seller spend snapshot missing or malformed' },
        }
    }
    return snap
}
