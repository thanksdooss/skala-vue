<template>
  <div class="ping-map-wrapper">
    <div id="ping-ocean-map" ref="mapContainer"></div>
    
    <div class="map-controls-overlay">
      <div class="ping-coord-pill">
        📍 PING: <strong>{{ pingLat.toFixed(4) }}° N, {{ pingLon.toFixed(4) }}° E</strong>
        <span v-if="noDataZone" class="no-data-badge">⚠ 해양 자료 없음</span>
      </div>

      <div class="layer-toggles">
        <button 
          v-for="layer in layerOptions" 
          :key="layer.id"
          class="layer-btn"
          :class="{ active: activeBaseLayer === layer.id }"
          @click="switchBaseLayer(layer.id)"
        >
          {{ layer.icon }} {{ layer.label }}
        </button>

        <div class="separator"></div>

        <button class="layer-btn radar-btn" :class="{ active: showRadar }" @click="toggleRadar">
          🌧️ 강수
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = defineProps({
  pingLat: { type: Number, required: true },
  pingLon: { type: Number, required: true },
  noDataZone: { type: Boolean, default: false },
  /** 비교 모드의 두 번째 해역. null이면 표시하지 않는다. */
  secondaryPing: { type: Object, default: null }
});

const emit = defineEmits(['update-ping']);

const mapContainer = ref(null);
let map = null;
let pingMarker = null;
let noDataCircle = null;
let radarTileLayer = null;
let secondaryMarker = null;
let currentBaseLayer = null;
let koreanLabelsLayer = null;

const activeBaseLayer = ref('dark');
const showRadar = ref(false);

const layerOptions = [
  { id: 'satellite', icon: '🛰️', label: '위성' },
  { id: 'ocean', icon: '🌊', label: '해양' },
  { id: 'topo', icon: '🏔️', label: '지형' },
  { id: 'dark', icon: '🌑', label: '다크' }
];

const tileLayers = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: '© Esri', maxZoom: 18 }
  },
  ocean: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: '© Esri Ocean', maxZoom: 16 }
  },
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: '© Esri Topo', maxZoom: 18 }
  },
  dark: {
    // CARTO 기본 지도가 API 키를 요구하게 되어(워터마크 표시) 키가 필요 없는 Esri 다크 그레이로 교체
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: '© Esri', maxZoom: 16 }
  }
};

// 지명 라벨 레이어 (Esri, API 키 불필요)
const labelUrls = {
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  ocean: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
};

const createPingIcon = (color = '#00a261', label = 'A') => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" role="img" aria-label="선택한 해역 ${label}">
      <circle cx="20" cy="20" r="18" fill="${color}40" stroke="${color}" stroke-width="2">
        <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="20" cy="20" r="8" fill="${color}" stroke="#ffffff" stroke-width="2" />
      <text x="20" y="23.5" text-anchor="middle" font-size="9" font-weight="800" fill="#0b0f17">${label}</text>
    </svg>
  `;
  return L.divIcon({ html: svg, className: 'ping-div-icon', iconSize: [40, 40], iconAnchor: [20, 20] });
};

/** 비교 모드의 두 번째 마커를 현재 prop에 맞춘다. */
const syncSecondary = () => {
  if (!map) return;
  const p = props.secondaryPing;
  if (!p) {
    if (secondaryMarker) { map.removeLayer(secondaryMarker); secondaryMarker = null; }
    return;
  }
  if (!secondaryMarker) {
    secondaryMarker = L.marker([p.lat, p.lon], { icon: createPingIcon('#7dd3fc', 'B') }).addTo(map);
  } else {
    secondaryMarker.setLatLng([p.lat, p.lon]);
  }
};

const switchBaseLayer = (layerId) => {
  activeBaseLayer.value = layerId;
  if (!map) return;
  if (currentBaseLayer) map.removeLayer(currentBaseLayer);
  const cfg = tileLayers[layerId];
  currentBaseLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);
  currentBaseLayer.setZIndex(1);

  if (koreanLabelsLayer) map.removeLayer(koreanLabelsLayer);
  if (labelUrls[layerId]) {
    koreanLabelsLayer = L.tileLayer(labelUrls[layerId], {
      maxZoom: 16, zIndex: 100, opacity: 0.9
    }).addTo(map);
  }
};

// Cloud: Tomorrow.io cloudCover tiles (global coverage, no API key, real-time)
// Radar: RainViewer precipitation tiles
let radarReady = false;

const loadRadar = async () => {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!res.ok) return;
    const data = await res.json();

    if (data?.radar?.past?.length) {
      const path = data.radar.past[data.radar.past.length - 1].path;
      if (radarTileLayer && map) map.removeLayer(radarTileLayer);
      radarTileLayer = L.tileLayer(
        `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`,
        { opacity: 0.55, maxZoom: 18, zIndex: 250 }
      );
      if (showRadar.value && map) radarTileLayer.addTo(map);
    }
    radarReady = true;
  } catch (e) {
    console.warn('RainViewer error:', e);
    radarReady = true;
  }
};

const toggleRadar = async () => {
  showRadar.value = !showRadar.value;
  if (!radarReady) await loadRadar();
  if (!map || !radarTileLayer) return;
  if (showRadar.value) {
    if (!map.hasLayer(radarTileLayer)) radarTileLayer.addTo(map);
  } else {
    if (map.hasLayer(radarTileLayer)) map.removeLayer(radarTileLayer);
  }
};

const updateNoDataCircle = () => {
  if (!map) return;
  if (noDataCircle) { map.removeLayer(noDataCircle); noDataCircle = null; }
  if (props.noDataZone) {
    noDataCircle = L.circle([props.pingLat, props.pingLon], {
      radius: 40000, color: '#ff2222', fillColor: '#ff2222',
      fillOpacity: 0.18, weight: 2.5, dashArray: '8 4'
    }).addTo(map);
  }
};

onMounted(() => {
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value, {
    center: [props.pingLat, props.pingLon], zoom: 6, zoomControl: false
  });

  const cfg = tileLayers['dark'];
  currentBaseLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);
  currentBaseLayer.setZIndex(1);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  pingMarker = L.marker([props.pingLat, props.pingLon], { icon: createPingIcon() }).addTo(map);

  map.on('click', (e) => {
    emit('update-ping', { lat: e.latlng.lat, lon: e.latlng.lng });
  });

  // Pre-load RainViewer data (but don't show by default)
  loadRadar();
  updateNoDataCircle();
  syncSecondary();
});

watch(() => [props.pingLat, props.pingLon], ([lat, lon]) => {
  if (pingMarker) pingMarker.setLatLng([lat, lon]);
  updateNoDataCircle();
});
watch(() => props.noDataZone, () => updateNoDataCircle());
watch(() => props.secondaryPing, syncSecondary, { deep: true });

onUnmounted(() => { if (map) map.remove(); });
</script>

<style scoped>
.ping-map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}
#ping-ocean-map { width: 100%; height: 100%; }

.map-controls-overlay {
  position: absolute;
  top: 12px; left: 12px; right: 12px;
  z-index: 1000;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: none;
}

.ping-coord-pill {
  background: rgba(11, 15, 23, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ping-coord-pill strong { color: var(--text-accent); }

.no-data-badge {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid var(--status-danger);
  color: var(--status-danger);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 800;
  animation: blink-badge 1.5s infinite;
}
@keyframes blink-badge { 50% { opacity: 0.5; } }

.layer-toggles {
  display: flex;
  gap: 4px;
  align-items: center;
  pointer-events: auto;
}

.separator { width: 1px; height: 24px; background: var(--border-color); margin: 0 4px; }

.layer-btn {
  background: rgba(11, 15, 23, 0.92);
  backdrop-filter: blur(12px);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  border-radius: 5px;
  font-weight: 700;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.layer-btn.active {
  border-color: var(--text-accent);
  color: var(--text-accent);
  background: rgba(0, 162, 97, 0.12);
}
.layer-btn:hover { border-color: var(--text-accent); }

.sat-btn.active {
  border-color: #a78bfa;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.12);
}
.radar-btn.active {
  border-color: #3b82f6;
  color: #60a5fa;
  background: rgba(37, 99, 235, 0.12);
}

@media (max-width: 640px) {
  .map-controls-overlay {
    top: 8px; left: 8px; right: 8px;
    flex-direction: column;
    gap: 6px;
  }
  .ping-coord-pill {
    font-size: 0.65rem;
    padding: 5px 10px;
  }
  .layer-toggles {
    flex-wrap: wrap;
    gap: 3px;
  }
  .layer-btn {
    font-size: 0.6rem;
    padding: 4px 7px;
  }
  .separator {
    display: none;
  }
}

@media (max-width: 480px) {
  .ping-coord-pill {
    font-size: 0.58rem;
    padding: 4px 8px;
  }
  .layer-btn {
    font-size: 0.55rem;
    padding: 3px 5px;
  }
}
</style>
