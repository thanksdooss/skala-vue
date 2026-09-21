import { RHO_AIR, RHO_SEA, G, RAD, DEG, IMO_WIND_PRESSURE_PA, IMO_GUST_FACTOR } from './constants'
import type { Quantity, VesselParticulars } from './types'

/** 수면 위 측면 투영(수풍) 면적과 그 도심 높이. */
export interface WindageProfile {
  /** 수면 위 측면 투영면적 A [m²] */
  readonly area: number
  /** 수면에서 A의 도심까지 높이 [m] */
  readonly centroidAboveWaterline: number
}

/**
 * 배포된 앱이 쓰던 풍경사각 추정식을 **그대로** 재현한다.
 *
 * 이 함수의 목적은 "좋은 값"을 내는 것이 아니라, docs/validation.md에서
 * 참고 방법과 나란히 놓을 "내 식의 결과" 열을 만드는 것이다. 따라서
 * 원본의 거친 부분(수풍면적 0.6 계수, 배수량 손계산, 45° 캡)을 고치지 않고 남긴다.
 *
 * 원본 위치: public/vesseljs/examples/vessel_simulation.html, sendMotionData()
 */
export function windHeelLegacy(input: {
  windSpeedMs: number
  loa: number
  depth: number
  draft: number
  beam: number
  cb: number
  gmt: number
}): Quantity {
  const { windSpeedMs: v, loa, depth, draft, beam, cb, gmt } = input

  // 원본: 수면 위 높이를 (Depth − Draft + 3)으로 잡고 측면적에 0.6을 곱한다.
  const heightAboveWl = depth - draft + 3
  const area = loa * heightAboveWl * 0.6
  // 원본: 모멘트 팔을 "수면 위 도심 높이"로만 잡는다 (수중 측면적 중심을 고려하지 않음).
  const lever = heightAboveWl / 2

  // 원본: 배수량을 LOA·B·T·Cb·ρ로 손계산한다 (LWL이 아니라 LOA를 쓴다).
  const displacement = loa * beam * draft * cb * RHO_SEA

  const windMoment = 0.5 * RHO_AIR * v * v * area * lever
  const restoringMoment = displacement * G * gmt

  // 원본: 소각 선형화 후 45°로 자른다.
  const raw = restoringMoment > 0 ? (windMoment / restoringMoment) * RAD : 0
  const value = Math.min(raw, 45)

  return {
    value,
    unit: '°',
    method: 'legacy-simplified',
    confidence: 'estimate',
    range: {
      description: '경사각 < 약 5° (소각 선형화 GZ ≈ GM·θ)',
      inRange: value < 5,
      outOfRangeNote: '5°를 넘으면 sin θ 비선형성과 GZ 곡선 형상을 무시한 오차가 커진다',
    },
    note: '수풍면적·모멘트 팔·풍압계수가 모두 근사 — IMO 절차 대비 약 6배 과소평가 (docs/validation.md 참조)',
  }
}

/**
 * 측면 투영면적을 선체 건현 박스 + 상부구조 박스로 나눠 추정한다.
 *
 * `windHeelLegacy`의 단일 0.6 계수보다 낫지만 **여전히 추정이다**.
 * 실제 설계에서는 일반배치도에서 면적을 적분하거나 풍동시험 계수를 쓴다.
 * PSV 기본값(상부구조 길이 = 0.30·LOA, 높이 9 m)은 PX121급 외관 비례에서 잡은 값이다.
 */
export function windageProfile(
  vessel: Pick<VesselParticulars, 'loa' | 'depth' | 'draft'>,
  opts: { superstructureLengthRatio?: number; superstructureHeight?: number } = {},
): WindageProfile {
  const { superstructureLengthRatio = 0.3, superstructureHeight = 9 } = opts
  const freeboard = Math.max(vessel.depth - vessel.draft, 0)

  const hullArea = vessel.loa * freeboard
  const hullCentroid = freeboard / 2

  const superArea = vessel.loa * superstructureLengthRatio * superstructureHeight
  const superCentroid = freeboard + superstructureHeight / 2

  const area = hullArea + superArea
  const centroidAboveWaterline =
    area > 0 ? (hullArea * hullCentroid + superArea * superCentroid) / area : 0

  return { area, centroidAboveWaterline }
}

export interface ImoWindHeelResult {
  /** 정상풍에 의한 정적 경사각 */
  readonly steady: Quantity
  /** 돌풍(lw2 = 1.5·lw1)에 의한 경사각 */
  readonly gust: Quantity
  /** 경사 모멘트 팔 lw1 [m] */
  readonly heelingArmM: number
  /** 사용한 수풍 프로파일 */
  readonly windage: WindageProfile
}

/**
 * IMO 2008 IS Code, Part A 2.3 (severe wind and rolling criterion)의 풍압 절차를 구현한다.
 *
 *   lw1 = P · A · Z / (Δ · g)        [m]   — 정상풍 경사 모멘트 팔
 *   lw2 = 1.5 · lw1                  [m]   — 돌풍
 *   GZ(θ) ≈ GM · sin θ  =  lw       → θ = asin(lw / GM)
 *
 * Z는 A의 도심에서 수중 측면적 도심까지의 수직거리이며, 기준서 관행대로 T/2로 근사한다.
 * 기준서는 무제한 항해구역에 P = 504 Pa를 쓰고 풍향은 **정횡(최악)**을 가정한다.
 *
 * 구현은 기준 절차를 따르지만, 입력하는 수풍면적 A 자체가 추정이라는 점은 변하지 않는다.
 * 따라서 반환 등급은 `reference`이되 note에 그 한계를 적는다.
 */
export function windHeelImo(input: {
  windSpeedMs?: number
  vessel: VesselParticulars
  windage?: WindageProfile
  /** true면 실제 풍속의 동압을 쓰고, false(기본)면 IMO 기준 풍압 504 Pa를 쓴다 */
  useActualWindSpeed?: boolean
  /** 풍향과 선수방위의 상대각 [deg]. 생략하면 IMO와 동일하게 정횡(90°)으로 본다 */
  relativeWindAngleDeg?: number
}): ImoWindHeelResult {
  const { vessel, useActualWindSpeed = false, windSpeedMs = 0, relativeWindAngleDeg } = input
  const windage = input.windage ?? windageProfile(vessel)

  const pressure = useActualWindSpeed
    ? 0.5 * RHO_AIR * windSpeedMs * windSpeedMs * 1.22 // 504 Pa ↔ 26 m/s에서 역산한 형상계수
    : IMO_WIND_PRESSURE_PA

  // IMO는 정횡풍만 본다. 풍향을 반영하고 싶을 때만 횡방향 성분을 투영한다.
  const beamFactor =
    relativeWindAngleDeg === undefined ? 1 : Math.abs(Math.sin(relativeWindAngleDeg * DEG))

  const z = windage.centroidAboveWaterline + vessel.draft / 2
  const denom = vessel.displacementMass * G
  const lw1 = denom > 0 ? (pressure * windage.area * beamFactor * z) / denom : 0
  const lw2 = lw1 * IMO_GUST_FACTOR

  const angleFromArm = (arm: number): number => {
    if (vessel.gmt <= 0) return 0
    const s = arm / vessel.gmt
    return s >= 1 ? 90 : Math.asin(s) * RAD
  }

  const steadyDeg = angleFromArm(lw1)
  const gustDeg = angleFromArm(lw2)

  const range = {
    description: '초기 복원성 구간 (GZ ≈ GM·sin θ, 대략 θ < 10~15°)',
    inRange: gustDeg < 15,
    outOfRangeNote: '15°를 넘으면 실제 GZ 곡선을 적분해야 하며 이 선형 근사는 쓸 수 없다',
  }

  const note =
    'IMO IS Code 2008 Part A 2.3 절차. 풍압 504 Pa·정횡풍 가정. ' +
    '수풍면적 A는 일반배치도가 없어 박스 근사로 추정했다.'

  return {
    steady: { value: steadyDeg, unit: '°', method: 'imo-weather-criterion', confidence: 'reference', range, note },
    gust: { value: gustDeg, unit: '°', method: 'imo-weather-criterion-gust', confidence: 'reference', range, note },
    heelingArmM: lw1,
    windage,
  }
}
