/** Shapes of the public ArcID indexer responses used here (only the fields we read), plus the on-chain cross-check. */

export interface ApiAgent {
  id: number;
  name: string | null;
  owner?: string;
  agentWallet?: string | null;
  reputation: { feedbackCount: number; clients: number; average: number | null };
  validations: { total: number; passed: number };
  trustScore: number;
  trust: { version: number; settledUsdc: number; paidClients: number; unpaidClients: number };
}

export interface ApiFeedback {
  client: string;
  /** Per (agent, client) feedback index; with the agent id and client it locates the entry on-chain. */
  index: number;
  value: number | string;
  tag1: string | null;
  tag2: string | null;
  block: number;
  revoked: boolean;
  /** ArcID's own classification: receipt, rating, metric, self or revoked. */
  kind: string;
  rating: number | null;
  endpoint?: string | null;
  feedbackUri?: string | null;
  tx?: string;
  /** Raw int128 value read from the canonical Reputation Registry for the same (agent, client, index); null if not read or not found. */
  chainValue?: string | null;
  chainDecimals?: number | null;
  /** True when the on-chain tag1, tag2 and revoked status equal the API's. */
  chainMatch?: boolean | null;
}

/** An entry present in the Reputation Registry but missing from the indexer's feedback list. */
export interface ChainOnlyFeedback {
  client: string;
  index: number;
  value: string;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  revoked: boolean;
}

export interface Snapshot {
  source: string;
  fetchedAt: string;
  stats: unknown;
  /** Canonical registry the feedback was cross-checked against, if any. */
  chain?: { chainId: number; rpc: string; reputationRegistry: string } | null;
  /** Every agent with at least one feedback entry. */
  agents: ApiAgent[];
  /** Feedback entries keyed by agent id. */
  feedback: Record<string, ApiFeedback[]>;
  /** On-chain entries the indexer did not return, keyed by agent id. */
  chainOnly?: Record<string, ChainOnlyFeedback[]>;
}
