// Seed data so the app is interesting the moment it boots, ported row for row
// from seed.py. Everything is fictional but shaped like real commercial
// clean-energy deals. Dates are relative to "today" so the board always has
// fresh overdue and due-soon items.

import type { DatabaseSync } from 'node:sqlite'
import { today, utcnow } from './models'

function days(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return today(d)
}

function ago(n: number): string {
  return utcnow(new Date(Date.now() - n * 86_400_000))
}

const PEOPLE = {
  priya: ['Priya Nair', 'Account Executive', 'Meridian Energy', 'internal', 'priya@meridian.example'],
  marcus: ['Marcus Lee', 'Solar Project Manager', 'Meridian Energy', 'internal', 'marcus@meridian.example'],
  dana: ['Dana Ruiz', 'Energy Analyst', 'Meridian Energy', 'internal', 'dana@meridian.example'],
  sam: ['Sam Whitfield', 'Facilities Director', 'Riverside Logistics', 'customer', 'sam@riverside.example'],
  elena: ['Elena Cho', 'Sustainability Lead', 'Northwind Foods', 'customer', 'elena@northwind.example'],
  grid: ['Pacific Grid Interconnection Desk', 'Interconnection Engineer', 'Pacific Grid', 'utility', 'interconnect@pacificgrid.example'],
  theo: ['Theo Barnes', 'Site Lead', 'BrightBuild EPC', 'installer', 'theo@brightbuild.example'],
  nadia: ['Nadia Patel', 'Underwriter', 'Evergreen Capital', 'financier', 'nadia@evergreen.example'],
  permit: ['City Permit Office', 'Plan Reviewer', 'City of Fresno', 'ahj', 'permits@fresno.example'],
} as const

type Person = keyof typeof PEOPLE

// Populate the DB only if it's empty, so restarts keep your edits.
export function seedIfEmpty(db: DatabaseSync): void {
  if (db.prepare('SELECT 1 FROM stakeholders LIMIT 1').get()) return

  db.exec('BEGIN')
  try {
    // ---- Stakeholders ----------------------------------------------------- //
    const addPerson = db.prepare(
      'INSERT INTO stakeholders (name, role, organization, kind, email) VALUES (?, ?, ?, ?, ?)',
    )
    const id = {} as Record<Person, number>
    for (const [key, row] of Object.entries(PEOPLE) as [Person, readonly string[]][]) {
      id[key] = Number(addPerson.run(...row).lastInsertRowid)
    }

    // ---- Contracts -------------------------------------------------------- //
    const addContract = db.prepare(
      `INSERT INTO contracts (name, customer, status, value_usd, target_date, created_at,
         current_holder_id, current_action, action_due, holding_since)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const contract = (
      name: string, customer: string, status: string, valueUsd: number, targetDate: string,
      holder: Person, action: string, actionDue: string, holdingSince: string,
    ): number =>
      Number(addContract.run(
        name, customer, status, valueUsd, targetDate, utcnow(),
        id[holder], action, actionDue, holdingSince,
      ).lastInsertRowid)

    const riverside = contract(
      'Riverside Logistics - 1.2 MW Rooftop Solar', 'Riverside Logistics', 'permitting',
      1_800_000, days(75), 'permit', 'Approve the revised structural permit set',
      days(-4), ago(12), // overdue -> red flag
    )
    const northwind = contract(
      'Northwind Foods - Cold Storage Solar + Storage', 'Northwind Foods', 'contracting',
      3_450_000, days(120), 'nadia', 'Return the signed financing term sheet',
      days(3), ago(6), // due soon
    )
    contract(
      'Harborview Mall - Solar Carport', 'Harborview Retail Group', 'engineering',
      2_100_000, days(95), 'marcus', 'Finalize the single-line diagram for utility review',
      days(9), ago(2),
    )
    contract(
      'Cedar Grove Schools - Community Solar', 'Cedar Grove USD', 'proposal',
      940_000, days(160), 'sam', 'Confirm roof access dates for the site survey',
      days(1), ago(8), // due tomorrow
    )
    contract(
      'Pacific Freight - EV Fleet Charging Hub', 'Pacific Freight Co.', 'construction',
      2_750_000, days(40), 'theo', 'Schedule the trenching inspection with the AHJ',
      days(-1), ago(5), // overdue
    )
    contract(
      'Summit Data Center - 5 MW PPA', 'Summit Compute', 'energized',
      6_200_000, days(-10), 'dana', 'Send the 30-day production report to the customer',
      days(6), ago(1),
    )

    // ---- A little handoff history for the timeline views ------------------ //
    const addHandoff = db.prepare(
      `INSERT INTO handoffs (contract_id, from_stakeholder_id, to_stakeholder_id, action, note, due, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const handoff = (
      contractId: number, from: Person | null, to: Person, action: string,
      note: string | null, due: string | null, createdAt: string,
    ): void => {
      addHandoff.run(contractId, from ? id[from] : null, id[to], action, note, due, createdAt)
    }

    // Riverside moved: Priya -> Marcus -> Dana -> Permit office
    handoff(riverside, null, 'priya', 'Qualify the site and confirm interest',
      'Warm intro from an existing customer.', null, ago(48))
    handoff(riverside, 'priya', 'marcus', 'Scope the rooftop array and run initial layout',
      'Signed LOI in hand.', null, ago(34))
    handoff(riverside, 'marcus', 'dana', 'Model production and savings for the proposal',
      null, null, ago(24))
    handoff(riverside, 'dana', 'permit', 'Approve the revised structural permit set',
      'Resubmitted after the plan-check comments.', days(-4), ago(12))
    // Northwind moved: Priya -> Elena -> Nadia
    handoff(northwind, null, 'priya', 'Build the initial solar + storage proposal',
      null, null, ago(30))
    handoff(northwind, 'priya', 'elena', 'Review the proposal with the sustainability committee',
      'They care most about the resilience story.', null, ago(18))
    handoff(northwind, 'elena', 'nadia', 'Return the signed financing term sheet',
      null, days(3), ago(6))

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
