<template>
  <section class="hud-telemetry-panel app-panel" aria-label="실시간 해양 기상 입력값">
    <div v-if="error" class="hud-alert" role="status">
      <span class="alert-icon" aria-hidden="true">⚠</span>
      <span class="alert-text">{{ error }}</span>
      <button class="alert-retry" @click="$emit('retry')">다시 시도</button>
    </div>

    <div v-else-if="!hasMarineData" class="hud-alert subtle" role="status">
      <span class="alert-icon" aria-hidden="true">ⓘ</span>
      <span class="alert-text">
        이 좌표에는 해양 예보 자료가 없습니다(육지 또는 격자 밖). 파고 0 m로 두고 계산합니다.
      </span>
    </div>

    <div class="hud-grid">
      <div v-for="cell in cells" :key="cell.label" class="hud-cell">
        <span class="cell-label">{{ cell.label }}</span>
        <div class="cell-val-box">
          <span class="val">{{ cell.value }}</span>
          <span class="unit">{{ cell.unit }}</span>
        </div>
        <ConfidenceBadge v-if="cell.quantity" :quantity="cell.quantity" />
        <span v-else class="cell-src">실측</span>
      </div>
    </div>

    <p class="hud-footnote">
      데이터 <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0) ·
      계산 <a href="https://github.com/shiplab/vesseljs" target="_blank" rel="noopener">Vessel.js</a> (NTNU ShipLab, MIT)
      <span class="freshness">
        · {{ freshness }}
      </span>
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import ConfidenceBadge from '../common/ConfidenceBadge.vue';

const props = defineProps({
  snapshot: { type: Object, default: null },
  hasMarineData: { type: Boolean, default: true },
  error: { type: String, default: null },
  servedFromCache: { type: Boolean, default: false },
  ageMinutes: { type: Number, default: null }
});

defineEmits(['retry']);

const num = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '—');

const cells = computed(() => {
  const s = props.snapshot;
  if (!s) return [];
  return [
    { label: '유의파고 Hs', value: num(s.sea.waveHeight, 2), unit: 'm' },
    { label: '파주기 Tp', value: num(s.sea.wavePeriod, 1), unit: 's' },
    { label: '파향 θw', value: num(s.sea.waveDirection, 0), unit: '°' },
    { label: '상대 파향', value: num(s.relativeWaveHeading, 0), unit: '°' },
    { label: '해류 Vc', value: num(s.sea.currentVelocity, 2), unit: 'm/s' },
    { label: '해류 방향 θc', value: num(s.sea.currentDirection, 0), unit: '°' },
    { label: '풍속 Vw', value: num(s.sea.windSpeed, 1), unit: 'm/s' },
    {
      label: '파랑 에너지',
      value: num(s.wavePower.value, 1),
      unit: 'kW/m',
      quantity: s.wavePower
    }
  ];
});

const freshness = computed(() => {
  if (props.ageMinutes === null) return '갱신 정보 없음';
  const age = props.ageMinutes < 1 ? '방금' : `${props.ageMinutes}분 전`;
  return props.servedFromCache ? `${age} 저장된 값 (오프라인)` : `${age} 갱신`;
});
</script>

<style scoped>
.hud-telemetry-panel {
  background: rgba(18, 24, 36, 0.94);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 18px;
  width: 100%;
  box-sizing: border-box;
}

.hud-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: var(--status-danger);
  font-size: 0.72rem;
  font-weight: 700;
}

.hud-alert.subtle {
  background: rgba(148, 163, 184, 0.1);
  border-color: rgba(148, 163, 184, 0.4);
  color: var(--text-secondary);
}

.alert-text { flex: 1; min-width: 0; }

.alert-retry {
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  border-radius: 4px;
  padding: 3px 9px;
  font-size: 0.68rem;
  font-weight: 800;
  cursor: pointer;
}

.hud-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px;
}

.hud-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.cell-label {
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-val-box { display: flex; align-items: baseline; gap: 3px; }
.val { font-size: 1.05rem; font-weight: 900; color: var(--text-primary); }
.unit { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); }

.cell-src {
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--text-muted);
}

.hud-footnote {
  margin: 10px 0 0;
  font-size: 0.62rem;
  color: var(--text-muted);
  line-height: 1.5;
}
.hud-footnote a { color: var(--text-secondary); }
.freshness { white-space: nowrap; }

@media (max-width: 1100px) {
  .hud-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .hud-telemetry-panel { padding: 8px 10px; }
  .hud-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .val { font-size: 0.85rem; }
  .cell-label { font-size: 0.52rem; }
}
</style>
