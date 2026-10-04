<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BoardFilter, { ATTENTION, type AttentionFilter } from '~/components/BoardFilter.vue'
import ContractCard from '~/components/ContractCard.vue'
import PassBallModal from '~/components/PassBallModal.vue'
import { fetchBoard, passBall } from '~/lib/api'
import type { Contract, PassBallInput, Stakeholder } from '~/lib/types'

// Sort so the deals that need attention float to the top: overdue first, then
// stalled, then whatever has been sitting longest on a single desk. Delivered
// deals sink regardless of how long they sat. `days_waiting` keeps counting on
// them, so without this a finished deal can own the top left card.
function byAttention(a: Contract, b: Contract): number {
  if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
  if (a.isStalled !== b.isStalled) return a.isStalled ? -1 : 1
  return b.daysWaiting - a.daysWaiting
}

const contracts = ref<Contract[]>([])
const stakeholders = ref<Stakeholder[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const attention = ref<AttentionFilter>('all')
const activeContract = ref<Contract | null>(null)

async function load() {
  try {
    error.value = null
    const data = await fetchBoard()
    contracts.value = data.contracts
    stakeholders.value = data.stakeholders
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load the board.'
  }
  finally {
    loading.value = false
  }
}

// Fetched in the browser after mount, as the React app did, rather than during
// server rendering. The due and "days ago" labels are worked out against the
// viewer's clock, so rendering them on the server would print the server's
// day and then disagree with the client on hydration.
onMounted(load)

const visible = computed(() =>
  contracts.value.filter(ATTENTION[attention.value]).sort(byAttention),
)

async function handlePassBall(input: PassBallInput) {
  const { passBall: updated } = await passBall(input)
  // The mutation returns the same field selection the board holds, so the
  // authoritative row can be swapped straight in without a refetch.
  contracts.value = contracts.value.map(c => (c.id === updated.id ? updated : c))
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="topbar__inner">
        <div class="brand">
          <span class="brand__mark" aria-hidden="true">◐</span>
          <div>
            <h1 class="brand__name">Who&rsquo;s Got the Ball</h1>
            <p class="brand__tag">
              Exactly one party owns the next action on a contract. When the
              ball sits too long, deals stall — this is where it is.
            </p>
          </div>
        </div>
        <button class="btn btn--ghost" @click="load">
          Refresh
        </button>
      </div>
    </header>

    <main class="container">
      <p v-if="loading" class="state">Loading the board&hellip;</p>

      <div v-if="error" class="banner banner--error">
        <strong>Couldn&rsquo;t reach the API.</strong> {{ error }}
        <div class="banner__hint">
          Start the server with <code>npm run dev</code>, then Refresh.
        </div>
      </div>

      <template v-if="!loading && !error">
        <BoardFilter v-model="attention" :contracts="contracts" />

        <p class="board__caption">
          {{ attention === 'all'
            ? `All ${visible.length} contracts, most urgent first.`
            : `Showing ${visible.length} ${attention} of ${contracts.length}.` }}
        </p>

        <p v-if="visible.length === 0" class="state">No contracts match this filter.</p>
        <div v-else class="board">
          <ContractCard
            v-for="c in visible"
            :key="c.id"
            :contract="c"
            @pass-ball="activeContract = $event"
          />
        </div>
      </template>
    </main>

    <PassBallModal
      v-if="activeContract"
      :contract="activeContract"
      :stakeholders="stakeholders"
      :submit="handlePassBall"
      @close="activeContract = null"
    />
  </div>
</template>
