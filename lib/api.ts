// A deliberately tiny GraphQL client - just `fetch`. No Apollo, no extra deps.
// This keeps the app light while still exercising real GraphQL queries and
// mutations against the Nitro server.

import type { Contract, PassBallInput, Stakeholder } from "./types";

const ENDPOINT = "/graphql";

async function gql<T>(query: string, variables?: object): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    // Deliberately doesn't name a port: the API is always the same origin
    // serving these pages, in development and on Render alike.
    throw new Error(`Request failed (${res.status}). Is the API reachable?`);
  }

  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  if (!body.data) {
    throw new Error("Empty response from GraphQL API.");
  }
  return body.data;
}

// Shared field selection so queries and the mutation return the same shape.
const CONTRACT_FIELDS = `
  id
  name
  customer
  status
  valueUsd
  targetDate
  currentAction
  actionDue
  daysWaiting
  isOverdue
  isStalled
  isDone
  currentHolder { id name role organization kind email }
  handoffs {
    id
    action
    note
    due
    createdAt
    fromStakeholder { id name role organization kind }
    toStakeholder { id name role organization kind }
  }
`;

export async function fetchBoard(): Promise<{
  contracts: Contract[];
  stakeholders: Stakeholder[];
}> {
  return gql(`
    query Board {
      contracts { ${CONTRACT_FIELDS} }
      stakeholders { id name role organization kind email }
    }
  `);
}

export async function passBall(input: PassBallInput): Promise<{ passBall: Contract }> {
  return gql(
    `
    mutation PassBall(
      $contractId: Int!
      $toStakeholderId: Int!
      $action: String!
      $note: String
      $due: Date
    ) {
      passBall(
        contractId: $contractId
        toStakeholderId: $toStakeholderId
        action: $action
        note: $note
        due: $due
      ) { ${CONTRACT_FIELDS} }
    }
  `,
    input,
  );
}
