<script setup lang="ts">
import { KIND_LABELS } from '~/lib/format'
import type { StakeholderKind } from '~/lib/types'

defineProps<{ kind: StakeholderKind }>()
</script>

<template>
  <span :class="`badge kind-${kind}`">{{ KIND_LABELS[kind] }}</span>
</template>
