import { describe, it, expect } from 'vitest'
import { windHeelLegacy, windHeelImo, windageProfile } from '../src/physics/windHeel'
import type { VesselParticulars } from '../src/physics/types'

/** PX121 PSV — Vessel.js가 실제로 내놓는 값 (tests/vesseljsAdapter.test.ts에서 고정) */
const PX121: VesselParticulars = {
  loa: 82,
  lwl: 82,
  bwl: 17.57,
  boa: 18,
  depth: 8,
  draft: 6.5, // 설계 흘수. 수풍면적은 건현 기준이므로 설계 흘수를 쓴다.
  cb: 0.553,
  cbDesign: 0.68,
  displacementMass: 6_241_289.8,
  gmt: 0.586711,
  serviceSpeedKn: 10,
}

const LEGACY_INPUT = {
  loa: 82,
  depth: 8,
  draft: 6.5,
  beam: 18,
  cb: 0.68,
  gmt: 0.586711,
}

describe('windHeelLegacy (배포본 재현)', () => {
  it('바람이 없으면 0°', () => {
    expect(windHeelLegacy({ ...LEGACY_INPUT, windSpeedMs: 0 }).value).toBe(0)
  })

  it('풍속의 제곱에 비례한다', () => {
    const a = windHeelLegacy({ ...LEGACY_INPUT, windSpeedMs: 10 }).value
    const b = windHeelLegacy({ ...LEGACY_INPUT, windSpeedMs: 20 }).value
    expect(b / a).toBeCloseTo(4, 6)
  })

  it('IMO 기준풍속 26 m/s에서 0.31° — 배포본이 실제로 내던 값', () => {
    expect(windHeelLegacy({ ...LEGACY_INPUT, windSpeedMs: 26 }).value).toBeCloseTo(0.307, 3)
  })

  it('검증되지 않은 추정식이므로 estimate 등급으로 표시된다', () => {
    expect(windHeelLegacy({ ...LEGACY_INPUT, windSpeedMs: 26 }).confidence).toBe('estimate')
  })

  it('45° 캡은 현실적인 풍속에서 절대 걸리지 않는다 (사실상 죽은 코드였음)', () => {
    // 초강력 태풍급 80 m/s에서도 캡에 닿지 않는다
    expect(windHeelLegacy({ ...LEGACY_INPUT, windSpeedMs: 80 }).value).toBeLessThan(45)
  })
})

describe('windageProfile', () => {
  it('건현 박스 + 상부구조 박스의 면적과 도심을 합성한다', () => {
    const w = windageProfile({ loa: 82, depth: 8, draft: 6.5 })
    // 선체: 82 × 1.5 = 123 m² @ 0.75 m, 상부: 82×0.3 × 9 = 221.4 m² @ 6.0 m
    expect(w.area).toBeCloseTo(344.4, 1)
    expect(w.centroidAboveWaterline).toBeCloseTo(4.125, 3)
  })

  it('흘수가 깊어지면 건현이 줄어 수풍면적이 작아진다', () => {
    const shallow = windageProfile({ loa: 82, depth: 8, draft: 5 })
    const deep = windageProfile({ loa: 82, depth: 8, draft: 7.64 })
    expect(deep.area).toBeLessThan(shallow.area)
  })

  it('흘수가 형심을 넘어도 건현을 음수로 만들지 않는다', () => {
    expect(windageProfile({ loa: 82, depth: 8, draft: 9 }).area).toBeGreaterThan(0)
  })
})

describe('windHeelImo (IMO IS Code 2008 A/2.3)', () => {
  const r = windHeelImo({ vessel: PX121 })

  it('정상풍 경사각 약 2.0°, 돌풍 약 3.1°', () => {
    expect(r.steady.value).toBeCloseTo(2.042, 2)
    expect(r.gust.value).toBeCloseTo(3.064, 2)
  })

  it('돌풍 레버는 정상풍의 1.5배다', () => {
    expect(Math.sin((r.gust.value * Math.PI) / 180) / Math.sin((r.steady.value * Math.PI) / 180))
      .toBeCloseTo(1.5, 6)
  })

  it('기준 절차 구현이므로 reference 등급', () => {
    expect(r.steady.confidence).toBe('reference')
  })

  it('배포본 추정식은 IMO 절차 대비 약 6~7배 작다 — 이 프로젝트의 핵심 검증 결과', () => {
    const legacy = windHeelLegacy({ ...LEGACY_INPUT, windSpeedMs: 26 }).value
    const ratio = r.steady.value / legacy
    expect(ratio).toBeGreaterThan(6)
    expect(ratio).toBeLessThan(7)
  })

  it('풍향을 주면 정횡풍에서 최대, 정선수풍에서 0이 된다', () => {
    const beam = windHeelImo({ vessel: PX121, relativeWindAngleDeg: 90 })
    const head = windHeelImo({ vessel: PX121, relativeWindAngleDeg: 0 })
    expect(beam.steady.value).toBeCloseTo(r.steady.value, 6)
    expect(head.steady.value).toBe(0)
  })

  it('GM이 0이면 0을 돌려주고 NaN을 내지 않는다', () => {
    const z = windHeelImo({ vessel: { ...PX121, gmt: 0 } })
    expect(z.steady.value).toBe(0)
  })
})
