<template>
  <div class="marine-dashboard-fullscreen">
    <!-- Top Header & Level 1~4 Tabs -->
    <header class="hud-header">
      <div class="header-left">
        <div class="hd-brand">
          <span class="skala-logo">S<span class="skala-k">K</span>ALA</span>
          <span class="skala-sub">marine</span>
          <span class="system-tag">VESSEL.JS × OPEN-METEO</span>
        </div>
      </div>

      <div class="header-center">
        <div class="level-tabs">
          <button 
            v-for="lvl in levelModes" 
            :key="lvl.id"
            class="level-tab-btn"
            :class="{ active: currentLevelId === lvl.id }"
            @click="currentLevelId = lvl.id"
          >
            <span class="lvl-num">LVL {{ lvl.level }}</span>
            <span class="lvl-title">{{ lvl.title }}</span>
          </button>
        </div>
      </div>

      <div class="header-right">
        <div class="live-status-pill">
          <span class="status-dot" :class="{ fetching: isFetchingData }"></span>
          <span>{{ pingLat.toFixed(4) }}°N {{ pingLon.toFixed(4) }}°E</span>
        </div>
      </div>
    </header>

    <!-- Main Viewport (Left: Ping Map, Right: Vessel.js 3D) -->
    <main class="dashboard-viewport">
      <div class="viewport-col map-col">
        <PingOceanMap
          :ping-lat="pingLat"
          :ping-lon="pingLon"
          :no-data-zone="isNoDataZone"
          @update-ping="onPingUpdate"
        />
      </div>

      <div class="viewport-col sim-col">
        <VesselJsSimulator
          :wave-height="marineWaveHeight"
          :wave-period="marineWavePeriod"
          :wave-direction="marineWaveDirection"
          :current-velocity="marineCurrentVelocity"
          :current-direction="marineCurrentDirection"
          :wind-speed="windSpeed"
          :wind-direction="windDirection"
          :active-level="currentLevelId"
        />
      </div>
    </main>

    <!-- Bottom: Live Marine API Telemetry HUD -->
    <footer class="dashboard-footer">
      <LiveMarineTelemetryHUD
        :marine-data="meteo.marine.value || {}"
        :current-weather="meteo.current"
        :active-level="currentLevelId"
      />
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useOpenMeteo } from '../composables/useOpenMeteo';

import PingOceanMap from '../components/marine/PingOceanMap.vue';
import VesselJsSimulator from '../components/marine/VesselJsSimulator.vue';
import LiveMarineTelemetryHUD from '../components/marine/LiveMarineTelemetryHUD.vue';

const meteo = useOpenMeteo();

const pingLat = ref(35.1234);
const pingLon = ref(129.5678);
const isFetchingData = ref(false);
const currentLevelId = ref('lvl1');

const levelModes = [
  { id: 'lvl1', level: 1, title: '6-DOF SEAKEEPING (Ship in Regular Ocean)' },
  { id: 'lvl2', level: 2, title: 'DRIFT & MANOEUVRING (Current Vector)' },
  { id: 'lvl3', level: 3, title: 'WIND HEEL & STABILITY (Wind Force)' },
  { id: 'lvl4', level: 4, title: 'ADDED RESISTANCE & SPEED LOSS (Holtrop)' }
];

// Marine API data → Vessel.js wave parameters
const marineWaveHeight = computed(() => meteo.marine.value?.waveHeight || 1.5);
const marineWavePeriod = computed(() => meteo.marine.value?.wavePeriod || 8.0);
const marineWaveDirection = computed(() => meteo.marine.value?.waveDirection || 180);
const marineCurrentVelocity = computed(() => meteo.marine.value?.currentVelocity || 0);
const marineCurrentDirection = computed(() => meteo.marine.value?.currentDirection || 0);
const windSpeed = computed(() => meteo.current?.windSpeed || 0);
const windDirection = computed(() => meteo.current?.windDirection || 0);

// Detect if Marine API returned no data for this location
const isNoDataZone = computed(() => {
  const m = meteo.marine.value;
  if (!m) return false;
  // null, undefined, NaN, or 0 all indicate no marine data
  const h = m.waveHeight;
  const p = m.wavePeriod;
  return (h === null || h === undefined || isNaN(h)) &&
         (p === null || p === undefined || isNaN(p));
});

let fetchDebounceTimer = null;

const fetchMarineData = async (lat, lon) => {
  isFetchingData.value = true;
  try {
    await Promise.all([
      meteo.fetchForecast(lat, lon),
      meteo.fetchMarine(lat, lon)
    ]);
  } finally {
    isFetchingData.value = false;
  }
};

const onPingUpdate = (pos) => {
  pingLat.value = pos.lat;
  pingLon.value = pos.lon;

  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
  fetchDebounceTimer = setTimeout(() => {
    fetchMarineData(pos.lat, pos.lon);
  }, 400);
};

onMounted(() => {
  fetchMarineData(pingLat.value, pingLon.value);
});

onUnmounted(() => {
  if (fetchDebounceTimer) clearTimeout(fetchDebounceTimer);
});
</script>

<style scoped>
.marine-dashboard-fullscreen {
  width: 100vw;
  height: 100vh;
  height: 100dvh; /* mobile address bar safe */
  background-color: #0b0f17;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.hud-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 24px;
  background: #090c13;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}

.hd-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}

.skala-logo {
  font-weight: 900;
  font-size: 1.15rem;
  letter-spacing: 3px;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
}

.skala-k {
  color: var(--hd-green-primary);
}

.skala-sub {
  font-weight: 600;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
  text-transform: lowercase;
}

.system-tag {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--hd-green-primary);
  background: var(--hd-green-dim);
  border: 1px solid rgba(0, 162, 97, 0.3);
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.header-center {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.level-tabs {
  display: flex;
  gap: 6px;
}

.level-tab-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  white-space: nowrap;
}

.lvl-num {
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--text-muted);
}

.lvl-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.level-tab-btn.active {
  background: var(--hd-green-dim);
  border-color: var(--hd-green-primary);
}

.level-tab-btn.active .lvl-num,
.level-tab-btn.active .lvl-title {
  color: var(--hd-green-primary);
}

.live-status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--hd-green-primary);
  box-shadow: 0 0 8px var(--hd-green-primary);
  flex-shrink: 0;
}

.status-dot.fetching {
  background-color: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
  animation: blink 0.5s infinite;
}

@keyframes blink {
  50% { opacity: 0.2; }
}

/* ── Main Viewport ── */
.dashboard-viewport {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px 24px;
  box-sizing: border-box;
  overflow: hidden;
  min-height: 0;
}

.viewport-col {
  height: 100%;
  position: relative;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
}

.dashboard-footer {
  padding: 0 24px 12px;
  flex-shrink: 0;
}

/* ── Responsive: narrow screens ── */
@media (max-width: 1100px) {
  .hud-header {
    padding: 8px 16px;
  }

  .level-tab-btn {
    padding: 4px 8px;
  }

  .lvl-title {
    font-size: 0.6rem;
  }

  .dashboard-viewport {
    padding: 8px 16px;
    gap: 8px;
  }

  .dashboard-footer {
    padding: 0 16px 8px;
  }
}

@media (max-width: 900px) {
  .hud-header {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }

  .header-left { order: 1; }
  .header-right { order: 2; margin-left: auto; }
  .header-center {
    order: 3;
    width: 100%;
    flex-basis: 100%;
  }

  .level-tabs {
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .dashboard-viewport {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
    padding: 8px 12px;
    gap: 8px;
  }
}

@media (max-width: 640px) {
  .system-tag { display: none; }
  .skala-sub { display: none; }

  .live-status-pill {
    font-size: 0.65rem;
    padding: 3px 8px;
  }

  .hud-header {
    padding: 6px 10px;
    gap: 6px;
  }

  .level-tab-btn {
    padding: 4px 6px;
  }

  .lvl-title {
    font-size: 0.5rem;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lvl-num {
    font-size: 0.55rem;
  }

  .dashboard-viewport {
    padding: 4px 6px;
    gap: 4px;
  }

  .dashboard-footer {
    padding: 0 6px 4px;
  }
}

@media (max-width: 480px) {
  .header-left { order: 1; }
  .header-right { order: 2; margin-left: auto; }
  .header-center {
    order: 3;
    width: 100%;
    flex-basis: 100%;
  }

  .hud-header {
    flex-wrap: wrap;
  }

  .level-tabs {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .level-tab-btn {
    min-width: 0;
    flex: 1;
  }

  .lvl-title {
    display: none;
  }

  .dashboard-viewport {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
}
</style>
