import { DEG, RAD } from './constants'
import type { Quantity, VesselHeadingState } from './types'

export interface DriftResult {
  /** 침로와 실제 진행방향(대지침로)의 차이 = 편류각 */
  readonly driftAngle: Quantity
  /** 횡방향 이동 속도 성분 [m/s] */
  readonly lateralSpeed: Quantity
  /** 대지속력 [m/s] */
  readonly speedOverGround: Quantity
}

/**
 * 조류에 의한 편류(set & drift)를 **운동학적으로** 계산한다.
 *
 * 항해학의 속도 삼각형 그대로다. 선박 대수속도 벡터에 해류 벡터를 더해서
 * 대지속도 벡터를 얻고, 그 방향과 선수방위의 차이를 편류각으로 본다.
 *
 *   V_lat  = Vc · sin(θc − ψ)
 *   V_long = U  + Vc · cos(θc − ψ)
 *   β      = atan2(V_lat, V_long)
 *
 * **이것은 유체력학적 편각(sideslip angle)이 아니다.** 선체에 작용하는 횡력·선회 모멘트,
 * 타력 평형을 전혀 풀지 않는다. 조류에 실려 흘러가는 기하학적 관계일 뿐이므로,
 * 조종성능(MMG·Abkowitz 모델)의 편각과 혼동하면 안 된다.
 */
export function setAndDrift(input: {
  currentVelocity: number
  currentDirection: number
  vessel: VesselHeadingState
}): DriftResult {
  const { currentVelocity, currentDirection, vessel } = input
  const rel = (currentDirection - vessel.heading) * DEG

  const lateral = currentVelocity * Math.sin(rel)
  const longitudinal = vessel.speed + currentVelocity * Math.cos(rel)
  const angle = Math.atan2(lateral, Math.abs(longitudinal)) * RAD
  const sog = Math.hypot(lateral, longitudinal)

  const inRange = Math.abs(longitudinal) > currentVelocity

  return {
    driftAngle: {
      value: angle,
      unit: '°',
      method: 'set-and-drift-kinematics',
      confidence: 'reference',
      range: {
        description: '전진속도가 해류속도보다 클 것 (|V_long| > Vc)',
        inRange,
        outOfRangeNote: '저속·강조류에서는 선박이 조종성을 잃어 이 기하 관계가 성립하지 않는다',
      },
      note: '속도 삼각형에 의한 운동학적 편류각 — 유체력학적 편각(sideslip)이 아니다. 풍압 편류(leeway)는 포함하지 않는다.',
    },
    lateralSpeed: {
      value: Math.abs(lateral),
      unit: 'm/s',
      method: 'set-and-drift-kinematics',
      confidence: 'reference',
    },
    speedOverGround: {
      value: sog,
      unit: 'm/s',
      method: 'set-and-drift-kinematics',
      confidence: 'reference',
    },
  }
}

/**
 * 풍압 편류(leeway)를 풍속의 고정 비율로 추정한다.
 *
 * 해상수색구조(IAMSAR)에서 표류물 예측에 쓰는 "풍속의 수 %" 경험칙을 빌린 것이다.
 * 계수는 표류물 형상에 따라 1~6%로 크게 변하고, 자항 중인 선박에는 원래 이 규칙을 쓰지 않는다.
 * 따라서 값 자체보다 "조류 편류 외에 바람 성분이 추가로 있다"는 크기 감각 용도로만 쓴다.
 */
export function leewayFromWind(input: {
  windSpeedMs: number
  windDirection: number
  vessel: VesselHeadingState
  /** 풍속 대비 표류속도 비율. 기본 3%. */
  coefficient?: number
}): Quantity {
  const { windSpeedMs, windDirection, vessel, coefficient = 0.03 } = input
  const rel = (windDirection - vessel.heading) * DEG
  const lateral = Math.abs(windSpeedMs * coefficient * Math.sin(rel))

  return {
    value: lateral,
    unit: 'm/s',
    method: 'leeway-percentage-rule',
    confidence: 'estimate',
    range: {
      description: '표류물 경험칙(풍속의 1~6%)을 차용',
      inRange: true,
      outOfRangeNote: '자항 선박에는 원래 적용 대상이 아니다',
    },
    note: `풍속의 ${(coefficient * 100).toFixed(0)}% 고정 비율 — 선형·흘수·건현에 따른 차이를 반영하지 않는 참고용 추정값`,
  }
}

/**
 * 편류각을 상쇄하기 위한 타각을 편류각의 배수로 표시한다.
 *
 * **물리적 근거가 없다.** 실제 타각은 선체 횡력·선회 모멘트와 타의 양력이 평형을 이루는
 * 지점에서 결정되며, 선형·타 면적·속력에 따라 달라진다. 이 값은 화면에서
 * "조류가 세면 타를 더 잡아야 한다"는 방향성만 보여주는 연출값이다.
 */
export function rudderCompensation(driftAngleDeg: number, gain = 2.5, maxDeg = 35): Quantity {
  return {
    value: Math.min(Math.abs(driftAngleDeg * gain), maxDeg),
    unit: '°',
    method: 'proportional-illustration',
    confidence: 'illustrative',
    note: '편류각 × 고정계수. 조종운동방정식을 풀지 않은 화면 연출값이며 실제 타각이 아니다.',
  }
}
