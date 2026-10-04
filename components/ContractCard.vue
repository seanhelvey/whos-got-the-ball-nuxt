<!--
  One contract on the board: who has the ball, what they owe, and how long it's
  been sitting. Expands to show the full handoff history.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { KIND_LABELS, STATUS_LABELS, currency, dueMeta, waitingLabel } from '~/lib/format'
import type { Contract } from '~/lib/types'
import HandoffTimeline from './HandoffTimeline.vue'
import StakeholderAvatar from './StakeholderAvatar.vue'

const props = defineProps<{ contract: Contract }>()
defineEmits<{ passBall: [contract: Contract] }>()

const showHistory = ref(false)
const holder = computed(() => props.contract.currentHolder)
const due = computed(() => dueMeta(props.contract.actionDue, props.contract.isOverdue))
</script>

<template>
  <article
    class="card"
    :data-kind="holder?.kind ?? 'none'"
    :data-overdue="contract.isOverdue"
  >
    <header class="card__head">
      <h3 class="card__title">{{ contract.name }}</h3>
      <span class="card__value">{{ currency(contract.valueUsd) }}</span>
    </header>
    <p class="card__customer">
      {{ contract.customer }} &middot; {{ STATUS_LABELS[contract.status] }}
    </p>

    <!-- The kind is spelled out, not just colour coded: whether the ball is with
         our team or an outside party is the fact that decides what you do next. -->
    <div class="holder">
      <span class="holder__label">{{ contract.isDone ? 'Last held by' : 'Ball with' }}</span>
      <div v-if="holder" class="holder__who">
        <StakeholderAvatar :stakeholder="holder" />
        <span class="holder__text">
          <strong>{{ holder.name }}</strong>
          <span class="holder__meta">
            {{ KIND_LABELS[holder.kind] }} &middot; {{ holder.organization }}
          </span>
        </span>
      </div>
      <span v-else class="muted">Unassigned</span>
    </div>

    <p class="card__action">
      {{ contract.currentAction ?? 'No pending action.' }}
    </p>

    <!-- If a contract is counted under "Stalled", its face has to say why. -->
    <p class="card__timing">
      {{ waitingLabel(contract.daysWaiting) }}<template v-if="due"> &middot; <span :class="`due--${due.tone}`">{{ due.label }}</span></template><span v-if="contract.isStalled" class="flag flag--stalled">Stalled</span>
    </p>

    <footer class="card__actions">
      <button class="btn btn--primary" @click="$emit('passBall', contract)">
        Pass the ball
      </button>
      <button
        class="btn btn--quiet"
        :aria-expanded="showHistory"
        @click="showHistory = !showHistory"
      >
        {{ showHistory ? 'Hide history' : `History (${contract.handoffs.length})` }}
      </button>
    </footer>

    <div v-if="showHistory" class="card__history">
      <HandoffTimeline :handoffs="contract.handoffs" />
    </div>
  </article>
</template>
