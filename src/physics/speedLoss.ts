import { G, RHO_SEA } from './constants'
import type { Quantity, VesselParticulars } from './types'

/**
 * Kreitner 식에 의한 파랑 중 부가저항 [N].
 *
 *   R_AW = 0.64 · (Hw · B)² · Cb · ρ · g / L
 *
 * Vessel.js `HullResistance.totalResistance`가 쓰는 것과 같은 식이다.
 * 다만 Vessel.js는 **Hw ≤ 2 m 에서만** 이 식을 쓰고 그 이상에서는 정수저항의 20%
 * 고정값(sea margin)으로 갈아탄다. 여기서는 식을 그대로 구현해 두어,
 * 어댑터가 2 m 초과 구간에서도 연속적인 값을 쓸 수 있게 한다.
 */
export function addedResistanceKreitner(
  waveHeightM: number,
  vessel: Pick<VesselParticulars, 'bwl' | 'lwl' | 'cb'>,
): Quantity {
  const { bwl, lwl, cb } = vessel
  const value =
    waveHeightM > 0 && lwl > 0
      ? (0.64 * Math.pow(waveHeightM * bwl, 2) * cb * RHO_SEA * G) / lwl
      : 0

  return {
    value,
    unit: 'N',
    method: 'kreitner',
    confidence: 'reference',
    range: {
      description: 'Vessel.js는 Hw ≤ 2 m 에서만 이 식을 적용한다',
      inRange: waveHeightM <= 2,
      outOfRangeNote:
        'Vessel.js 원본은 2 m 초과에서 정수저항의 20% 고정값으로 전환한다. ' +
        '이 어댑터는 연속성을 위해 Kreitner를 계속 쓰되 화면에 적용범위 밖임을 표시한다.',
    },
    note: 'Hs²에 비례하는 단순식 — 주기·파향·선속 의존성을 담지 않는다',
  }
}

/**
 * 두 번째 독립 참고 기준에 대한 메모.
 *
 * 원래는 ISO 15016 계열의 STAWAVE-1을 두 번째 비교 기준으로 넣으려 했다.
 * 그러나 ISO 15016 본문과 ITTC 7.5-04-01-01.2의 해당 식을 원문으로 확인하지 못했고,
 * 기억에 의존해 계수를 적으면 "검증 문서"가 아니라 추측 문서가 된다.
 * 따라서 이 항목은 **비워 둔다.** docs/validation.md의 "남은 검증" 절에 기록해 두었다.
 */

/**
 * 일정 출력 조건에서 부가저항 때문에 잃는 속도의 비율 [0~1].
 *
 * 가정: 서비스 속력 구간에서 정수저항이 R₀ ∝ V², 전달출력이 일정.
 *
 *   P = R(V)·V = 일정,  R(V) = c·V² + ΔR,  c·V₀² = R₀
 *   ⇒ R₀V₀·u³ + ΔR·V₀·u = R₀V₀ ,  u = V/V₀
 *   ⇒ u³ + r·u − 1 = 0 ,  r = ΔR/R₀
 *
 * 이 3차식을 이분법으로 푼다. 배포본이 쓰던 `ΔR/(3R₀)`는 이 식을 u≈1 근방에서
 * 1차로 전개한 것이며(x ≈ r/(3+r)), 실제로 r < 1 구간에서 두 값의 차이는 1%p 미만이다.
 * 즉 배포본의 식 자체는 타당했고, 문제는 식이 아니라 입력으로 들어가던 ΔR 쪽이었다.
 */
export function speedLossConstantPower(addedResistanceN: number, calmResistanceN: number): Quantity {
  if (calmResistanceN <= 0 || addedResistanceN <= 0) {
    return { value: 0, unit: '-', method: 'constant-power-cubic', confidence: 'reference' }
  }

  const r = addedResistanceN / calmResistanceN
  // u³ + r·u − 1 = 0 은 u ∈ (0, 1]에서 단조증가 → 이분법이 항상 수렴한다.
  let lo = 0
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (mid * mid * mid + r * mid - 1 < 0) lo = mid
    else hi = mid
  }
  const u = (lo + hi) / 2

  return {
    value: 1 - u,
    unit: '-',
    method: 'constant-power-cubic',
    confidence: 'reference',
    range: {
      description: '정수저항 R ∝ V², 전달출력 일정, 추진효율 변화 무시',
      inRange: r < 1,
      outOfRangeNote:
        'ΔR이 정수저항을 넘어서면 프로펠러 부하 변화와 주기관 토크 한계가 지배적이 되어 이 관계가 깨진다',
    },
    note: '프로펠러 효율 저하·자발적 감속(voluntary speed reduction)을 포함하지 않는 하한 추정',
  }
}

/** 배포본이 쓰던 1차 근사 `ΔR/(3R₀)` (상한 50%). 검증표의 "내 식" 열용. */
export function speedLossLegacy(addedResistanceN: number, calmResistanceN: number): Quantity {
  const value =
    calmResistanceN > 0 ? Math.min(addedResistanceN / (3 * calmResistanceN), 0.5) : 0
  return {
    value,
    unit: '-',
    method: 'legacy-linearised',
    confidence: 'estimate',
    note: '3차식의 1차 근사. r < 1 구간에서는 정확식과 1%p 이내로 일치한다.',
  }
}

/** 하단 HUD가 쓰던 부가저항 표시식 `18.5·Hs²·√2.9` [kN]. 검증표의 "내 식" 열용. */
export function addedResistanceLegacyHud(waveHeightM: number): Quantity {
  const value = waveHeightM > 0 ? 18.5 * waveHeightM * waveHeightM * Math.sqrt(290 / 100) : 0
  return {
    value: value * 1000,
    unit: 'N',
    method: 'legacy-hud',
    confidence: 'estimate',
    note:
      '"Holtrop"으로 표기돼 있었으나 실제로는 출처 불명의 상수식이다. ' +
      '계수 18.5는 PX121에 대한 Kreitner 값(≈17.7)과 가깝지만 √2.9 ≈ 1.70배가 더 곱해져 있다.',
  }
}
