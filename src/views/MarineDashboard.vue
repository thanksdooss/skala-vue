<template>
  <div class="marine-dashboard-fullscreen">
    <header class="hud-header">
      <div class="header-left">
        <div class="app-brand">
          <span class="skala-logo">S<span class="skala-k">K</span>ALA</span>
          <span class="skala-sub">marine</span>
        </div>
      </div>

      <nav class="header-center" aria-label="시뮬레이션 모드">
        <div class="level-tabs" role="tablist">
          <button
            v-for="lvl in levelModes"
            :key="lvl.id"
            class="level-tab-btn"
            role="tab"
            :aria-selected="String(currentLevelId === lvl.id)"
            :class="{ active: currentLevelId === lvl.id }"
            @click="currentLevelId = lvl.id"
          >
            <span class="lvl-num">LVL {{ lvl.level }}</span>
            <span class="lvl-title">{{ lvl.title }}</span>
          </button>
        </div>
      </nav>

      <div class="header-right">
        <label class="heading-control">
          <span class="ctl-label">선수방위</span>
          <input
            v-model.number="headingDeg"
            type="range"
            min="0"
            max="359"
            step="5"
            aria-label="선수방위 (도)"
          />
          <output class="ctl-value">{{ headingDeg }}°</output>
        </label>

        <button
          class="compare-toggle"
          :class="{ active: compareMode }"
          :aria-pressed="String(compareMode)"
          @click="toggleCompare"
        >
          해역 비교
        </button>

        <!-- 비교 모드에서는 지도 클릭이 A와 B 중 어느 쪽을 바꾸는지 명시해야 한다. -->
        <div v-if="compareMode" class="slot-picker" role="group" aria-label="지도 클릭으로 바꿀 해역">
          <button
            v-for="slot in ['A', 'B']"
            :key="slot"
            class="slot-btn"
            :class="[`slot-${slot.toLowerCase()}`, { active: editingSlot === slot }]"
            :aria-pressed="String(editingSlot === slot)"
            @click="selectSlot(slot)"
          >
            {{ slot }} 지정
          </button>
        </div>

        <span class="live-status-pill">
          <span class="status-dot" :class="statusClass"></span>
          <span>{{ statusText }}</span>
        </span>
      </div>
    </header>

    <main class="dashboard-viewport" :class="{ 'three-col': compareMode }">
      <div class="viewport-col map-col">
        <PingOceanMap
          :ping-lat="areaA.lat"
          :ping-lon="areaA.lon"
          :no-data-zone="!meteo.hasMarineData.value"
          :secondary-ping="compareMode ? areaB : null"
          @update-ping="onPingUpdate"
        />
      </div>

      <div class="viewport-col sim-col">
        <VesselJsSimulator
          :snapshot="physics.snapshot.value"
          :active-level="currentLevelId"
        />
        <p v-if="physics.loadError.value" class="sim-error" role="alert">
          Vessel.js 엔진을 불러오지 못했습니다: {{ physics.loadError.value }}
        </p>
      </div>

      <div v-if="compareMode" class="viewport-col compare-col">
        <SeaAreaCompare
          :snap-a="snapshotA"
          :snap-b="snapshotB"
          :area-a="areaA"
          :area-b="areaB"
          :snapshot-for="physics.snapshotFor"
        />
      </div>
    </main>

    <footer class="dashboard-footer">
      <LiveMarineTelemetryHUD
        :snapshot="physics.snapshot.value"
        :has-marine-data="meteo.hasMarineData.value"
        :error="meteo.error.value"
        :served-from-cache="meteo.servedFromCache.value"
        :age-minutes="meteo.ageMinutes.value"
        @retry="meteo.retry"
      />
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useOpenMeteo } from '../composables/useOpenMeteo';
import { useVesselPhysics } from '../composables/useVesselPhysics';
import { toSeaState } from '../physics';

import PingOceanMap from '../components/marine/PingOceanMap.vue';
import VesselJsSimulator from '../components/marine/VesselJsSimulator.vue';
import LiveMarineTelemetryHUD from '../components/marine/LiveMarineTelemetryHUD.vue';
import SeaAreaCompare from '../components/marine/SeaAreaCompare.vue';

const KNOT = 0.514444;

const levelModes = [
  { id: 'lvl1', level: 1, title: '6자유도 운동' },
  { id: 'lvl2', level: 2, title: '해류 편류' },
  { id: 'lvl3', level: 3, title: '풍압 경사·복원성' },
  { id: 'lvl4', level: 4, title: '부가저항·속도 손실' }
];

const currentLevelId = ref('lvl1');
const headingDeg = ref(0);
const compareMode = ref(false);

const areaA = ref({ lat: 35.1234, lon: 129.5678 });
const areaB = ref(null);
/** 비교 모드에서 지도 클릭이 어느 쪽을 바꿀지 */
const editingSlot = ref('A');

const activeArea = computed(() => (editingSlot.value === 'B' && areaB.value ? areaB.value : areaA.value));

const meteo = useOpenMeteo();

const vesselState = computed(() => ({
  heading: headingDeg.value,
  speed: 10 * KNOT // PX121 설계 속력 10 kn
}));

const seaState = computed(
  () =>
    toSeaState({
      waveHeight: meteo.marine.waveHeight,
      wavePeriod: meteo.marine.wavePeriod,
      waveDirection: meteo.marine.waveDirection,
      currentVelocity: meteo.marine.currentVelocity,
      currentDirection: meteo.marine.currentDirection,
      windSpeed: meteo.current.windSpeed,
      windDirection: meteo.current.windDirection
    }).sea
);

const physics = useVesselPhysics(seaState, vesselState);

/**
 * 비교 모드는 해역별 해상 상태를 따로 붙잡아 둔다.
 * (API는 한 번에 한 좌표만 주므로, 각 슬롯의 마지막 값을 보관한다)
 */
const seaA = ref(null);
const seaB = ref(null);

watch(
  () => [meteo.status.value, seaState.value],
  () => {
    if (meteo.status.value === 'loading') return;
    if (editingSlot.value === 'B') seaB.value = seaState.value;
    else seaA.value = seaState.value;
  },
  { deep: true }
);

const snapshotA = computed(() =>
  seaA.value ? physics.snapshotFor(seaA.value, vesselState.value) : null
);
const snapshotB = computed(() =>
  seaB.value ? physics.snapshotFor(seaB.value, vesselState.value) : null
);

const statusClass = computed(() => ({
  fetching: meteo.status.value === 'loading',
  stale: meteo.status.value === 'cached',
  failed: meteo.status.value === 'error'
}));

const statusText = computed(() => {
  const a = activeArea.value;
  const coord = `${a.lat.toFixed(3)}°, ${a.lon.toFixed(3)}°`;
  if (meteo.status.value === 'loading') return `불러오는 중 · ${coord}`;
  if (meteo.status.value === 'cached') return `저장된 값 · ${coord}`;
  if (meteo.status.value === 'error') return `연결 실패 · ${coord}`;
  return coord;
});

let debounceTimer = null;

function load(lat, lon) {
  if (meteo.loadFromCacheIfFresh(lat, lon)) return;
  void meteo.fetchAll(lat, lon);
}

function onPingUpdate(pos) {
  if (compareMode.value && editingSlot.value === 'B') areaB.value = { ...pos };
  else areaA.value = { ...pos };

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => load(pos.lat, pos.lon), 350);
}

function selectSlot(slot) {
  editingSlot.value = slot;
  const area = slot === 'B' ? areaB.value : areaA.value;
  if (area) load(area.lat, area.lon);
}

function toggleCompare() {
  compareMode.value = !compareMode.value;
  if (compareMode.value) {
    editingSlot.value = 'B';
    if (!areaB.value) {
      // 첫 진입: 대비되는 해역을 미리 하나 띄워 비교가 바로 보이게 한다.
      const seed = { lat: 36.9, lon: 131.6 };
      areaB.value = seed;
      load(seed.lat, seed.lon);
    }
  } else {
    editingSlot.value = 'A';
    load(areaA.value.lat, areaA.value.lon);
  }
}

onMounted(() => load(areaA.value.lat, areaA.value.lon));
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  meteo.dispose();
});
</script>

<style scoped>
.marine-dashboard-fullscreen {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background-color: var(--bg-main);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hud-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: #090c13;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}

.app-brand { display: flex; align-items: baseline; gap: 8px; }
.skala-logo { font-weight: 900; font-size: 1.15rem; letter-spacing: 3px; color: #fff; }
.skala-k { color: var(--text-accent); }
.skala-sub { font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); letter-spacing: 2px; }

.header-center { flex: 1; min-width: 0; overflow-x: auto; }
.level-tabs { display: flex; gap: 6px; }

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
.lvl-num { font-size: 0.6rem; font-weight: 800; color: var(--text-muted); }
.lvl-title { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); }
.level-tab-btn.active { background: var(--brand-green-dim); border-color: var(--text-accent); }
.level-tab-btn.active .lvl-num,
.level-tab-btn.active .lvl-title { color: var(--text-accent); }

.header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.heading-control {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 4px 10px;
  border-radius: 6px;
}
.ctl-label { font-size: 0.62rem; font-weight: 800; color: var(--text-secondary); white-space: nowrap; }
.heading-control input { width: 92px; accent-color: var(--text-accent); }
.ctl-value {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-primary);
  min-width: 34px;
  font-variant-numeric: tabular-nums;
}

.compare-toggle {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
}
.compare-toggle.active {
  background: rgba(125, 211, 252, 0.15);
  border-color: #7dd3fc;
  color: #7dd3fc;
}

.slot-picker { display: flex; gap: 4px; }

.slot-btn {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
}
.slot-btn.slot-a.active { border-color: #19c37d; color: #19c37d; background: rgba(25, 195, 125, 0.14); }
.slot-btn.slot-b.active { border-color: #7dd3fc; color: #7dd3fc; background: rgba(125, 211, 252, 0.14); }

.live-status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background-color: var(--status-normal);
  box-shadow: 0 0 8px var(--status-normal);
  flex-shrink: 0;
}
.status-dot.fetching { background-color: var(--status-warning); box-shadow: 0 0 8px var(--status-warning); animation: blink 0.8s infinite; }
.status-dot.stale { background-color: var(--text-muted); box-shadow: none; }
.status-dot.failed { background-color: var(--status-danger); box-shadow: 0 0 8px var(--status-danger); }

@keyframes blink { 50% { opacity: 0.25; } }

.dashboard-viewport {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px 20px;
  box-sizing: border-box;
  overflow: hidden;
  min-height: 0;
}
.dashboard-viewport.three-col { grid-template-columns: 1fr 1fr 380px; }

.viewport-col { height: 100%; position: relative; min-height: 0; overflow: hidden; border-radius: 8px; }

.sim-error {
  position: absolute;
  inset: auto 12px 12px 12px;
  background: rgba(248, 113, 113, 0.15);
  border: 1px solid var(--status-danger);
  color: var(--status-danger);
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
}

.dashboard-footer { padding: 0 20px 12px; flex-shrink: 0; }

/* 비교 패널을 세 번째 열로 두기엔 좁은 폭 — 아래로 내리고 세로 스크롤을 허용한다.
   (고정 높이로 눌러 담으면 위쪽 지도·3D가 읽을 수 없을 만큼 납작해진다) */
@media (max-width: 1400px) {
  .dashboard-viewport.three-col {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: minmax(300px, 1fr) auto;
    overflow-y: auto;
  }
  .compare-col { grid-column: 1 / -1; min-height: 360px; }
}

@media (max-width: 900px) {
  .hud-header { padding: 8px 12px; }
  .header-left { order: 1; }
  .header-right { order: 2; margin-left: auto; }
  .header-center { order: 3; width: 100%; flex-basis: 100%; }
  .dashboard-viewport,
  .dashboard-viewport.three-col {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(260px, auto);
    padding: 8px 12px;
    gap: 8px;
    overflow-y: auto;
  }
  .compare-col { grid-column: auto; max-height: none; }
  .marine-dashboard-fullscreen { overflow-y: auto; }
}

@media (max-width: 640px) {
  .heading-control input { width: 68px; }
  .live-status-pill { font-size: 0.62rem; padding: 4px 8px; }
  .lvl-title { font-size: 0.58rem; max-width: 76px; overflow: hidden; text-overflow: ellipsis; }
  .dashboard-footer { padding: 0 8px 8px; }
}
</style>
