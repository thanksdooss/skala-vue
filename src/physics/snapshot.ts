/**
 * 한 해역·한 시점의 모든 계산 결과를 한 번에 만드는 조립 함수.
 *
 * 화면(단일 모드·비교 모드)과 테스트가 모두 이 함수 하나를 거치게 해서
 * "화면 위치마다 다른 값이 뜨는" 1단계의 문제가 구조적으로 재발하지 않게 한다.
 */
import { classifyStability, type StabilityVerdict } from './stability'
import { leewayFromWind, rudderCompensation, setAndDrift, type DriftResult } from './drift'
import { relativeWaveHeading, wavePowerFlux } from './waves'
import { windHeelImo, windHeelLegacy, type ImoWindHeelResult } from './windHeel'
import type { Quantity, SeaState, VesselHeadingState } from './types'
import type { ResistanceResult, SeakeepingResult, VesselAdapter } from './vesseljsAdapter'

export interface PhysicsSnapshot {
  readonly sea: SeaState
  readonly vessel: VesselHeadingState
  /** 파도가 오는 상대각 [deg] (180 = 정선수파) */
  readonly relativeWaveHeading: number
  readonly seakeeping: SeakeepingResult
  readonly resistance: ResistanceResult
  readonly stability: StabilityVerdict
  readonly wavePower: Quantity
  readonly drift: DriftResult
  readonly leeway: Quantity
  readonly rudder: Quantity
  /** 배포본이 쓰던 추정식 — 검증 비교용으로 계속 계산해 화면에서 나란히 보여준다 */
  readonly windHeelEstimate: Quantity
  /** IMO 절차 */
  readonly windHeelReference: ImoWindHeelResult
}

export function computeSnapshot(
  adapter: VesselAdapter,
  sea: SeaState,
  vessel: VesselHeadingState,
): PhysicsSnapshot {
  const p = adapter.particulars

  return {
    sea,
    vessel,
    relativeWaveHeading: relativeWaveHeading(sea.waveDirection, vessel.heading),
    seakeeping: adapter.seakeeping(sea, vessel),
    resistance: adapter.resistance(sea, vessel),
    stability: classifyStability(p.gmt),
    wavePower: wavePowerFlux(sea.waveHeight, sea.wavePeriod),
    drift: setAndDrift({
      currentVelocity: sea.currentVelocity,
      currentDirection: sea.currentDirection,
      vessel,
    }),
    leeway: leewayFromWind({
      windSpeedMs: sea.windSpeed,
      windDirection: sea.windDirection,
      vessel,
    }),
    rudder: rudderCompensation(
      setAndDrift({
        currentVelocity: sea.currentVelocity,
        currentDirection: sea.currentDirection,
        vessel,
      }).driftAngle.value,
    ),
    windHeelEstimate: windHeelLegacy({
      windSpeedMs: sea.windSpeed,
      loa: p.loa,
      depth: p.depth,
      draft: adapter.designDraft,
      // 배포본이 실제로 쓰던 값 그대로(BOA 18 m, 설계 Cb 0.68)여야 비교 대상이 된다.
      beam: p.boa,
      cb: p.cbDesign,
      gmt: p.gmt,
    }),
    windHeelReference: windHeelImo({
      vessel: { ...p, draft: adapter.designDraft },
      useActualWindSpeed: true,
      windSpeedMs: sea.windSpeed,
      relativeWindAngleDeg: relativeWaveHeading(sea.windDirection, vessel.heading),
    }),
  }
}

/** Open-Meteo 응답을 SeaState로 조립한다. null은 안전한 기본값으로 치환하고 그 사실을 알린다. */
export function toSeaState(input: {
  waveHeight: number | null
  wavePeriod: number | null
  waveDirection: number | null
  currentVelocity: number | null
  currentDirection: number | null
  windSpeed: number | null
  windDirection: number | null
}): { sea: SeaState; usedDefaults: boolean } {
  const usedDefaults = input.waveHeight === null || input.wavePeriod === null
  return {
    usedDefaults,
    sea: {
      waveHeight: input.waveHeight ?? 0,
      wavePeriod: input.wavePeriod ?? 8,
      waveDirection: input.waveDirection ?? 180,
      currentVelocity: input.currentVelocity ?? 0,
      currentDirection: input.currentDirection ?? 0,
      windSpeed: input.windSpeed ?? 0,
      windDirection: input.windDirection ?? 0,
    },
  }
}
