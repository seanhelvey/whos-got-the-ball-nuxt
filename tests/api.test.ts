// API tests, and a readable tour of the GraphQL API, ported from test_api.py.
//
//   npm test
//
// Each test builds the API against a throwaway SQLite file (seeded with the
// sample data), so they never touch your real database. Read top to bottom to
// see what the API can do.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDb, type Db } from '../server/lib/db'
import { DONE_STATUS, STALLED_AFTER_DAYS } from '../server/lib/models'
import { createApi } from '../server/lib/schema'

type Json = Record<string, any>

let dir: string
let db: Db
let api: ReturnType<typeof createApi>

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ball-'))
  db = openDb(join(dir, 'test.db'))
  api = createApi(db)
})

afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

async function post(query: string, variables: Json = {}): Promise<Json> {
  const res = await api.fetch('http://test/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  expect(res.status).toBe(200)
  return res.json()
}

// Post a GraphQL query and return the `data` object, failing on errors.
async function gql(query: string, variables?: Json): Promise<Json> {
  const payload = await post(query, variables)
  expect(payload.errors).toBeUndefined()
  return payload.data
}

// Post a query expected to fail, and return the first error message.
async function gqlError(query: string, variables?: Json): Promise<string> {
  const payload = await post(query, variables)
  expect(payload.errors?.length).toBeGreaterThan(0)
  return String(payload.errors[0].message)
}

describe('the board', () => {
  it('returns the seeded deals', async () => {
    const { contracts } = await gql('{ contracts { name customer currentHolder { name kind } } }')
    expect(contracts.length).toBeGreaterThanOrEqual(5)
    // Every seeded contract starts with someone holding the ball.
    expect(contracts.every((c: Json) => c.currentHolder !== null)).toBe(true)
  })

  it('computes the overdue flag', async () => {
    const { contracts } = await gql('{ contracts { name isOverdue actionDue } }')
    // The seed data includes at least one contract past its due date.
    expect(contracts.some((c: Json) => c.isOverdue)).toBe(true)
  })

  it('matches the stalled flag to the seven day rule', async () => {
    const { contracts } = await gql('{ contracts { isStalled daysWaiting status } }')
    for (const c of contracts) {
      const expected = c.daysWaiting >= STALLED_AFTER_DAYS && c.status !== DONE_STATUS
      expect(c.isStalled, JSON.stringify(c)).toBe(expected)
    }
    // The seed data is built so the board has something to show under "Stalled".
    expect(contracts.some((c: Json) => c.isStalled)).toBe(true)
  })

  it('never calls a delivered deal overdue or stalled', async () => {
    // Energized means delivered: nobody owes a next action, however long it sat.
    // Pick a contract that is BOTH overdue and stalled first, so marking it done
    // has to flip both flags. Taking contracts[0] would pass on a deal whose due
    // date is simply in the future, testing nothing.
    const board = await gql('{ contracts { id isOverdue isStalled } }')
    const before = board.contracts.find((c: Json) => c.isOverdue && c.isStalled)

    const { updateStatus: result } = await gql(
      `mutation Done($cid: Int!) {
        updateStatus(contractId: $cid, status: "energized") {
          status isOverdue isStalled daysWaiting
        }
      }`,
      { cid: before.id },
    )

    expect(result.status).toBe('energized')
    expect(result.isOverdue).toBe(false)
    expect(result.isStalled).toBe(false)
    // The ball genuinely has sat there. It's the status that clears the flags.
    expect(result.daysWaiting).toBeGreaterThanOrEqual(7)
  })

  it('spans stakeholders of multiple kinds', async () => {
    const { stakeholders } = await gql('{ stakeholders { name kind } }')
    const kinds = new Set(stakeholders.map((s: Json) => s.kind))
    // We expect a real mix of parties, not just the internal team.
    for (const k of ['internal', 'customer', 'utility']) expect(kinds).toContain(k)
  })
})

describe('passing the ball', () => {
  it('moves the contract and records history', async () => {
    const board = await gql(`{
      contracts { id currentHolder { id } handoffs { id } }
      stakeholders { id name }
    }`)
    const contract = board.contracts[0]
    const handoffsBefore = contract.handoffs.length

    // Pick a stakeholder who isn't the current holder.
    const currentId = contract.currentHolder.id
    const newHolder = board.stakeholders.find((s: Json) => s.id !== currentId)

    const { passBall: result } = await gql(
      `mutation Pass($cid: Int!, $to: Int!, $action: String!) {
        passBall(contractId: $cid, toStakeholderId: $to, action: $action) {
          currentHolder { id }
          currentAction
          handoffs { id fromStakeholder { id } toStakeholder { id } }
        }
      }`,
      { cid: contract.id, to: newHolder.id, action: 'Review and sign the interconnection agreement' },
    )

    // The ball is now with the new stakeholder...
    expect(result.currentHolder.id).toBe(newHolder.id)
    expect(result.currentAction).toBe('Review and sign the interconnection agreement')
    // ...and the handoff was recorded in the history...
    expect(result.handoffs).toHaveLength(handoffsBefore + 1)
    // ...crediting whoever was holding it before, which is what lets the
    // timeline say "Passed from X" rather than "Entered the pipeline".
    const newest = result.handoffs[0]
    expect(newest.toStakeholder.id).toBe(newHolder.id)
    expect(newest.fromStakeholder.id).toBe(currentId)
  })

  it('refuses handoffs and statuses it cannot honour', async () => {
    const board = await gql('{ contracts { id } stakeholders { id } }')
    const cid = board.contracts[0].id
    const sid = board.stakeholders[0].id

    const missing = await gqlError(
      `mutation { passBall(contractId: 99999, toStakeholderId: ${sid}, action: "x") { id } }`,
    )
    expect(missing).toContain('No contract with id 99999')

    const blank = await gqlError(
      `mutation Blank($cid: Int!, $to: Int!) {
        passBall(contractId: $cid, toStakeholderId: $to, action: "   ") { id }
      }`,
      { cid, to: sid },
    )
    expect(blank).toContain('needs an action')

    // Without this check the status persists and the card renders a blank stage.
    const bogus = await gqlError(
      'mutation Bogus($cid: Int!) { updateStatus(contractId: $cid, status: "banana") { id } }',
      { cid },
    )
    expect(bogus).toContain('Unknown status')
  })
})
