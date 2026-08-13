<template>
  <div class="hud-telemetry-panel hd-panel">
    <div class="hud-grid">
      <!-- 1. Wave Metrics -->
      <div class="hud-cell">
        <span class="cell-label">WAVE HEIGHT (Hs)</span>
        <div class="cell-val-box">
          <span class="val">{{ waveHeight.toFixed(2) }}</span>
          <span class="unit">m</span>
        </div>
      </div>

      <div class="hud-cell">
        <span class="cell-label">WAVE PERIOD (Tp)</span>
        <div class="cell-val-box">
          <span class="val">{{ wavePeriod.toFixed(1) }}</span>
          <span class="unit">s</span>
        </div>
      </div>

      <div class="hud-cell">
        <span class="cell-label">WAVE DIRECTION (θw)</span>
        <div class="cell-val-box">
          <span class="val">{{ waveDirection }}</span>
          <span class="unit">°</span>
        </div>
      </div>

      <!-- 2. Current Metrics -->
      <div class="hud-cell">
        <span class="cell-label">CURRENT VELOCITY (Vc)</span>
        <div class="cell-val-box">
          <span class="val">{{ currentVelocity.toFixed(2) }}</span>
          <span class="unit">m/s</span>
        </div>
      </div>

      <div class="hud-cell">
        <span class="cell-label">CURRENT DIR (θc)</span>
        <div class="cell-val-box">
          <span class="val">{{ currentDirection }}</span>
          <span class="unit">°</span>
        </div>
      </div>

      <!-- 3. Wind & Hydrodynamics -->
      <div class="hud-cell">
        <span class="cell-label">WIND SPEED (Vw)</span>
        <div class="cell-val-box">
          <span class="val">{{ windSpeed.toFixed(1) }}</span>
          <span class="unit">km/h</span>
        </div>
      </div>

      <div class="hud-cell">
        <span class="cell-label">WAVE POWER FLUX (Pw)</span>
        <div class="cell-val-box">
          <span class="val">{{ wavePowerFlux.toFixed(1) }}</span>
          <span class="unit">kW/m</span>
        </div>
      </div>

      <div class="hud-cell">
        <span class="cell-label">ADDED RESISTANCE (ΔRaw)</span>
        <div class="cell-val-box">
          <span class="val">{{ addedResistance.toFixed(0) }}</span>
          <span class="unit">kN</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  marineData: { type: Object, default: () => ({}) },
  currentWeather: { type: Object, default: () => ({}) },
  activeLevel: { type: String, default: 'lvl1' }
});

const waveHeight = computed(() => props.marineData?.waveHeight || 0);
const wavePeriod = computed(() => props.marineData?.wavePeriod || 0);
const waveDirection = computed(() => Math.round(props.marineData?.waveDirection || 0));

const currentVelocity = computed(() => props.marineData?.currentVelocity || 0);
const currentDirection = computed(() => Math.round(props.marineData?.currentDirection || 0));

const windSpeed = computed(() => props.currentWeather?.windSpeed || 0);

// Wave Power Energy Flux (kW/m) = 0.49 * Hs^2 * Tp
const wavePowerFlux = computed(() => {
  if (waveHeight.value <= 0 || wavePeriod.value <= 0) return 0;
  return 0.49 * (waveHeight.value * waveHeight.value) * wavePeriod.value;
});

// Holtrop Added Wave Resistance Estimation (kN)
const addedResistance = computed(() => {
  if (waveHeight.value <= 0) return 0;
  return 18.5 * (waveHeight.value * waveHeight.value) * Math.sqrt(290 / 100);
});
</script>

<style scoped>
.hud-telemetry-panel {
  background: rgba(18, 24, 36, 0.94);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color);
  padding: 16px 24px;
  width: 100%;
  box-sizing: border-box;
}

.hud-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 12px;
}

.hud-cell {
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  padding: 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.cell-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  white-space: nowrap;
}

.cell-val-box {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.val {
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1;
}

.unit {
  font-size: 0.7rem;
  color: var(--hd-green-primary);
  font-weight: 700;
}

@media (max-width: 1200px) {
  .hud-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .hud-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .hud-telemetry-panel {
    padding: 10px 12px;
  }
  .cell-label {
    font-size: 0.55rem;
  }
  .val {
    font-size: 1.05rem;
  }
}

@media (max-width: 480px) {
  .hud-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .hud-telemetry-panel {
    padding: 6px 6px;
  }
  .hud-cell {
    padding: 6px;
  }
  .cell-label {
    font-size: 0.48rem;
    white-space: normal;
    line-height: 1.2;
  }
  .val {
    font-size: 0.9rem;
  }
  .unit {
    font-size: 0.55rem;
  }
}
</style>
