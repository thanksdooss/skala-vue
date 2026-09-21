/**
 * src/physics — UI와 분리된 순수 계산 레이어.
 *
 * 이 디렉터리의 모든 함수는 부수효과가 없고 DOM·Vue·Three.js를 참조하지 않는다.
 * 목적은 두 가지다.
 *   1. 단위 테스트로 값을 고정할 수 있게 한다.
 *   2. 모든 결과에 "이 값을 얼마나 믿어도 되는가"를 타입으로 강제한다.
 */

/**
 * 계산 결과의 신뢰 등급. 화면 표시 규칙과 1:1로 대응한다.
 *
 * - `library`  : 검증된 외부 라이브러리(Vessel.js)가 계산했다. 배지 없음.
 * - `reference`: 공개된 표준·기준 절차를 그대로 구현했다(IMO IS Code 등). 출처 표기.
 * - `estimate` : 내가 만든 단순화 추정식이다. **화면에 "참고용 추정값" 배지 필수.**
 * - `illustrative`: 물리적 근거 없이 화면 연출을 위해 넣은 값. **"연출값" 배지 필수.**
 */
export type Confidence = 'library' | 'reference' | 'estimate' | 'illustrative'

/** 계산이 유효한 입력 범위. 벗어나면 `inRange: false`로 내려보내 화면에서 경고한다. */
export interface AppliedRange {
  /** 사람이 읽는 범위 설명. 예: "유의파고 Hw ≤ 2 m" */
  readonly description: string
  /** 현재 입력이 그 범위 안인가 */
  readonly inRange: boolean
  /** 범위를 벗어났을 때 무슨 일이 일어나는지 */
  readonly outOfRangeNote?: string
}

/**
 * 모든 물리 계산의 반환 타입.
 *
 * 값만 반환하지 않는 이유: 이 프로젝트에서 가장 위험한 실패는 "틀린 값"이 아니라
 * "얼마나 믿을 값인지 모른 채 화면에 뜬 값"이다. 신뢰 등급을 값에 붙여서
 * UI가 배지를 빠뜨릴 수 없게 만든다.
 */
export interface Quantity {
  readonly value: number
  readonly unit: string
  /** 어떤 방법으로 구했는가. 화면 툴팁과 docs/validation.md의 키. */
  readonly method: string
  readonly confidence: Confidence
  readonly range?: AppliedRange
  /** 한 줄 한계 설명. 화면 툴팁에 그대로 노출한다. */
  readonly note?: string
}

/** 해당 시점·해역의 해상 상태. Open-Meteo 응답에서 조립한다. */
export interface SeaState {
  /** 유의파고 Hs [m] */
  readonly waveHeight: number
  /** 파주기 Tp [s] */
  readonly wavePeriod: number
  /** 파향 [deg, 파도가 "오는" 방향 기준 — Open-Meteo 규약] */
  readonly waveDirection: number
  /** 해류 속도 [m/s] */
  readonly currentVelocity: number
  /** 해류 방향 [deg] */
  readonly currentDirection: number
  /** 풍속 [m/s] — Open-Meteo는 km/h로 주므로 어댑터에서 변환해 넣는다 */
  readonly windSpeed: number
  /** 풍향 [deg] */
  readonly windDirection: number
}

/** 선박 주요 치수. Vessel.js floatState 또는 사용자 입력에서 만든다. */
export interface VesselParticulars {
  /** 전장 LOA [m] */
  readonly loa: number
  /** 수선간장 LWL [m] */
  readonly lwl: number
  /** 수선폭 BWL [m] */
  readonly bwl: number
  /** 최대폭 BOA [m] — 배포본 추정식이 쓰던 값이라 비교를 위해 보관한다 */
  readonly boa: number
  /** 형심 Depth [m] */
  readonly depth: number
  /** 흘수 T [m] */
  readonly draft: number
  /** 방형계수 Cb [-] (실제 부양 상태 기준) */
  readonly cb: number
  /** 설계 방형계수 Cb_design [-] — 배포본 추정식이 쓰던 값 */
  readonly cbDesign: number
  /** 배수량 [kg] */
  readonly displacementMass: number
  /** 횡메타센터 높이 GMt [m] */
  readonly gmt: number
  /** 설계 속력 [knots] */
  readonly serviceSpeedKn: number
}

/** 선박의 운항 상태(선수방위·속력). 하드코딩하지 않고 항상 명시로 받는다. */
export interface VesselHeadingState {
  /** 선수방위 [deg] */
  readonly heading: number
  /** 대수속력 [m/s] */
  readonly speed: number
}
