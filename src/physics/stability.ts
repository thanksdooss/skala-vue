import { IMO_MIN_GM } from './constants'
import type { Quantity } from './types'

export type StabilityStatus = 'SAFE' | 'WARNING' | 'CRITICAL'

export interface StabilityVerdict {
  readonly status: StabilityStatus
  readonly gmt: Quantity
  /** 판정 근거 한 줄. 화면 툴팁에 그대로 쓴다. */
  readonly basis: string
}

/**
 * 초기 복원성 GMt로 상태를 3단계 판정한다.
 *
 * 임계값의 근거가 서로 다르다는 점을 분명히 해 둔다.
 *  - CRITICAL (< 0.15 m): **IMO 2008 IS Code Part A 2.2.4의 GM0 최소 기준**이다. 근거 있음.
 *  - WARNING  (< 0.50 m): **내가 정한 임의 여유값**이다. 어떤 기준서에도 없다.
 *
 * 또한 GM만으로는 복원성을 판정할 수 없다. IS Code는 GZ 곡선 면적(0~30°, 0~40°),
 * 최대 GZ와 그 각도, 기상 판정 기준을 함께 요구한다. 여기서는 그중 하나만 본다.
 */
export function classifyStability(gmtM: number): StabilityVerdict {
  let status: StabilityStatus
  let basis: string

  if (gmtM < IMO_MIN_GM) {
    status = 'CRITICAL'
    basis = `GM0 = ${gmtM.toFixed(3)} m < ${IMO_MIN_GM} m — IMO IS Code 2008 A/2.2.4 최소 기준 미달`
  } else if (gmtM < 0.5) {
    status = 'WARNING'
    basis = `GM0 = ${gmtM.toFixed(3)} m — IMO 최소 기준(0.15 m)은 넘지만 여유가 작다 (0.5 m는 기준서 값이 아닌 임의 임계값)`
  } else {
    status = 'SAFE'
    basis = `GM0 = ${gmtM.toFixed(3)} m — IMO 최소 기준 충족 (GZ 곡선 기준은 검토하지 않음)`
  }

  return {
    status,
    basis,
    gmt: {
      value: gmtM,
      unit: 'm',
      method: 'vesseljs-calculateStability',
      confidence: 'library',
      note: 'GM0 단일 지표 판정 — GZ 곡선 면적·최대 GZ·기상 판정 기준은 확인하지 않았다',
    },
  }
}
