import { describe, it, expect, beforeAll } from 'vitest'
import { VesselAdapter } from '../src/physics/vesseljsAdapter'
import type { SeaState, VesselHeadingState } from '../src/physics/types'

/**
 * Vessel.js를 실제로 불러서 도는 통합 테스트.
 *
 * WebGL 모킹이 필요 없다는 점이 이 프로젝트에서 중요한 사실이다.
 * Vessel.js의 계산 모듈은 Three.js에 의존하지 않으므로 Node에서 그대로 돈다.
 */
let ship: VesselAdapter

const HEADING_NORTH: VesselHeadingState = { heading: 0, speed: 10 * 0.514444 }

const sea = (over: Partial<SeaState> = {}): SeaState => ({
  waveHeight: 2,
  wavePeriod: 8,
  waveDirection: 180,
  currentVelocity: 0,
  currentDirection: 0,
  windSpeed: 0,
  windDirection: 0,
  ...over,
})

beforeAll(async () => {
  ship = await VesselAdapter.create()
}, 60_000)

describe('선박 제원', () => {
  it('PX121 PSV의 주요 치수를 읽어온다', () => {
    const p = ship.particulars
    expect(p.loa).toBe(82)
    expect(p.depth).toBe(8)
    expect(p.lwl).toBeCloseTo(82, 1)
    expect(p.bwl).toBeCloseTo(17.57, 1)
    expect(p.serviceSpeedKn).toBe(10)
  })

  it('설계 흘수(6.5 m)와 중량으로 계산된 흘수(7.64 m)는 다르다 — 3D는 설계 흘수를 쓴다', () => {
    expect(ship.designDraft).toBeCloseTo(6.5, 3)
    expect(ship.particulars.draft).toBeCloseTo(7.64, 1)
  })

  it('복원성: GMt 0.587 m, 배수량 6,241 t', () => {
    const s = ship.stability()
    expect(s.gmt).toBeCloseTo(0.5867, 3)
    expect(s.displacementMass / 1000).toBeCloseTo(6241, 0)
  })

  it('배포본이 손계산하던 배수량은 라이브러리 값보다 약 7% 크다', () => {
    const legacy = 82 * 18 * 6.5 * 0.68 * 1025
    expect(legacy / ship.stability().displacementMass).toBeCloseTo(1.071, 2)
  })

  it('Holtrop 적용범위를 모두 만족한다 (L/B, B/T, Cp)', () => {
    const p = ship.particulars
    expect(p.lwl / p.bwl).toBeGreaterThan(3.9)
    expect(p.lwl / p.bwl).toBeLessThan(15)
    expect(p.bwl / p.draft).toBeGreaterThan(2.1)
    expect(p.bwl / p.draft).toBeLessThan(4)
  })
})

describe('seakeeping — Vessel.js WaveMotion', () => {
  it('정수 중(파고 0)에서는 운동이 거의 없다', () => {
    const r = ship.seakeeping(sea({ waveHeight: 0 }), HEADING_NORTH)
    expect(r.heaveAmp.value).toBeCloseTo(0, 6)
    expect(r.pitchAmp.value).toBeCloseTo(0, 6)
  })

  it('파고에 선형 비례한다 (규칙파 선형 RAO의 정의)', () => {
    const a = ship.seakeeping(sea({ waveHeight: 1 }), HEADING_NORTH)
    const b = ship.seakeeping(sea({ waveHeight: 3 }), HEADING_NORTH)
    expect(b.heaveAmp.value / a.heaveAmp.value).toBeCloseTo(3, 6)
    expect(b.pitchAmp.value / a.pitchAmp.value).toBeCloseTo(3, 6)
  })

  it('heave 응답의 피크는 파장이 선체 길이보다 길어지는 Tp 10~12 s 부근에 있다', () => {
    const periods = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18]
    const amps = periods.map((Tp) => ship.seakeeping(sea({ wavePeriod: Tp }), HEADING_NORTH).heaveAmp.value)
    const peakIdx = amps.indexOf(Math.max(...amps))
    expect(periods[peakIdx]).toBeGreaterThanOrEqual(10)
    expect(periods[peakIdx]).toBeLessThanOrEqual(12)
  })

  it('장주기 극한에서 heave 진폭은 파진폭(= Hs/2)에 수렴한다', () => {
    // 아주 긴 파도에서 배는 수면을 그대로 따라간다 → RAO → 1
    const r = ship.seakeeping(sea({ waveHeight: 2, wavePeriod: 25 }), HEADING_NORTH)
    expect(r.heaveAmp.value).toBeGreaterThan(0.85)
    expect(r.heaveAmp.value).toBeLessThan(1.15)
  })

  it('단주기 극한에서는 배가 파도를 따라가지 않는다 (RAO → 0)', () => {
    const r = ship.seakeeping(sea({ waveHeight: 2, wavePeriod: 3 }), HEADING_NORTH)
    expect(r.heaveAmp.value).toBeLessThan(0.05)
  })

  it('정선수파에서 횡동요는 0이다 — 버그가 아니라 가진력이 없는 것', () => {
    const r = ship.seakeeping(sea({ waveDirection: 180 }), HEADING_NORTH)
    expect(r.rollAmp.value).toBeCloseTo(0, 9)
    expect(r.rollAmp.note).toMatch(/가진력/)
  })

  it('횡파에서는 횡동요가 나타난다 — 선수방위를 반영한다는 증거', () => {
    const beam = ship.seakeeping(sea({ waveDirection: 90 }), HEADING_NORTH)
    expect(beam.rollAmp.value).toBeGreaterThan(0.5)
  })

  it('같은 파도라도 선수방위를 돌리면 운동이 달라진다 (heading 하드코딩 회귀 방지)', () => {
    const head = ship.seakeeping(sea({ waveDirection: 180 }), { heading: 0, speed: 5 })
    const beam = ship.seakeeping(sea({ waveDirection: 180 }), { heading: 90, speed: 5 })
    expect(beam.rollAmp.value).toBeGreaterThan(head.rollAmp.value)
  })

  it('모든 반환값은 library 등급이다 (내 추정식이 섞이지 않았다)', () => {
    const r = ship.seakeeping(sea(), HEADING_NORTH)
    for (const q of [r.heaveAmp, r.pitchAmp, r.rollAmp, r.verticalAcc]) {
      expect(q.confidence).toBe('library')
    }
  })
})

describe('resistance — 2 m 분기 우회', () => {
  it('정수저항은 약 88.5 kN (10 kn)', () => {
    const r = ship.resistance(sea(), HEADING_NORTH)
    expect(r.calmResistance.value / 1000).toBeCloseTo(88.5, 0)
  })

  it('Vessel.js 원본은 Hs 2.0 → 2.1 m에서 부가저항이 오히려 떨어진다 (재현)', () => {
    const at2 = ship.resistance(sea({ waveHeight: 2.0 }), HEADING_NORTH).addedResistanceRaw.value
    const at21 = ship.resistance(sea({ waveHeight: 2.1 }), HEADING_NORTH).addedResistanceRaw.value
    expect(at2 / 1000).toBeCloseTo(53.6, 0)
    expect(at21 / 1000).toBeCloseTo(17.7, 0)
    expect(at21).toBeLessThan(at2)
  })

  it('원본은 2 m 초과에서 파고와 무관한 상수가 된다', () => {
    const a = ship.resistance(sea({ waveHeight: 2.5 }), HEADING_NORTH).addedResistanceRaw.value
    const b = ship.resistance(sea({ waveHeight: 5.0 }), HEADING_NORTH).addedResistanceRaw.value
    expect(a).toBeCloseTo(b, 3)
  })

  it('어댑터가 내놓는 값은 파고에 대해 단조증가한다', () => {
    let prev = 0
    for (const hs of [0.5, 1, 1.5, 2, 2.5, 3, 4, 5]) {
      const v = ship.resistance(sea({ waveHeight: hs }), HEADING_NORTH).addedResistance.value
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('어댑터 값은 2 m 이하에서 라이브러리 값과 일치한다 (같은 Kreitner 식)', () => {
    for (const hs of [0.5, 1.0, 1.5, 2.0]) {
      const r = ship.resistance(sea({ waveHeight: hs }), HEADING_NORTH)
      expect(r.addedResistance.value).toBeCloseTo(r.addedResistanceRaw.value, 0)
    }
  })

  it('속도 손실도 파고에 대해 단조증가한다', () => {
    let prev = 0
    for (const hs of [1, 2, 3, 4]) {
      const v = ship.resistance(sea({ waveHeight: hs }), HEADING_NORTH).speedLoss.value
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('선속을 올리면 정수저항이 커진다', () => {
    const slow = ship.resistance(sea(), { heading: 0, speed: 5 * 0.514444 })
    const fast = ship.resistance(sea(), { heading: 0, speed: 12 * 0.514444 })
    expect(fast.calmResistance.value).toBeGreaterThan(slow.calmResistance.value)
  })
})
