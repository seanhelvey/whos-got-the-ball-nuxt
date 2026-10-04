// The GraphQL API, ported from schema.py. The SDL below is what Strawberry
// printed for the original, type names and scalars included, so any client of
// the Flask app can point at this one unchanged. The map* helpers turn rows into
// GraphQL objects the same explicit way the Python mappers did.

import { GraphQLError, GraphQLScalarType, Kind } from 'graphql'
import { createSchema, createYoga } from 'graphql-yoga'
import * as store from './db'
import type { Db } from './db'
import {
  daysWaiting,
  isDone,
  isOverdue,
  isStalled,
  type ContractRow,
  type HandoffRow,
  type StakeholderRow,
} from './models'

export const typeDefs = /* GraphQL */ `
type ContractType {
  id: Int!
  name: String!
  customer: String!
  status: String!
  valueUsd: Int!
  targetDate: Date
  currentAction: String
  actionDue: Date
  daysWaiting: Int!
  isOverdue: Boolean!
  isStalled: Boolean!
  isDone: Boolean!
  currentHolder: StakeholderType
  handoffs: [HandoffType!]!
}

"""Date (isoformat)"""
scalar Date

"""Date with time (isoformat)"""
scalar DateTime

type HandoffType {
  id: Int!
  action: String!
  note: String
  due: Date
  createdAt: DateTime!
  fromStakeholder: StakeholderType
  toStakeholder: StakeholderType!
}

type Mutation {
  passBall(contractId: Int!, toStakeholderId: Int!, action: String!, note: String = null, due: Date = null): ContractType!
  updateStatus(contractId: Int!, status: String!): ContractType!
}

type Query {
  contracts: [ContractType!]!
  contract(id: Int!): ContractType
  stakeholders: [StakeholderType!]!
}

type StakeholderType {
  id: Int!
  name: String!
  role: String!
  organization: String!
  kind: String!
  email: String
}
`

// ------------------------------------------------------------------------- //
// Scalars: ISO strings on the wire, like Strawberry's date and datetime
// ------------------------------------------------------------------------- //
function parseIsoDate(value: unknown): string {
  const ok = typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
  if (!ok) throw new GraphQLError(`Value cannot represent a Date: ${JSON.stringify(value)}`)
  return value as string
}

const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date (isoformat)',
  serialize: value => value,
  parseValue: parseIsoDate,
  parseLiteral: ast => parseIsoDate(ast.kind === Kind.STRING ? ast.value : undefined),
})

// Stored as 'YYYY-MM-DD HH:MM:SS.ffffff', served as Python's isoformat() did.
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'Date with time (isoformat)',
  serialize: value => String(value).replace(' ', 'T'),
})

// ------------------------------------------------------------------------- //
// Mappers: row -> GraphQL object
// ------------------------------------------------------------------------- //
function mapStakeholder(s: StakeholderRow | undefined) {
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    organization: s.organization,
    kind: s.kind,
    email: s.email,
  }
}

function mapHandoff(db: Db, h: HandoffRow) {
  return {
    id: h.id,
    action: h.action,
    note: h.note,
    due: h.due,
    createdAt: h.created_at,
    fromStakeholder: mapStakeholder(store.getStakeholder(db, h.from_stakeholder_id)),
    toStakeholder: mapStakeholder(store.getStakeholder(db, h.to_stakeholder_id)),
  }
}

function mapContract(db: Db, c: ContractRow) {
  return {
    id: c.id,
    name: c.name,
    customer: c.customer,
    status: c.status,
    valueUsd: c.value_usd,
    targetDate: c.target_date,
    currentAction: c.current_action,
    actionDue: c.action_due,
    daysWaiting: daysWaiting(c),
    isOverdue: isOverdue(c),
    isStalled: isStalled(c),
    isDone: isDone(c),
    currentHolder: mapStakeholder(store.getStakeholder(db, c.current_holder_id)),
    handoffs: store.handoffsFor(db, c.id).map(h => mapHandoff(db, h)),
  }
}

// ------------------------------------------------------------------------- //
// Resolvers
// ------------------------------------------------------------------------- //
export function createResolvers(db: Db) {
  return {
    Date: DateScalar,
    DateTime: DateTimeScalar,
    Query: {
      contracts: () => store.listContracts(db).map(c => mapContract(db, c)),
      contract: (_: unknown, { id }: { id: number }) => {
        const c = store.getContract(db, id)
        return c ? mapContract(db, c) : null
      },
      stakeholders: () => store.listStakeholders(db).map(mapStakeholder),
    },
    Mutation: {
      passBall: (_: unknown, args: store.PassBallArgs) => mapContract(db, store.passBall(db, args)),
      updateStatus: (_: unknown, { contractId, status }: { contractId: number, status: string }) =>
        mapContract(db, store.updateStatus(db, contractId, status)),
    },
  }
}

// One Yoga instance per database, so tests can each bring a throwaway one.
// GraphiQL is served on GET /graphql, as Strawberry's Flask view did.
export function createApi(db: Db) {
  return createYoga({
    schema: createSchema({ typeDefs, resolvers: createResolvers(db) }),
    graphqlEndpoint: '/graphql',
    // Strawberry sent a resolver's error message to the client as is. Yoga
    // masks unexpected errors by default, which would hide "No contract with
    // id 99999" behind "Unexpected error."
    maskedErrors: false,
    landingPage: false,
  })
}
