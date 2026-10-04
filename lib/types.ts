// Domain types mirroring the GraphQL schema. The API serves fields in camelCase
// and dates/datetimes as ISO strings, as Strawberry did, which is reflected here.

export type StakeholderKind =
  | "internal"
  | "customer"
  | "utility"
  | "installer"
  | "financier"
  | "ahj";

export type ContractStatus =
  | "prospecting"
  | "proposal"
  | "contracting"
  | "engineering"
  | "permitting"
  | "construction"
  | "energized"
  | "on_hold";

export interface Stakeholder {
  id: number;
  name: string;
  role: string;
  organization: string;
  kind: StakeholderKind;
  email: string | null;
}

export interface Handoff {
  id: number;
  action: string;
  note: string | null;
  due: string | null; // YYYY-MM-DD
  createdAt: string; // ISO datetime
  fromStakeholder: Stakeholder | null;
  toStakeholder: Stakeholder;
}

export interface Contract {
  id: number;
  name: string;
  customer: string;
  status: ContractStatus;
  valueUsd: number;
  targetDate: string | null;
  currentAction: string | null;
  actionDue: string | null;
  daysWaiting: number;
  isOverdue: boolean;
  isStalled: boolean;
  isDone: boolean;
  currentHolder: Stakeholder | null;
  handoffs: Handoff[];
}

export interface PassBallInput {
  contractId: number;
  toStakeholderId: number;
  action: string;
  note?: string | null;
  due?: string | null;
}
