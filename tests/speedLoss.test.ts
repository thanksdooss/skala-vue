import { describe, it, expect } from 'vitest'
import {
  addedResistanceKreitner,
  addedResistanceLegacyHud,
  speedLossConstantPower,
  speedLossLegacy,
} from '../src/physics/speedLoss'
import { classifyStability } from '../src/physics/stability'

const PX121 = { bwl: 17.57, lwl: 82, cb: 0.553 }

describe('addedResistanceKreitner', () => {
  it('파고의 제곱에 비례한다', () => {
    const a = addedResistanceKreitner(1, PX121).value
    const b = addedResistanceKreitner(3, PX121).value
    expect(b / a).toBeCloseTo(9, 9)
  })

  it('Hs = 2 m에서 약 53.6 kN — Vessel.js가 같은 조건에서 내는 값과 일치해야 한다', () => {
    expect(addedResistanceKreitner(2, PX121).value / 1000).toBeCloseTo(53.6, 1)
  })

  it('Hs > 2 m는 라이브러리 적용범위 밖으로 표시된다', () => {
    expect(addedResistanceKreitner(2.0, PX121).range?.inRange).toBe(true)
    expect(addedResistanceKreitner(2.1, PX121).range?.inRange).toBe(false)
  })

  it('파고가 커지면 단조증가한다 (2 m 불연속 회귀 방지)', () => {
    let prev = 0
    for (const hs of [0.5, 1, 1.5, 2, 2.5, 3, 4, 5]) {
      const v = addedResistanceKreitner(hs, PX121).value
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('파고가 0이면 0', () => {
    expect(addedResistanceKreitner(0, PX121).value).toBe(0)
  })
})

describe('addedResistanceLegacyHud', () => {
  it('Kreitner 대비 약 2.35배 — 같은 화면에 두 값이 따로 뜨던 원인', () => {
    for (const hs of [1, 2, 3]) {
      const ratio = addedResistanceLegacyHud(hs).value / addedResistanceKreitner(hs, PX121).value
      expect(ratio).toBeCloseTo(2.35, 2)
    }
  })

  it('출처 불명 상수식이므로 estimate 등급', () => {
    expect(addedResistanceLegacyHud(2).confidence).toBe('estimate')
  })
})

describe('speedLossConstantPower', () => {
  it('부가저항이 없으면 손실 0', () => {
    expect(speedLossConstantPower(0, 88_500).value).toBe(0)
  })

  it('u³ + r·u = 1 을 만족하는 해를 돌려준다', () => {
    const calm = 88_500
    for (const added of [5_000, 30_000, 53_600, 80_000]) {
      const u = 1 - speedLossConstantPower(added, calm).value
      const r = added / calm
      expect(u ** 3 + r * u).toBeCloseTo(1, 8)
    }
  })

  it('Hs = 2 m (ΔR 53.6 kN, R₀ 88.5 kN) → 약 19.9% 손실', () => {
    expect(speedLossConstantPower(53_600, 88_500).value * 100).toBeCloseTo(19.9, 1)
  })

  it('부가저항이 커질수록 손실도 커진다', () => {
    let prev = 0
    for (const added of [1_000, 10_000, 40_000, 90_000]) {
      const v = speedLossConstantPower(added, 88_500).value
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('ΔR이 정수저항을 넘으면 적용범위 밖', () => {
    expect(speedLossConstantPower(50_000, 88_500).range?.inRange).toBe(true)
    expect(speedLossConstantPower(100_000, 88_500).range?.inRange).toBe(false)
  })
})

describe('speedLossLegacy vs 정확식', () => {
  it('r < 1 구간에서 두 방법의 차이는 1.2%p 미만 — 배포본 식 자체는 타당했다', () => {
    const calm = 88_500
    for (const r of [0.1, 0.2, 0.3, 0.6, 0.9]) {
      const exact = speedLossConstantPower(r * calm, calm).value
      const legacy = speedLossLegacy(r * calm, calm).value
      expect(Math.abs(exact - legacy)).toBeLessThan(0.012)
    }
  })

  it('배포본 식은 50%에서 잘린다', () => {
    expect(speedLossLegacy(10_000_000, 88_500).value).toBe(0.5)
  })
})

describe('classifyStability', () => {
  it('IMO 최소 기준 0.15 m 미만은 CRITICAL', () => {
    expect(classifyStability(0.14).status).toBe('CRITICAL')
    expect(classifyStability(0.15).status).toBe('WARNING')
  })

  it('PX121의 GM 0.587 m는 SAFE로 판정된다', () => {
    const v = classifyStability(0.586711)
    expect(v.status).toBe('SAFE')
    expect(v.gmt.confidence).toBe('library')
  })

  it('0.5 m 임계값이 기준서 값이 아님을 판정 근거에 밝힌다', () => {
    expect(classifyStability(0.3).basis).toMatch(/임의/)
  })

  it('GZ 곡선 기준을 확인하지 않았다는 한계를 남긴다', () => {
    expect(classifyStability(1.0).gmt.note).toMatch(/GZ/)
  })
})
