import { G, DEG, WAVE_FLUX_COEFF_KW } from './constants'
import type { Quantity } from './types'

/**
 * 파도가 오는 방향과 선수방위의 상대각 [deg, 0~180].
 *
 * 0°  = 선미파(following sea), 90° = 횡파(beam sea), 180° = 선수파(head sea).
 * Vessel.js `WaveMotion`이 쓰는 betha와 같은 정의라서, 어댑터에서 그대로 넘길 수 있다.
 */
export function relativeWaveHeading(waveDirectionDeg: number, headingDeg: number): number {
  const d = Math.abs(((waveDirectionDeg - headingDeg) % 360 + 360) % 360)
  return d > 180 ? 360 - d : d
}

/** 심해파 파수 k = ω²/g [1/m] */
export function waveNumber(periodS: number): number {
  if (periodS <= 0) return 0
  const omega = (2 * Math.PI) / periodS
  return (omega * omega) / G
}

/** 심해파 파장 λ = g·T²/(2π) [m] */
export function deepWaterWavelength(periodS: number): number {
  if (periodS <= 0) return 0
  return (G * periodS * periodS) / (2 * Math.PI)
}

/**
 * 조우주파수 ω_e = ω − k·U·cos(β) [rad/s].
 *
 * β는 `relativeWaveHeading` 정의를 따른다(180° = 선수파). 선수파에서는 cos β = −1이므로
 * ω_e > ω, 즉 배가 파도를 더 자주 만난다.
 */
export function encounterFrequency(periodS: number, speedMs: number, relHeadingDeg: number): number {
  if (periodS <= 0) return 0
  const omega = (2 * Math.PI) / periodS
  return omega - waveNumber(periodS) * speedMs * Math.cos(relHeadingDeg * DEG)
}

/**
 * 심해 파랑 에너지 플럭스 P = ρg²·Hs²·Te / (64π) [kW/m].
 *
 * 교과서 식을 그대로 구현한 것이라 신뢰 등급은 `reference`다.
 * 다만 **엄밀히는 에너지주기 Te를 써야 하고**, Open-Meteo가 주는 것은 첨두주기 Tp다.
 * JONSWAP 스펙트럼에서 Te ≈ 0.85~0.90·Tp이므로 Tp를 그대로 넣으면 약 10~18% 과대평가된다.
 * 이 프로젝트는 Tp를 그대로 쓰고, 대신 그 사실을 note로 표시한다.
 */
export function wavePowerFlux(waveHeightM: number, peakPeriodS: number): Quantity {
  const value = waveHeightM > 0 && peakPeriodS > 0
    ? WAVE_FLUX_COEFF_KW * waveHeightM * waveHeightM * peakPeriodS
    : 0

  return {
    value,
    unit: 'kW/m',
    method: 'deep-water-energy-flux',
    confidence: 'reference',
    range: {
      description: '심해 조건 (수심 > λ/2)',
      inRange: true,
      outOfRangeNote: '천해에서는 군속도가 달라져 이 식이 과대평가한다',
    },
    note: 'Tp를 에너지주기 Te 대신 사용 — Te ≈ 0.85~0.90·Tp이므로 약 10~18% 과대평가',
  }
}
