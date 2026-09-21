/**
 * docs/validation.md의 표를 만드는 스크립트.
 *
 * 문서에 숫자를 손으로 적으면 코드가 바뀌었을 때 문서만 남는다.
 * 그래서 표는 실제 src/physics/ 코드를 실행해서 뽑는다.
 *
 *   npm run validation:report > /tmp/tables.md
 */
import { VesselAdapter } from '../src/physics/vesseljsAdapter'
import { windHeelLegacy, windHeelImo, windageProfile } from '../src/physics/windHeel'
import {
  addedResistanceKreitner,
  addedResistanceLegacyHud,
  speedLossConstantPower,
  speedLossLegacy,
} from '../src/physics/speedLoss'
import { wavePowerFlux } from '../src/physics/waves'
import { setAndDrift } from '../src/physics/drift'
import { IMO_WIND_PRESSURE_PA, RHO_AIR, RHO_SEA, G, KNOT_TO_MS } from '../src/physics/constants'
import type { SeaState } from '../src/physics/types'

const ship = await VesselAdapter.create()
const p = ship.particulars
const designDraft = ship.designDraft
const n = (v: number, d = 2) => v.toFixed(d)

const vessel = { heading: 0, speed: p.serviceSpeedKn * KNOT_TO_MS }
const sea = (o: Partial<SeaState> = {}): SeaState => ({
  waveHeight: 2, wavePeriod: 8, waveDirection: 180,
  currentVelocity: 0, currentDirection: 0, windSpeed: 0, windDirection: 0, ...o,
})

console.log('## 선박 제원 (검증의 기준점)\n')
console.log('| 항목 | 값 | 출처 |')
console.log('|---|---|---|')
console.log(`| LOA | ${n(p.loa, 1)} m | PX121_dbb.json |`)
console.log(`| LWL | ${n(p.lwl, 2)} m | Vessel.js floatState |`)
console.log(`| BWL | ${n(p.bwl, 2)} m | Vessel.js floatState |`)
console.log(`| Depth | ${n(p.depth, 1)} m | PX121_dbb.json |`)
console.log(`| 설계 흘수 | ${n(designDraft, 2)} m | calculationParameters.Draft_design |`)
console.log(`| 중량 기준 흘수 | ${n(p.draft, 2)} m | Vessel.js calculateDraftAtMass |`)
console.log(`| Cb (중량 흘수에서) | ${n(p.cb, 3)} | Vessel.js floatState |`)
console.log(`| 배수량 | ${n(p.displacementMass / 1000, 0)} t | Vessel.js getWeight |`)
console.log(`| GMt | ${n(p.gmt, 3)} m | Vessel.js calculateStability |`)
console.log(`| 설계 속력 | ${n(p.serviceSpeedKn, 0)} kn | calculationParameters.speed |`)
console.log(`| L/B | ${n(p.lwl / p.bwl, 2)} | 계산 |`)
console.log(`| B/T | ${n(p.bwl / p.draft, 2)} | 계산 |`)

console.log('\n## 검증 1 — 풍압에 의한 정적 경사각\n')
const legacyArea = p.loa * (p.depth - designDraft + 3) * 0.6
const legacyLever = (p.depth - designDraft + 3) / 2
const legacyDisp = p.loa * p.boa * designDraft * p.cbDesign * RHO_SEA
const w = windageProfile({ loa: p.loa, depth: p.depth, draft: designDraft })
console.log('입력 가정의 차이:\n')
console.log('| 입력 | 내 추정식 | IMO 절차 | 비 |')
console.log('|---|---|---|---|')
console.log(`| 수풍면적 A | ${n(legacyArea, 1)} m² (LOA×(D−T+3)×0.6) | ${n(w.area, 1)} m² (건현 박스 + 상부구조 박스) | ${n(w.area / legacyArea, 2)}× |`)
const imoZ = w.centroidAboveWaterline + designDraft / 2
console.log(`| 모멘트 팔 Z | ${n(legacyLever, 2)} m (수면 위 도심만) | ${n(imoZ, 2)} m (A 도심 → 수중 측면적 중심, T/2 근사) | ${n(imoZ / legacyLever, 2)}× |`)
const dynP = 0.5 * RHO_AIR * 26 * 26
console.log(`| 풍압 (26 m/s) | ${n(dynP, 1)} Pa (형상계수 없음) | ${IMO_WIND_PRESSURE_PA} Pa (IS Code 2008) | ${n(IMO_WIND_PRESSURE_PA / dynP, 2)}× |`)
console.log(`| 배수량 Δ | ${n(legacyDisp / 1000, 0)} t (LOA·B·T·Cb·ρ 손계산) | ${n(p.displacementMass / 1000, 0)} t (라이브러리) | ${n(legacyDisp / p.displacementMass, 3)}× |`)

console.log('\n결과 (정횡풍):\n')
console.log('| 풍속 [m/s] | 보퍼트 | 내 추정식 [°] | IMO 정상풍 [°] | IMO 돌풍 [°] | IMO/내 식 |')
console.log('|---|---|---|---|---|---|')
for (const [v, bf] of [[5, 'BF 3'], [10, 'BF 5'], [15, 'BF 7'], [20, 'BF 8'], [26, 'BF 10 (IMO 기준)'], [33, 'BF 12']] as [number, string][]) {
  const lg = windHeelLegacy({ windSpeedMs: v, loa: p.loa, depth: p.depth, draft: designDraft, beam: p.boa, cb: p.cbDesign, gmt: p.gmt })
  const im = windHeelImo({ vessel: { ...p, draft: designDraft }, useActualWindSpeed: true, windSpeedMs: v })
  console.log(`| ${v} | ${bf} | ${n(lg.value, 3)} | ${n(im.steady.value, 3)} | ${n(im.gust.value, 3)} | ${n(im.steady.value / lg.value, 2)}× |`)
}
const imoStd = windHeelImo({ vessel: { ...p, draft: designDraft } })
const lgStd = windHeelLegacy({ windSpeedMs: 26, loa: p.loa, depth: p.depth, draft: designDraft, beam: p.boa, cb: p.cbDesign, gmt: p.gmt })
console.log(`\nIMO 규정 풍압(504 Pa) 그대로: 정상풍 **${n(imoStd.steady.value, 3)}°**, 돌풍 **${n(imoStd.gust.value, 3)}°**, 경사 모멘트 팔 lw1 = ${n(imoStd.heelingArmM, 4)} m.`)
console.log(`같은 조건에서 내 추정식은 **${n(lgStd.value, 3)}°** — 약 **${n(imoStd.steady.value / lgStd.value, 1)}배** 작다.`)

console.log('\n## 검증 2 — 파랑 중 부가저항\n')
console.log('| Hs [m] | 하단 HUD 식 [kN] | Kreitner [kN] | Vessel.js 원본 [kN] | HUD/Kreitner | 원본 적용범위 |')
console.log('|---|---|---|---|---|---|')
for (const hs of [0.5, 1.0, 1.5, 1.9, 2.0, 2.1, 2.5, 3.0, 4.0, 5.0]) {
  const hud = addedResistanceLegacyHud(hs).value / 1000
  const kre = addedResistanceKreitner(hs, p).value / 1000
  const raw = ship.resistance(sea({ waveHeight: hs }), vessel).addedResistanceRaw.value / 1000
  console.log(`| ${n(hs, 1)} | ${n(hud, 1)} | ${n(kre, 1)} | ${n(raw, 1)} | ${n(hud / kre, 2)}× | ${hs <= 2 ? 'Kreitner' : '**정수저항 20% 고정**'} |`)
}

console.log('\n## 검증 3 — 속도 손실\n')
const calm = ship.resistance(sea(), vessel).calmResistance.value
console.log(`정수저항 R₀ = ${n(calm / 1000, 1)} kN (${n(p.serviceSpeedKn, 0)} kn, Vessel.js Holtrop)\n`)
console.log('| Hs [m] | ΔR/R₀ | 배포본 ΔR/(3R₀) [%] | 3차식 정확해 [%] | 차이 [%p] |')
console.log('|---|---|---|---|---|')
for (const hs of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5]) {
  const dr = addedResistanceKreitner(hs, p).value
  const r = dr / calm
  const lg = speedLossLegacy(dr, calm).value * 100
  const ex = speedLossConstantPower(dr, calm).value * 100
  console.log(`| ${n(hs, 1)} | ${n(r, 3)} | ${n(lg, 2)} | ${n(ex, 2)} | ${n(ex - lg, 2)} |`)
}

console.log('\n## 검증 4 — 파랑 에너지 플럭스\n')
console.log(`계수 ρg²/(64π) = ${n((RHO_SEA * G * G) / (64 * Math.PI) / 1000, 4)} kW/m per (m²·s)\n`)
console.log('| Hs [m] | Tp [s] | 계산값 [kW/m] | 손검산 0.49·Hs²·Tp |')
console.log('|---|---|---|---|')
for (const [hs, tp] of [[1, 6], [2, 8], [3, 8], [3, 10], [5, 12]] as [number, number][]) {
  console.log(`| ${hs} | ${tp} | ${n(wavePowerFlux(hs, tp).value, 2)} | ${n(0.49 * hs * hs * tp, 2)} |`)
}

console.log('\n## 검증 5 — 해류에 의한 편류각\n')
console.log(`선속 ${n(p.serviceSpeedKn, 0)} kn = ${n(vessel.speed, 3)} m/s, 선수방위 000°\n`)
console.log('| 해류 [m/s] | 해류 방향 [°] | 편류각 [°] | 해석 해 atan(V_lat/V_long) [°] | 대지속력 [m/s] |')
console.log('|---|---|---|---|---|')
for (const [vc, dir] of [[0.5, 90], [1.0, 90], [1.5, 90], [1.0, 45], [1.0, 180], [1.0, 270]] as [number, number][]) {
  const d = setAndDrift({ currentVelocity: vc, currentDirection: dir, vessel })
  const lat = vc * Math.sin((dir * Math.PI) / 180)
  const lon = vessel.speed + vc * Math.cos((dir * Math.PI) / 180)
  console.log(`| ${n(vc, 1)} | ${dir} | ${n(d.driftAngle.value, 2)} | ${n((Math.atan2(lat, Math.abs(lon)) * 180) / Math.PI, 2)} | ${n(d.speedOverGround.value, 3)} |`)
}

console.log('\n## 검증 6 — 6자유도 운동(RAO)의 물리적 타당성 점검\n')
console.log('Hs = 2.0 m (파진폭 1.0 m), 정선수파, 10 kn\n')
console.log('| Tp [s] | 파장 λ [m] | λ/LWL | heave [m] | heave RAO | pitch [°] | 수직가속도 [m/s²] |')
console.log('|---|---|---|---|---|---|---|')
for (const tp of [4, 6, 8, 10, 12, 14, 16, 20, 25]) {
  const s = ship.seakeeping(sea({ waveHeight: 2, wavePeriod: tp }), vessel)
  const lam = (G * tp * tp) / (2 * Math.PI)
  console.log(`| ${tp} | ${n(lam, 0)} | ${n(lam / p.lwl, 2)} | ${n(s.heaveAmp.value, 3)} | ${n(s.heaveAmp.value / 1.0, 2)} | ${n(s.pitchAmp.value, 2)} | ${n(s.verticalAcc.value, 3)} |`)
}

console.log('\n## 성능 — 스냅샷 1회 계산 비용\n')
const { computeSnapshot } = await import('../src/physics/snapshot')
for (let i = 0; i < 200; i++) computeSnapshot(ship, sea({ waveHeight: 1 + (i % 5) * 0.4 }), vessel)
const t0 = performance.now()
const N = 2000
for (let i = 0; i < N; i++) computeSnapshot(ship, sea({ waveHeight: 1 + (i % 7) * 0.3, wavePeriod: 6 + (i % 5) }), vessel)
const dt = performance.now() - t0
console.log(`스냅샷 ${N}회: ${n(dt, 1)} ms → 1회당 **${n((dt / N) * 1000, 1)} µs** (Node ${process.version}, Apple Silicon)`)
