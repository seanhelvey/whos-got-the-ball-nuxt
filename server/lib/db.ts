// The SQLite connection and every query the API makes. node:sqlite ships with
// Node 22, so there is no native module to compile on deploy.

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  CONTRACT_STATUSES,
  utcnow,
  type ContractRow,
  type HandoffRow,
  type StakeholderRow,
} from './models'
import { seedIfEmpty } from './seed'

export type Db = DatabaseSync

// The DDL SQLAlchemy's create_all() emitted for the original, column for column.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS stakeholders (
  id INTEGER NOT NULL,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(120) NOT NULL,
  organization VARCHAR(120) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  email VARCHAR(200),
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER NOT NULL,
  name VARCHAR(160) NOT NULL,
  customer VARCHAR(160) NOT NULL,
  status VARCHAR(32) NOT NULL,
  value_usd INTEGER NOT NULL,
  target_date DATE,
  created_at DATETIME NOT NULL,
  current_holder_id INTEGER,
  current_action VARCHAR(400),
  action_due DATE,
  holding_since DATETIME,
  PRIMARY KEY (id),
  FOREIGN KEY(current_holder_id) REFERENCES stakeholders (id)
);
CREATE TABLE IF NOT EXISTS handoffs (
  id INTEGER NOT NULL,
  contract_id INTEGER NOT NULL,
  from_stakeholder_id INTEGER,
  to_stakeholder_id INTEGER NOT NULL,
  action VARCHAR(400) NOT NULL,
  note VARCHAR(1000),
  due DATE,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY(contract_id) REFERENCES contracts (id),
  FOREIGN KEY(from_stakeholder_id) REFERENCES stakeholders (id),
  FOREIGN KEY(to_stakeholder_id) REFERENCES stakeholders (id)
);
`

// Opens (creating if needed) and seeds the database, like create_app() did.
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true })
  // SQLAlchemy never turned on SQLite's foreign key enforcement, so neither do we.
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: false })
  db.exec(SCHEMA)
  seedIfEmpty(db)
  return db
}

let shared: Db | undefined

// The process-wide database the Nitro server uses. Tests open their own.
export function useDb(): Db {
  shared ??= openDb(process.env.DATABASE_PATH ?? '.data/ball.db')
  return shared
}

export function transaction<T>(db: Db, work: () => T): T {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function listContracts(db: Db): ContractRow[] {
  return db.prepare('SELECT * FROM contracts ORDER BY name').all() as unknown as ContractRow[]
}

export function getContract(db: Db, id: number): ContractRow | undefined {
  return db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as ContractRow | undefined
}

export function listStakeholders(db: Db): StakeholderRow[] {
  return db.prepare('SELECT * FROM stakeholders ORDER BY name').all() as unknown as StakeholderRow[]
}

export function getStakeholder(db: Db, id: number | null): StakeholderRow | undefined {
  if (id === null) return undefined
  return db.prepare('SELECT * FROM stakeholders WHERE id = ?').get(id) as StakeholderRow | undefined
}

export function handoffsFor(db: Db, contractId: number): HandoffRow[] {
  return db
    .prepare('SELECT * FROM handoffs WHERE contract_id = ? ORDER BY created_at DESC')
    .all(contractId) as unknown as HandoffRow[]
}

export interface PassBallArgs {
  contractId: number
  toStakeholderId: number
  action: string
  note?: string | null
  due?: string | null
}

// Hand the ball to another stakeholder and record the handoff.
export function passBall(db: Db, args: PassBallArgs): ContractRow {
  const contract = getContract(db, args.contractId)
  if (!contract) throw new Error(`No contract with id ${args.contractId}`)
  if (!getStakeholder(db, args.toStakeholderId)) {
    throw new Error(`No stakeholder with id ${args.toStakeholderId}`)
  }
  // A handoff with no stated action is the thing this app exists to prevent,
  // so the API refuses it rather than trusting the one client to.
  const action = args.action.trim()
  if (!action) throw new Error('A handoff needs an action the new holder owns')

  const note = args.note ?? null
  const due = args.due ?? null
  transaction(db, () => {
    db.prepare(
      `INSERT INTO handoffs
         (contract_id, from_stakeholder_id, to_stakeholder_id, action, note, due, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(contract.id, contract.current_holder_id, args.toStakeholderId, action, note, due, utcnow())
    db.prepare(
      `UPDATE contracts
          SET current_holder_id = ?, current_action = ?, action_due = ?, holding_since = ?
        WHERE id = ?`,
    ).run(args.toStakeholderId, action, due, utcnow(), contract.id)
  })
  return getContract(db, contract.id)!
}

export function updateStatus(db: Db, contractId: number, status: string): ContractRow {
  const contract = getContract(db, contractId)
  if (!contract) throw new Error(`No contract with id ${contractId}`)
  // CONTRACT_STATUSES is a plain list, so nothing else would stop an unknown
  // status being stored and rendered as a blank stage on the card.
  if (!(CONTRACT_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Unknown status '${status}'`)
  }
  db.prepare('UPDATE contracts SET status = ? WHERE id = ?').run(status, contractId)
  return getContract(db, contractId)!
}
