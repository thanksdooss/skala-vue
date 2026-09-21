<template>
  <div class="vesseljs-viewport">
    <iframe
      ref="vesselFrame"
      src="/vesseljs/examples/vessel_simulation.html"
      class="vessel-iframe"
      title="선박 3D 운동 렌더링"
      frameborder="0"
    ></iframe>

    <div class="rao-overlay" role="group" aria-label="선박 운동 지표">
      <template v-for="cell in cells" :key="cell.label">
        <div class="rao-cell">
          <span class="rao-lbl">{{ cell.label }}</span>
          <span class="rao-val" :style="{ color: cell.color }">{{ cell.text }}</span>
          <ConfidenceBadge :quantity="cell.quantity" />
        </div>
      </template>
    </div>

    <div class="viewport-controls">
      <button
        class="ghost-toggle"
        :class="{ active: showGhost }"
        :aria-pressed="String(showGhost)"
        @click="showGhost = !showGhost"
      >
        <span class="toggle-dot" aria-hidden="true"></span>
        정수 중 기준선
      </button>

      <span class="fps-pill" :class="{ warn: quality !== 'high' }">
        {{ fps > 0 ? `${fps} fps` : '측정 중' }} · {{ QUALITY_LABEL[quality] }}
      </span>
    </div>

    <div class="engine-tag">
      <strong>Vessel.js</strong><span class="tag-long"> NTNU ShipLab (MIT) · PX121 PSV</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import ConfidenceBadge from '../common/ConfidenceBadge.vue';

/**
 * Vessel.js 3D 렌더러와의 다리.
 *
 * 1단계 이전에는 이 iframe 안에서 물리 계산까지 했다. 지금은 계산 결과를 받아
 * 렌더러로 내려보내기만 한다. 이 컴포넌트는 값을 만들지 않는다.
 */
const props = defineProps({
  /** src/physics의 PhysicsSnapshot. null이면 아직 로딩 중. */
  snapshot: { type: Object, default: null },
  activeLevel: { type: String, default: 'lvl1' }
});

const vesselFrame = ref(null);
const showGhost = ref(false);
const rendererReady = ref(false);
const fps = ref(0);
const quality = ref('high');

const QUALITY_LABEL = { high: '고품질', medium: '표준', low: '저사양' };
const DEG = Math.PI / 180;

/**
 * 품질 자동 조정.
 *
 * 연속 3초간 24 fps를 밑돌면 한 단계 낮추고, 연속 8초간 50 fps를 넘으면 한 단계 되돌린다.
 * 되돌림을 넣은 이유: 한 번 잠깐 끊겼다고 남은 세션 내내 저품질로 두면 안 되기 때문이다.
 * (탭이 가려졌을 때의 1 fps 표본은 렌더러 쪽에서 아예 보내지 않는다.)
 */
const QUALITY_ORDER = ['low', 'medium', 'high'];
let lowSamples = 0;
let highSamples = 0;

function considerQuality(measured) {
  if (measured === 0 || document.hidden) return;
  const idx = QUALITY_ORDER.indexOf(quality.value);

  if (measured < 24) {
    highSamples = 0;
    if (++lowSamples >= 3 && idx > 0) {
      quality.value = QUALITY_ORDER[idx - 1];
      lowSamples = 0;
    }
  } else if (measured > 50) {
    lowSamples = 0;
    if (++highSamples >= 8 && idx < QUALITY_ORDER.length - 1) {
      quality.value = QUALITY_ORDER[idx + 1];
      highSamples = 0;
    }
  } else {
    lowSamples = 0;
    highSamples = 0;
  }
}

/** 조우주기 — 3D 운동 재생 속도. 선속·파향이 반영된 실제 주기를 쓴다. */
const encounterPeriod = computed(() => {
  const s = props.snapshot;
  if (!s) return 8;
  const omega = (2 * Math.PI) / (s.sea.wavePeriod > 0 ? s.sea.wavePeriod : 8);
  const k = (omega * omega) / 9.81;
  const we = omega - k * s.vessel.speed * Math.cos(s.relativeWaveHeading * DEG);
  return we > 0.05 ? (2 * Math.PI) / we : 8;
});

const renderState = computed(() => {
  const s = props.snapshot;
  if (!s) return null;
  const lvl = props.activeLevel;
  return {
    waveAmplitude: s.sea.waveHeight / 2,
    wavePeriod: s.sea.wavePeriod,
    waveDirection: s.sea.waveDirection,
    heading: s.vessel.heading,
    heaveAmp: s.seakeeping.heaveAmp.value,
    pitchAmp: s.seakeeping.pitchAmp.value * DEG,
    rollAmp: s.seakeeping.rollAmp.value * DEG,
    // 풍압 경사와 표류는 해당 레벨에서만 3D에 반영한다(어느 효과를 보고 있는지 분명하게).
    heelAngle: lvl === 'lvl3' ? s.windHeelReference.steady.value * DEG : 0,
    driftAngle: lvl === 'lvl2' ? s.drift.driftAngle.value * DEG : 0,
    lateralDrift: lvl === 'lvl2' ? s.drift.lateralSpeed.value : 0,
    encounterPeriod: encounterPeriod.value,
    showGhost: showGhost.value,
    quality: quality.value
  };
});

function send() {
  const frame = vesselFrame.value;
  if (!frame?.contentWindow || !rendererReady.value || !renderState.value) return;
  frame.contentWindow.postMessage({ type: 'RENDER_STATE', state: renderState.value }, window.location.origin);
}

function onMessage(event) {
  // 렌더러는 같은 출처(public/)에서 온다. 다른 출처의 메시지는 받지 않는다.
  if (event.origin !== window.location.origin) return;
  const d = event.data;
  if (d?.type === 'RENDERER_READY') {
    rendererReady.value = true;
    send();
  } else if (d?.type === 'RENDERER_FPS') {
    fps.value = d.fps;
    considerQuality(d.fps);
  }
}

watch([renderState, rendererReady], send, { deep: true });

onMounted(() => window.addEventListener('message', onMessage));
onUnmounted(() => window.removeEventListener('message', onMessage));

const COLORS = { ok: 'var(--status-normal)', warn: 'var(--status-warning)', bad: 'var(--status-danger)' };
const tone = (v, warn, bad) => (Math.abs(v) > bad ? COLORS.bad : Math.abs(v) > warn ? COLORS.warn : COLORS.ok);

/** 레벨별로 보여줄 지표. 값과 배지를 항상 한 쌍으로 만든다. */
const cells = computed(() => {
  const s = props.snapshot;
  if (!s) return [];
  const f = (q, digits, suffix = '') => `${q.value.toFixed(digits)}${suffix || ' ' + q.unit}`;

  switch (props.activeLevel) {
    case 'lvl2':
      return [
        { label: '편류각', text: f(s.drift.driftAngle, 1), quantity: s.drift.driftAngle, color: tone(s.drift.driftAngle.value, 5, 15) },
        { label: '횡방향 표류', text: f(s.drift.lateralSpeed, 2), quantity: s.drift.lateralSpeed, color: COLORS.ok },
        { label: '풍압 편류', text: f(s.leeway, 2), quantity: s.leeway, color: COLORS.ok },
        { label: '타각(참고)', text: f(s.rudder, 1), quantity: s.rudder, color: COLORS.ok }
      ];
    case 'lvl3':
      return [
        { label: '풍압 경사 (IMO)', text: f(s.windHeelReference.steady, 2), quantity: s.windHeelReference.steady, color: tone(s.windHeelReference.steady.value, 5, 15) },
        { label: '돌풍 시', text: f(s.windHeelReference.gust, 2), quantity: s.windHeelReference.gust, color: tone(s.windHeelReference.gust.value, 8, 16) },
        { label: '기존 추정식', text: f(s.windHeelEstimate, 2), quantity: s.windHeelEstimate, color: COLORS.warn },
        { label: 'GMt', text: f(s.stability.gmt, 2), quantity: s.stability.gmt, color: s.stability.status === 'SAFE' ? COLORS.ok : s.stability.status === 'WARNING' ? COLORS.warn : COLORS.bad }
      ];
    case 'lvl4':
      return [
        { label: '정수저항', text: `${(s.resistance.calmResistance.value / 1000).toFixed(1)} kN`, quantity: s.resistance.calmResistance, color: COLORS.ok },
        { label: '부가저항 ΔRaw', text: `${(s.resistance.addedResistance.value / 1000).toFixed(1)} kN`, quantity: s.resistance.addedResistance, color: COLORS.ok },
        { label: '속도 손실', text: `${(s.resistance.speedLoss.value * 100).toFixed(1)} %`, quantity: s.resistance.speedLoss, color: tone(s.resistance.speedLoss.value * 100, 10, 25) },
        { label: '유효마력', text: `${(s.resistance.effectivePower.value / 1000).toFixed(0)} kW`, quantity: s.resistance.effectivePower, color: COLORS.ok }
      ];
    default:
      return [
        { label: '상하동요 (heave)', text: f(s.seakeeping.heaveAmp, 2), quantity: s.seakeeping.heaveAmp, color: COLORS.ok },
        { label: '종동요 (pitch)', text: f(s.seakeeping.pitchAmp, 1), quantity: s.seakeeping.pitchAmp, color: tone(s.seakeeping.pitchAmp.value, 3, 6) },
        { label: '횡동요 (roll)', text: f(s.seakeeping.rollAmp, 1), quantity: s.seakeeping.rollAmp, color: tone(s.seakeeping.rollAmp.value, 6, 12) },
        { label: '수직 가속도', text: f(s.seakeeping.verticalAcc, 2), quantity: s.seakeeping.verticalAcc, color: tone(s.seakeeping.verticalAcc.value, 2, 4) }
      ];
  }
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

.vessel-iframe { width: 100%; height: 100%; border: none; display: block; }

.rao-overlay {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  z-index: 10;
}

.rao-cell {
  background: rgba(11, 15, 23, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.rao-lbl {
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.rao-val { font-size: 1rem; font-weight: 900; }

.viewport-controls {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 10;
}

.ghost-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(11, 15, 23, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: var(--text-secondary);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.25s ease;
}

.toggle-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.25s ease;
}

.ghost-toggle:hover { border-color: var(--text-accent); color: var(--text-primary); }
.ghost-toggle.active {
  background: rgba(0, 162, 97, 0.18);
  border-color: var(--text-accent);
  color: var(--text-accent);
}
.ghost-toggle.active .toggle-dot {
  background: var(--text-accent);
  box-shadow: 0 0 6px var(--text-accent);
}

.fps-pill {
  background: rgba(11, 15, 23, 0.9);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
}
.fps-pill.warn { color: var(--status-warning); border-color: rgba(245, 158, 11, 0.5); }

.engine-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(11, 15, 23, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  z-index: 10;
}
.engine-tag strong { color: var(--text-accent); }

@media (max-width: 640px) {
  .rao-overlay { bottom: 8px; left: 8px; right: 8px; gap: 4px; }
  .rao-cell { padding: 4px 7px; }
  .rao-lbl { font-size: 0.5rem; }
  .rao-val { font-size: 0.8rem; }
  .engine-tag { top: 6px; right: 6px; padding: 4px 7px; font-size: 0.55rem; }
  .viewport-controls { top: 6px; left: 6px; }
  .ghost-toggle, .fps-pill { padding: 5px 8px; font-size: 0.55rem; }
  /* 좁은 화면에서 좌측 컨트롤과 우측 출처 태그가 겹쳐서, 태그를 줄인다 */
  .tag-long { display: none; }
}
</style>
