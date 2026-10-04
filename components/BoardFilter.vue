<!--
  The board's only filter. Each tile shows how many contracts match and selects
  them when clicked, so the number you read is exactly the list you get. The
  count and the filter can't disagree because they're the same predicate.

  What "overdue" and "stalled" mean is decided in server/lib/models.ts and
  arrives as a flag. This file only chooses which flag to filter on.
-->
<script lang="ts">
import type { Contract } from '~/lib/types'

export type AttentionFilter = 'all' | 'overdue' | 'stalled'

// A plain <script> block, because <script setup> can't export: the page runs
// its visible list through this same table.
export const ATTENTION: Record<AttentionFilter, (c: Contract) => boolean> = {
  all: () => true,
  overdue: c => c.isOverdue,
  stalled: c => c.isStalled,
}
</script>

<script setup lang="ts">
const props = defineProps<{ contracts: Contract[] }>()
const value = defineModel<AttentionFilter>({ required: true })

// The hints matter more than they look: overdue and stalled are different
// questions, not two severities of one, and they select overlapping but
// different sets. Without a definition on screen that reads as a bug.
const TILES: { key: AttentionFilter, label: string, tone: string, hint: string }[] = [
  { key: 'all', label: 'All', tone: 'neutral', hint: 'every contract on the board' },
  { key: 'overdue', label: 'Overdue', tone: 'danger', hint: 'past the due date someone set' },
  { key: 'stalled', label: 'Stalled', tone: 'warn', hint: '7+ days on one desk, dated or not' },
]

function count(key: AttentionFilter): number {
  return props.contracts.filter(ATTENTION[key]).length
}
</script>

<template>
  <div class="filter" role="group" aria-label="Filter the board">
    <button
      v-for="{ key, label, tone, hint } in TILES"
      :key="key"
      :class="`tile tile--${tone} ${value === key ? 'is-active' : ''}`"
      :aria-pressed="value === key"
      @click="value = key"
    >
      <span class="tile__value">{{ count(key) }}</span>
      <span class="tile__label">{{ label }}</span>
      <span class="tile__hint">{{ hint }}</span>
    </button>
  </div>
</template>
