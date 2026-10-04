<!-- The handoff history for one contract: who passed the ball to whom, and why. -->
<script setup lang="ts">
import { formatDate, timeAgo } from '~/lib/format'
import type { Handoff } from '~/lib/types'
import KindBadge from './KindBadge.vue'

defineProps<{ handoffs: Handoff[] }>()
</script>

<template>
  <p v-if="handoffs.length === 0" class="muted">No handoffs recorded yet.</p>
  <ol v-else class="timeline">
    <li v-for="h in handoffs" :key="h.id" class="timeline__item">
      <span :class="`timeline__dot kind-${h.toStakeholder.kind}`" aria-hidden="true" />
      <div class="timeline__body">
        <div class="timeline__head">
          <strong>{{ h.toStakeholder.name }}</strong>
          <KindBadge :kind="h.toStakeholder.kind" />
          <span class="timeline__when">{{ timeAgo(h.createdAt) }}</span>
        </div>
        <p class="timeline__action">{{ h.action }}</p>
        <p v-if="h.note" class="timeline__note">&ldquo;{{ h.note }}&rdquo;</p>
        <p class="timeline__from">
          {{ h.fromStakeholder ? `Passed from ${h.fromStakeholder.name}` : 'Entered the pipeline' }}<template v-if="h.due"> &middot; due {{ formatDate(h.due) }}</template>
        </p>
      </div>
    </li>
  </ol>
</template>
