<template>
  <div class="vesseljs-viewport">
    <iframe
      ref="vesselFrame"
      src="/vesseljs/examples/vessel_simulation.html"
      class="vessel-iframe"
      frameborder="0"
      allowfullscreen
    ></iframe>

    <!-- RAO overlay changes by level -->
    <div class="rao-overlay">
      <!-- Level 1: Seakeeping -->
      <template v-if="activeLevel === 'lvl1'">
        <div class="rao-cell">
          <span class="rao-lbl">HEAVE</span>
          <span class="rao-val">{{ motionData.heaveAmp.toFixed(2) }} m</span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">PITCH</span>
          <span class="rao-val">{{ (motionData.pitchAmp * 180 / Math.PI).toFixed(1) }}°</span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">ROLL</span>
          <span class="rao-val" :style="{ color: Math.abs(motionData.rollAmp * 180 / Math.PI) > 10 ? '#ef4444' : '#00a261' }">
            {{ (motionData.rollAmp * 180 / Math.PI).toFixed(1) }}°
          </span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">VERT. ACC.</span>
          <span class="rao-val">{{ motionData.verticalAcc.toFixed(2) }} m/s²</span>
        </div>
      </template>

      <!-- Level 2: Drift & Manoeuvring -->
      <template v-else-if="activeLevel === 'lvl2'">
        <div class="rao-cell">
          <span class="rao-lbl">DRIFT ANGLE</span>
          <span class="rao-val" :style="{ color: Math.abs(motionData.driftAngle) > 5 ? '#ef4444' : '#00a261' }">
            {{ motionData.driftAngle.toFixed(1) }}°
          </span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">RUDDER COMP.</span>
          <span class="rao-val">{{ motionData.rudderComp.toFixed(1) }}°</span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">LATERAL DRIFT</span>
          <span class="rao-val">{{ motionData.lateralDrift.toFixed(2) }} m/s</span>
        </div>
      </template>

      <!-- Level 3: Wind Heel & Stability -->
      <template v-else-if="activeLevel === 'lvl3'">
        <div class="rao-cell">
          <span class="rao-lbl">WIND HEEL</span>
          <span class="rao-val" :style="{ color: motionData.windHeelDeg > 15 ? '#ef4444' : '#00a261' }">
            {{ motionData.windHeelDeg.toFixed(1) }}°
          </span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">GMt</span>
          <span class="rao-val">{{ motionData.gmt.toFixed(2) }} m</span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">STABILITY</span>
          <span class="rao-val" :style="{ color: motionData.gmtStatus === 'SAFE' ? '#00a261' : motionData.gmtStatus === 'WARNING' ? '#f59e0b' : '#ef4444' }">
            {{ motionData.gmtStatus }}
          </span>
        </div>
      </template>

      <!-- Level 4: Resistance & Speed Loss -->
      <template v-else-if="activeLevel === 'lvl4'">
        <div class="rao-cell">
          <span class="rao-lbl">ΔRaw</span>
          <span class="rao-val">{{ motionData.addedRes.toFixed(1) }} kN</span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">SPEED LOSS</span>
          <span class="rao-val" :style="{ color: motionData.speedLossPct > 10 ? '#ef4444' : '#00a261' }">
            {{ motionData.speedLossPct.toFixed(1) }}%
          </span>
        </div>
        <div class="rao-cell">
          <span class="rao-lbl">EFF. POWER</span>
          <span class="rao-val">{{ motionData.effectivePower.toFixed(0) }} kW</span>
        </div>
      </template>
    </div>

    <button class="ghost-toggle" :class="{ active: showGhost }" @click="toggleGhost">
      <span class="toggle-dot"></span>
      REFERENCE
    </button>

    <div class="engine-tag">⚓ VESSEL.JS — NTNU ShipLab (PX121 PSV)</div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, reactive } from 'vue';

const props = defineProps({
  waveHeight: { type: Number, default: 1.5 },
  wavePeriod: { type: Number, default: 8.0 },
  waveDirection: { type: Number, default: 180 },
  currentVelocity: { type: Number, default: 0 },
  currentDirection: { type: Number, default: 0 },
  windSpeed: { type: Number, default: 0 },
  windDirection: { type: Number, default: 0 },
  activeLevel: { type: String, default: 'lvl1' }
});

const vesselFrame = ref(null);

const motionData = reactive({
  heaveAmp: 0,
  pitchAmp: 0,
  rollAmp: 0,
  verticalMov: 0,
  verticalAcc: 0,
  // Level 2
  driftAngle: 0,
  rudderComp: 0,
  lateralDrift: 0,
  // Level 3
  windHeelDeg: 0,
  gmt: 0,
  gmtStatus: 'N/A',
  // Level 4
  calmRes: 0,
  addedRes: 0,
  effectivePower: 0,
  speedLossPct: 0
});

const showGhost = ref(false);

const toggleGhost = () => {
  showGhost.value = !showGhost.value;
  if (vesselFrame.value && vesselFrame.value.contentWindow) {
    vesselFrame.value.contentWindow.postMessage({
      type: 'MARINE_API_UPDATE',
      showGhost: showGhost.value
    }, '*');
  }
};

// Send Marine API data to Vessel.js iframe
const sendMarineData = () => {
  if (vesselFrame.value && vesselFrame.value.contentWindow) {
    vesselFrame.value.contentWindow.postMessage({
      type: 'MARINE_API_UPDATE',
      waveHeight: props.waveHeight,
      wavePeriod: props.wavePeriod,
      waveDirection: props.waveDirection,
      currentVelocity: props.currentVelocity,
      currentDirection: props.currentDirection,
      windSpeed: props.windSpeed,
      windDirection: props.windDirection,
      activeLevel: props.activeLevel,
      showGhost: showGhost.value
    }, '*');
  }
};

// Receive motion telemetry from Vessel.js engine
const onMessage = (event) => {
  if (event.data && event.data.type === 'VESSEL_MOTION_DATA') {
    motionData.heaveAmp = event.data.heaveAmp || 0;
    motionData.pitchAmp = event.data.pitchAmp || 0;
    motionData.rollAmp = event.data.rollAmp || 0;
    motionData.verticalMov = event.data.verticalMov || 0;
    motionData.verticalAcc = event.data.verticalAcc || 0;
    // Level 2
    motionData.driftAngle = event.data.driftAngle || 0;
    motionData.rudderComp = event.data.rudderComp || 0;
    motionData.lateralDrift = event.data.lateralDrift || 0;
    // Level 3
    motionData.windHeelDeg = event.data.windHeelDeg || 0;
    motionData.gmt = event.data.gmt || 0;
    motionData.gmtStatus = event.data.gmtStatus || 'N/A';
    // Level 4
    motionData.calmRes = event.data.calmRes || 0;
    motionData.addedRes = event.data.addedRes || 0;
    motionData.effectivePower = event.data.effectivePower || 0;
    motionData.speedLossPct = event.data.speedLossPct || 0;
  }
};

watch(() => [props.waveHeight, props.wavePeriod, props.waveDirection, 
             props.currentVelocity, props.currentDirection,
             props.windSpeed, props.windDirection, props.activeLevel], () => {
  sendMarineData();
});

onMounted(() => {
  window.addEventListener('message', onMessage);

  // Wait for iframe to load, then send initial data
  if (vesselFrame.value) {
    vesselFrame.value.addEventListener('load', () => {
      setTimeout(sendMarineData, 1000);
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('message', onMessage);
});
</script>

<style scoped>
.vesseljs-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: #0b0f17;
}

.vessel-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.rao-overlay {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.rao-cell {
  background: rgba(11, 15, 23, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rao-lbl {
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.rao-val {
  font-size: 1rem;
  font-weight: 900;
  color: var(--text-primary);
}

.engine-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(11, 15, 23, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-color);
  color: var(--hd-green-primary);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  z-index: 10;
}

.ghost-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(11, 15, 23, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  cursor: pointer;
  z-index: 10;
  transition: all 0.25s ease;
}

.toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  transition: all 0.25s ease;
}

.ghost-toggle:hover {
  border-color: rgba(0, 162, 97, 0.5);
  color: rgba(255, 255, 255, 0.8);
}

.ghost-toggle.active {
  background: rgba(0, 162, 97, 0.15);
  border-color: var(--hd-green-primary);
  color: var(--hd-green-primary);
}

.ghost-toggle.active .toggle-dot {
  background: var(--hd-green-primary);
  box-shadow: 0 0 6px var(--hd-green-primary);
}

@media (max-width: 640px) {
  .rao-overlay {
    bottom: 8px;
    left: 8px;
    gap: 4px;
  }
  .rao-cell {
    padding: 4px 8px;
  }
  .rao-lbl { font-size: 0.5rem; }
  .rao-val { font-size: 0.8rem; }
  .engine-tag {
    top: 6px; right: 6px;
    padding: 4px 8px;
    font-size: 0.55rem;
  }
  .ghost-toggle {
    top: 6px; left: 6px;
    padding: 5px 10px;
    font-size: 0.55rem;
  }
}
</style>
