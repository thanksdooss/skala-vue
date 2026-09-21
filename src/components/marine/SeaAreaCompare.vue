<template>
  <section class="compare-panel" aria-label="두 해역 비교">
    <header class="compare-head">
      <div class="area-tag area-a">
        <span class="dot" aria-hidden="true"></span>
        <div>
          <strong>해역 A</strong>
          <span class="coord">{{ fmtCoord(areaA) }}</span>
        </div>
      </div>
      <span class="vs" aria-hidden="true">vs</span>
      <div class="area-tag area-b">
        <span class="dot" aria-hidden="true"></span>
        <div>
          <strong>해역 B</strong>
          <span class="coord">{{ fmtCoord(areaB) }}</span>
        </div>
      </div>
    </header>

    <p v-if="!snapA || !snapB" class="compare-empty">
      지도에서 두 번째 해역을 클릭하면 같은 선박의 거동을 나란히 비교합니다.
    </p>

    <template v-else>
      <table class="compare-table">
        <caption class="sr-only">해역 A와 해역 B에서 같은 선박(PX121 PSV)의 거동 비교</caption>
        <thead>
          <tr>
            <th scope="col">지표</th>
            <th scope="col">해역 A</th>
            <th scope="col" class="bar-col">차이</th>
            <th scope="col">해역 B</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label">
            <th scope="row">
              {{ row.label }}
              <ConfidenceBadge v-if="row.quantity" :quantity="row.quantity" />
            </th>
            <td class="num" :class="{ harsher: row.harsher === 'A' }">{{ row.aText }}</td>
            <td class="bar-col">
              <div class="bar-track" role="img" :aria-label="row.ariaLabel">
                <div class="bar bar-a" :style="{ width: row.aPct + '%' }"></div>
                <div class="bar bar-b" :style="{ width: row.bPct + '%' }"></div>
              </div>
              <span class="delta">{{ row.deltaText }}</span>
            </td>
            <td class="num" :class="{ harsher: row.harsher === 'B' }">{{ row.bText }}</td>
          </tr>
        </tbody>
      </table>

      <figure class="sweep">
        <figcaption>
          파주기별 상하동요 응답 — 같은 파고(각 해역의 실측 Hs)에서 주기가 바뀌면 어떻게 달라지는가
        </figcaption>
        <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="sweepAria" class="sweep-svg">
          <line :x1="PAD" :y1="H - PAD" :x2="W - 4" :y2="H - PAD" class="axis" />
          <line :x1="PAD" y1="6" :x2="PAD" :y2="H - PAD" class="axis" />
          <polyline :points="sweep.a" class="line-a" />
          <polyline :points="sweep.b" class="line-b" />
          <text v-for="t in sweep.xTicks" :key="t.x" :x="t.x" :y="H - 4" class="tick">{{ t.label }}</text>
          <text :x="PAD - 4" y="12" class="tick tick-y">{{ sweep.yMax.toFixed(1) }} m</text>
        </svg>
      </figure>

      <p class="compare-note">{{ verdict }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import ConfidenceBadge from '../common/ConfidenceBadge.vue';

/**
 * 해역 비교 모드.
 *
 * 3D 뷰를 두 개 띄우지 않는다. WebGL 컨텍스트를 둘로 늘리면 모바일에서 fps가 반토막 나고,
 * 비교에서 정작 중요한 것은 그림이 아니라 수치 차이이기 때문이다.
 * 3D는 선택된 한 해역만 그리고, 이 패널이 두 해역의 값을 나란히 놓는다.
 */
const props = defineProps({
  snapA: { type: Object, default: null },
  snapB: { type: Object, default: null },
  areaA: { type: Object, required: true },
  areaB: { type: Object, default: null },
  /** (sea, vessel) => PhysicsSnapshot | null */
  snapshotFor: { type: Function, required: true }
});

const fmtCoord = (a) => (a ? `${a.lat.toFixed(2)}°, ${a.lon.toFixed(2)}°` : '미선택');

const METRICS = [
  { label: '유의파고 Hs', unit: 'm', digits: 2, pick: (s) => s.sea.waveHeight },
  { label: '파주기 Tp', unit: 's', digits: 1, pick: (s) => s.sea.wavePeriod, neutral: true },
  { label: '상하동요', unit: 'm', digits: 2, pick: (s) => s.seakeeping.heaveAmp.value, q: (s) => s.seakeeping.heaveAmp },
  { label: '종동요', unit: '°', digits: 2, pick: (s) => s.seakeeping.pitchAmp.value, q: (s) => s.seakeeping.pitchAmp },
  { label: '횡동요', unit: '°', digits: 2, pick: (s) => s.seakeeping.rollAmp.value, q: (s) => s.seakeeping.rollAmp },
  { label: '수직 가속도', unit: 'm/s²', digits: 2, pick: (s) => s.seakeeping.verticalAcc.value, q: (s) => s.seakeeping.verticalAcc },
  { label: '부가저항', unit: 'kN', digits: 1, pick: (s) => s.resistance.addedResistance.value / 1000, q: (s) => s.resistance.addedResistance },
  { label: '속도 손실', unit: '%', digits: 1, pick: (s) => s.resistance.speedLoss.value * 100, q: (s) => s.resistance.speedLoss },
  { label: '풍압 경사 (IMO)', unit: '°', digits: 2, pick: (s) => s.windHeelReference.steady.value, q: (s) => s.windHeelReference.steady },
  { label: '파랑 에너지', unit: 'kW/m', digits: 1, pick: (s) => s.wavePower.value, q: (s) => s.wavePower }
];

const rows = computed(() => {
  const A = props.snapA;
  const B = props.snapB;
  if (!A || !B) return [];

  return METRICS.map((m) => {
    const a = m.pick(A);
    const b = m.pick(B);
    const max = Math.max(Math.abs(a), Math.abs(b), 1e-9);
    const harsher = m.neutral || Math.abs(a - b) < max * 0.01 ? null : Math.abs(a) > Math.abs(b) ? 'A' : 'B';
    const delta = b - a;
    const pct = Math.abs(a) > 1e-9 ? (delta / Math.abs(a)) * 100 : null;

    // 배지의 적용범위 표시는 두 해역 모두를 반영해야 한다.
    // (A는 범위 안, B는 밖인데 "범위 안"으로 보이면 비교표가 거짓말을 한다)
    let quantity = m.q ? m.q(A) : null;
    if (quantity?.range) {
      const rb = m.q(B).range;
      quantity = { ...quantity, range: { ...quantity.range, inRange: quantity.range.inRange && rb.inRange } };
    }

    return {
      label: m.label,
      quantity,
      aText: `${a.toFixed(m.digits)} ${m.unit}`,
      bText: `${b.toFixed(m.digits)} ${m.unit}`,
      aPct: (Math.abs(a) / max) * 100,
      bPct: (Math.abs(b) / max) * 100,
      harsher,
      deltaText: pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`,
      ariaLabel: `${m.label}: 해역 A ${a.toFixed(m.digits)} ${m.unit}, 해역 B ${b.toFixed(m.digits)} ${m.unit}`
    };
  });
});

const verdict = computed(() => {
  const r = rows.value;
  if (!r.length) return '';
  const counted = r.filter((x) => x.harsher);
  const aWins = counted.filter((x) => x.harsher === 'A').length;
  const bWins = counted.filter((x) => x.harsher === 'B').length;
  if (aWins === bWins) return '두 해역의 부담이 비슷합니다. 개별 지표를 따로 보세요.';
  const worse = aWins > bWins ? 'A' : 'B';
  return `비교한 ${counted.length}개 지표 중 ${Math.max(aWins, bWins)}개에서 해역 ${worse}가 선박에 더 가혹합니다.`;
});

// ── 주기 스윕 차트 ──────────────────────────────────────────
const W = 320;
const H = 120;
const PAD = 26;
const PERIODS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20];

function sweepFor(snap) {
  if (!snap) return [];
  return PERIODS.map((Tp) => {
    const s = props.snapshotFor({ ...snap.sea, wavePeriod: Tp }, snap.vessel);
    return s ? s.seakeeping.heaveAmp.value : 0;
  });
}

const sweep = computed(() => {
  const a = sweepFor(props.snapA);
  const b = sweepFor(props.snapB);
  const yMax = Math.max(...a, ...b, 0.1) * 1.15;
  const x = (i) => PAD + (i / (PERIODS.length - 1)) * (W - PAD - 6);
  const y = (v) => H - PAD - (v / yMax) * (H - PAD - 10);
  const toPoints = (arr) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return {
    a: toPoints(a),
    b: toPoints(b),
    yMax,
    xTicks: [0, 4, 8, 12].map((i) => ({ x: x(i), label: `${PERIODS[i]}s` }))
  };
});

const sweepAria = computed(
  () => `파주기 ${PERIODS[0]}초부터 ${PERIODS[PERIODS.length - 1]}초까지 두 해역의 상하동요 진폭 비교. ` + verdict.value
);
</script>

<style scoped>
.compare-panel {
  background: rgba(18, 24, 36, 0.96);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px 16px;
  height: 100%;
  overflow-y: auto;
}

.compare-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.area-tag {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
  font-size: 0.72rem;
}
.area-tag strong { display: block; color: var(--text-primary); font-size: 0.72rem; }
.coord { color: var(--text-muted); font-size: 0.65rem; }

.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.area-a .dot { background: #19c37d; }
.area-b .dot { background: #7dd3fc; }
.vs { color: var(--text-muted); font-weight: 800; font-size: 0.7rem; }

.compare-empty { color: var(--text-secondary); font-size: 0.78rem; line-height: 1.6; }

.compare-table { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
.compare-table th, .compare-table td { padding: 5px 4px; text-align: left; }
.compare-table thead th {
  color: var(--text-muted);
  font-size: 0.6rem;
  font-weight: 800;
  border-bottom: 1px solid var(--border-color);
}
.compare-table tbody th {
  font-weight: 700;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}
.num { font-variant-numeric: tabular-nums; font-weight: 800; color: var(--text-primary); white-space: nowrap; }
.num.harsher { color: var(--status-warning); }

.bar-col { width: 34%; }
.bar-track { display: flex; flex-direction: column; gap: 2px; }
.bar { height: 4px; border-radius: 2px; min-width: 2px; }
.bar-a { background: #19c37d; }
.bar-b { background: #7dd3fc; }
.delta { font-size: 0.6rem; color: var(--text-muted); font-weight: 700; }

.sweep { margin: 14px 0 0; }
.sweep figcaption { font-size: 0.62rem; color: var(--text-secondary); margin-bottom: 4px; line-height: 1.4; }
.sweep-svg { width: 100%; height: auto; }
.axis { stroke: var(--border-color-light); stroke-width: 1; }
.line-a { fill: none; stroke: #19c37d; stroke-width: 2; }
.line-b { fill: none; stroke: #7dd3fc; stroke-width: 2; stroke-dasharray: 4 3; }
.tick { fill: var(--text-muted); font-size: 8px; text-anchor: middle; }
.tick-y { text-anchor: end; }

.compare-note {
  margin: 10px 0 0;
  font-size: 0.7rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
