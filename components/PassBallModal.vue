<!--
  Modal for handing the ball to another stakeholder. Small accessibility
  niceties: Escape to close, click outside to close, autofocus, labelled fields.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { KIND_LABELS } from '~/lib/format'
import type { Contract, PassBallInput, Stakeholder } from '~/lib/types'
import StakeholderAvatar from './StakeholderAvatar.vue'

const KIND_ORDER: Stakeholder['kind'][] = [
  'internal',
  'customer',
  'utility',
  'installer',
  'financier',
  'ahj',
]

const props = defineProps<{
  contract: Contract
  stakeholders: Stakeholder[]
  // A function prop rather than an emit, because the modal awaits it to know
  // whether to close or show the server's error.
  submit: (input: PassBallInput) => Promise<void>
}>()
const emit = defineEmits<{ close: [] }>()

const toId = ref<number | ''>('')
const action = ref('')
const note = ref('')
const due = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const firstField = ref<HTMLSelectElement | null>(null)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  firstField.value?.focus()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

// Group the stakeholder options by kind for a scannable dropdown.
const grouped = computed(() =>
  KIND_ORDER.map(kind => ({
    kind,
    people: props.stakeholders.filter(s => s.kind === kind),
  })).filter(g => g.people.length > 0),
)

const selected = computed(() => props.stakeholders.find(s => s.id === toId.value) ?? null)

async function handleSubmit() {
  if (toId.value === '' || !action.value.trim()) {
    error.value = 'Pick who gets the ball and describe the next action.'
    return
  }
  error.value = null
  saving.value = true
  try {
    await props.submit({
      contractId: props.contract.id,
      toStakeholderId: toId.value,
      action: action.value.trim(),
      note: note.value.trim() || null,
      due: due.value || null,
    })
    emit('close')
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Something went wrong.'
    saving.value = false
  }
}
</script>

<template>
  <div class="overlay" @click="emit('close')">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      @click.stop
    >
      <header class="modal__head">
        <div>
          <p class="modal__eyebrow">Pass the ball</p>
          <h2 id="modal-title" class="modal__title">{{ contract.name }}</h2>
        </div>
        <button class="icon-btn" aria-label="Close" @click="emit('close')">
          &times;
        </button>
      </header>

      <p v-if="contract.currentHolder" class="modal__current">
        Currently with <strong>{{ contract.currentHolder.name }}</strong>{{ contract.currentAction ? `: ${contract.currentAction}` : '' }}
      </p>

      <form class="form" @submit.prevent="handleSubmit">
        <label class="field">
          <span class="field__label">Hand off to</span>
          <select ref="firstField" v-model="toId" class="field__input">
            <option value="">Select a stakeholder&hellip;</option>
            <optgroup v-for="group in grouped" :key="group.kind" :label="KIND_LABELS[group.kind]">
              <option v-for="p in group.people" :key="p.id" :value="p.id">
                {{ p.name }} - {{ p.role }}
              </option>
            </optgroup>
          </select>
        </label>

        <div v-if="selected" class="form__preview">
          <StakeholderAvatar :stakeholder="selected" size="sm" />
          <span>
            {{ selected.role }} at {{ selected.organization }}
          </span>
        </div>

        <label class="field">
          <span class="field__label">Next action they own</span>
          <input
            v-model="action"
            class="field__input"
            placeholder="e.g. Approve the revised structural permit set"
          >
        </label>

        <div class="field-row">
          <label class="field">
            <span class="field__label">Due date <span class="muted">(optional)</span></span>
            <input v-model="due" class="field__input" type="date">
          </label>
        </div>

        <label class="field">
          <span class="field__label">Note <span class="muted">(optional)</span></span>
          <textarea
            v-model="note"
            class="field__input"
            rows="2"
            placeholder="Context that helps them move fast."
          />
        </label>

        <p v-if="error" class="form__error">{{ error }}</p>

        <div class="form__actions">
          <button type="button" class="btn btn--ghost" @click="emit('close')">
            Cancel
          </button>
          <button type="submit" class="btn btn--primary" :disabled="saving">
            {{ saving ? 'Passing…' : 'Pass the ball' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
