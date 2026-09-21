<template>
  <span
    class="conf-badge"
    :class="`conf-${quantity.confidence}`"
    :title="tooltip"
    :aria-label="tooltip"
    tabindex="0"
  >
    <span class="conf-mark" aria-hidden="true">{{ mark }}</span>
    <span class="conf-text">{{ label }}</span>
    <span v-if="outOfRange" class="conf-warn">적용범위 밖</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';

/**
 * 계산값 옆에 붙는 신뢰 등급 배지.
 *
 * 이 프로젝트에서 가장 중요한 화면 요소다. 어떤 숫자가 검증된 라이브러리에서 나왔고
 * 어떤 숫자가 내가 만든 추정인지를 화면에서 구분하지 못하면, 나머지 검증 작업이 의미가 없다.
 * 색만으로 구분하지 않고 항상 글자를 함께 쓴다(명암비·색각 대응).
 */
const props = defineProps({
  quantity: { type: Object, required: true }
});

const LABELS = {
  library: { label: '라이브러리 계산', mark: '■' },
  reference: { label: '표준 절차', mark: '◆' },
  estimate: { label: '참고용 추정값', mark: '▲' },
  illustrative: { label: '화면 연출값', mark: '○' }
};

const label = computed(() => LABELS[props.quantity.confidence]?.label ?? '미분류');
const mark = computed(() => LABELS[props.quantity.confidence]?.mark ?? '?');
const outOfRange = computed(() => props.quantity.range?.inRange === false);

const tooltip = computed(() => {
  const parts = [`${label.value} · 방법: ${props.quantity.method}`];
  if (props.quantity.note) parts.push(props.quantity.note);
  if (props.quantity.range) {
    parts.push(`적용범위: ${props.quantity.range.description}`);
    if (outOfRange.value && props.quantity.range.outOfRangeNote) {
      parts.push(`⚠ ${props.quantity.range.outOfRangeNote}`);
    }
  }
  return parts.join('\n');
});
</script>

<style scoped>
.conf-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1.2;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  white-space: nowrap;
  cursor: help;
}

.conf-badge:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.conf-mark { font-size: 0.55rem; }

.conf-library {
  color: #7ee3b8;
  background: rgba(0, 162, 97, 0.14);
  border-color: rgba(0, 162, 97, 0.45);
}

.conf-reference {
  color: #9ec5ff;
  background: rgba(37, 99, 235, 0.16);
  border-color: rgba(96, 150, 255, 0.5);
}

.conf-estimate {
  color: #fbc76a;
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(245, 158, 11, 0.5);
}

.conf-illustrative {
  color: #cbd5e1;
  background: rgba(148, 163, 184, 0.16);
  border-color: rgba(148, 163, 184, 0.45);
}

.conf-warn {
  color: #ffb4a8;
  border-left: 1px solid currentColor;
  padding-left: 4px;
  margin-left: 2px;
}
</style>
