// Presentation helpers shared across components. Pure functions, easy to test.

import type { ContractStatus, StakeholderKind } from "./types";

// Said in full on every card, because this is the fact that decides what you do
// next: chase someone in-house, or wait on an outside party.
export const KIND_LABELS: Record<StakeholderKind, string> = {
  internal: "Our team",
  customer: "Customer",
  utility: "Utility",
  installer: "Installer",
  financier: "Financier",
  ahj: "Permitting office",
};

export const STATUS_LABELS: Record<ContractStatus, string> = {
  prospecting: "Prospecting",
  proposal: "Proposal",
  contracting: "Contracting",
  engineering: "Engineering",
  permitting: "Permitting",
  construction: "Construction",
  energized: "Energized",
  on_hold: "On hold",
};

export function currency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function parseDate(iso: string): Date {
  // Treat date-only strings as local midnight to avoid timezone drift.
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

export function formatDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Only used by dueMeta and timeAgo below - not part of this module's surface.
function relativeDays(iso: string): number {
  const target = parseDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type DueTone = "overdue" | "soon" | "ok";

// Whether a contract is overdue is the server's call (`is_overdue` in models.py)
// - a delivered deal is never overdue however old its date. We take the flag and
// only decide how to word the countdown, so the label can't contradict the red
// border beside it.
export function dueMeta(
  iso: string | null,
  isOverdue: boolean,
): { tone: DueTone; label: string } | null {
  if (!iso) return null;
  const days = relativeDays(iso);
  if (isOverdue) {
    const n = Math.abs(days);
    return { tone: "overdue", label: `${n} day${n === 1 ? "" : "s"} overdue` };
  }
  if (days < 0) return { tone: "ok", label: `Was due ${formatDate(iso)}` };
  if (days === 0) return { tone: "soon", label: "Due today" };
  if (days <= 3) return { tone: "soon", label: `Due in ${days} day${days === 1 ? "" : "s"}` };
  return { tone: "ok", label: `Due ${formatDate(iso)}` };
}

export function waitingLabel(days: number): string {
  if (days <= 0) return "Just now";
  return `${days} day${days === 1 ? "" : "s"} on this desk`;
}

export function timeAgo(iso: string): string {
  const days = Math.abs(relativeDays(iso));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} mo ago`;
}
