<script setup lang="ts">
import { initials } from '~/lib/format'
import type { Stakeholder } from '~/lib/types'

withDefaults(defineProps<{ stakeholder: Stakeholder, size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <span
    :class="`avatar avatar-${size} kind-${stakeholder.kind}`"
    :title="`${stakeholder.name} - ${stakeholder.organization}`"
    aria-hidden="true"
  >{{ initials(stakeholder.name) }}</span>
</template>
