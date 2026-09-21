import { describe, it, expect } from 'vitest'
import {
  relativeWaveHeading,
  waveNumber,
  deepWaterWavelength,
  encounterFrequency,
  wavePowerFlux,
} from '../src/physics/waves'
import { G } from '../src/physics/constants'

describe('relativeWaveHeading', () => {
  it('정선수파는 180°, 정횡파는 90°, 정선미파는 0°', () => {
    expect(relativeWaveHeading(180, 0)).toBe(180)
    expect(relativeWaveHeading(90, 0)).toBe(90)
    expect(relativeWaveHeading(0, 0)).toBe(0)
  })

  it('항상 0~180°로 접힌다 (270° 파향 = 좌현 정횡)', () => {
    expect(relativeWaveHeading(270, 0)).toBe(90)
    expect(relativeWaveHeading(350, 10)).toBe(20)
    expect(relativeWaveHeading(10, 350)).toBe(20)
  })
})

describe('심해파 분산관계', () => {
  it('파장 λ = g·T²/(2π) — T = 10 s 에서 약 156 m', () => {
    expect(deepWaterWavelength(10)).toBeCloseTo((G * 100) / (2 * Math.PI), 6)
    expect(deepWaterWavelength(10)).toBeCloseTo(156.1, 1)
  })

  it('파수와 파장은 k·λ = 2π를 만족한다', () => {
    for (const T of [4, 8, 12, 16]) {
      expect(waveNumber(T) * deepWaterWavelength(T)).toBeCloseTo(2 * Math.PI, 9)
    }
  })

  it('주기가 0 이하면 0을 돌려준다 (API가 null을 줄 때의 방어)', () => {
    expect(waveNumber(0)).toBe(0)
    expect(deepWaterWavelength(-1)).toBe(0)
  })
})

describe('encounterFrequency', () => {
  const T = 10
  const omega = (2 * Math.PI) / T

  it('정지 상태에서는 조우주파수 = 파주파수', () => {
    expect(encounterFrequency(T, 0, 180)).toBeCloseTo(omega, 9)
  })

  it('선수파에서는 조우주파수가 커진다', () => {
    expect(encounterFrequency(T, 5, 180)).toBeGreaterThan(omega)
  })

  it('선미파에서는 조우주파수가 작아진다', () => {
    expect(encounterFrequency(T, 5, 0)).toBeLessThan(omega)
  })

  it('정횡파에서는 선속의 영향이 없다', () => {
    expect(encounterFrequency(T, 5, 90)).toBeCloseTo(omega, 9)
  })
})

describe('wavePowerFlux', () => {
  it('교과서 예시: Hs = 3 m, Tp = 8 s → 약 35 kW/m', () => {
    // P = ρg²H²T/(64π) = 0.4906 × 9 × 8
    expect(wavePowerFlux(3, 8).value).toBeCloseTo(35.3, 1)
  })

  it('파고의 제곱, 주기의 1제곱에 비례한다', () => {
    const base = wavePowerFlux(2, 8).value
    expect(wavePowerFlux(4, 8).value / base).toBeCloseTo(4, 9)
    expect(wavePowerFlux(2, 16).value / base).toBeCloseTo(2, 9)
  })

  it('교과서 식이므로 reference 등급이고, Tp 사용에 대한 한계를 남긴다', () => {
    const q = wavePowerFlux(2, 8)
    expect(q.confidence).toBe('reference')
    expect(q.note).toMatch(/Te/)
  })

  it('데이터가 없으면 0', () => {
    expect(wavePowerFlux(0, 8).value).toBe(0)
    expect(wavePowerFlux(2, 0).value).toBe(0)
  })
})
