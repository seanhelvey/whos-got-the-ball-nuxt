// The domain for the "Who's Got the Ball" contract-delivery tracker, ported
// from models.py. A contract moves through many hands (the developer's own team,
// the customer, the utility, the installer, the financier, the permitting
// office). At any moment one stakeholder "has the ball": they own the next
// action before the deal can move forward. When the ball sits too long, deals
// stall. The current owner, the pending action, and the full handoff history
// are first-class here.

// How we categorize the parties involved in delivering a contract. Plain strings
// (not a DB enum) so the seed data and API stay easy to read.
export const STAKEHOLDER_KINDS = [
  'internal', // the developer's own team, whoever runs this
  'customer', // the business buying clean energy
  'utility', // the local utility / interconnection
  'installer', // EPC / installation partner
  'financier', // capital partner / lender
  'ahj', // authority having jurisdiction (permitting)
] as const

export const CONTRACT_STATUSES = [
  'prospecting',
  'proposal',
  'contracting',
  'engineering',
  'permitting',
  'construction',
  'energized',
  'on_hold',
] as const

// An energized deal is delivered. Nobody owes a next action on it, so it can be
// neither overdue nor stalled however long it sits.
export const DONE_STATUS = 'energized'

// How long a ball can sit on one desk before the deal counts as stalled.
export const STALLED_AFTER_DAYS = 7

const DAY_MS = 86_400_000

// Rows exactly as the three tables store them. Dates are 'YYYY-MM-DD' and
// datetimes are naive UTC 'YYYY-MM-DD HH:MM:SS.ffffff', the format SQLAlchemy
// wrote in the original, so a database from either app reads the same.
export interface StakeholderRow {
  id: number
  name: string
  role: string
  organization: string
  kind: string
  email: string | null
}

export interface ContractRow {
  id: number
  name: string
  customer: string
  status: string
  value_usd: number
  target_date: string | null
  created_at: string
  current_holder_id: number | null
  current_action: string | null
  action_due: string | null
  holding_since: string | null
}

export interface HandoffRow {
  id: number
  contract_id: number
  from_stakeholder_id: number | null
  to_stakeholder_id: number
  action: string
  note: string | null
  due: string | null
  created_at: string
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

// A naive UTC timestamp. SQLite stores naive datetimes, so we keep everything
// naive UTC and compare like with like.
export function utcnow(at: Date = new Date()): string {
  return (
    `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())} `
    + `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())}`
    + `.${pad(at.getUTCMilliseconds() * 1000, 6)}`
  )
}

// The server's local calendar date, like Python's date.today().
export function today(at: Date = new Date()): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

export function parseUtc(stored: string): Date {
  return new Date(`${stored.replace(' ', 'T').slice(0, 23)}Z`)
}

export function daysWaiting(c: ContractRow, now: Date = new Date()): number {
  if (!c.holding_since) return 0
  // timedelta.days floors, so 6.9 days is still 6.
  return Math.floor((now.getTime() - parseUtc(c.holding_since).getTime()) / DAY_MS)
}

export function isOverdue(c: ContractRow, now: Date = new Date()): boolean {
  if (!c.action_due) return false
  return c.action_due < today(now) && c.status !== DONE_STATUS
}

// Delivered: nobody owes a next action. Exposed so the client can rank and
// label without knowing which status string means "finished".
export function isDone(c: ContractRow): boolean {
  return c.status === DONE_STATUS
}

// Sitting on one desk too long, whoever is holding it. Overdue needs someone to
// have typed a due date and stalled does not, which is why both exist. Lives
// here rather than in the client so the rule ships with the data.
export function isStalled(c: ContractRow, now: Date = new Date()): boolean {
  return daysWaiting(c, now) >= STALLED_AFTER_DAYS && c.status !== DONE_STATUS
}
