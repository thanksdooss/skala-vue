import { describe, it, expect, beforeAll } from 'vitest'
import { VesselAdapter } from '../src/physics/vesseljsAdapter'
import { computeSnapshot, toSeaState } from '../src/physics/snapshot'
import type { PhysicsSnapshot } from '../src/physics/snapshot'
import type { Confidence, Quantity, SeaState, VesselHeadingState } from '../src/physics/types'

let ship: VesselAdapter

const vessel: VesselHeadingState = { heading: 0, speed: 10 * 0.514444 }
const sea = (o: Partial<SeaState> = {}): SeaState => ({
  waveHeight: 2.5, wavePeriod: 9, waveDirection: 120,
  currentVelocity: 0.8, currentDirection: 60,
  windSpeed: 14, windDirection: 200, ...o,
})

beforeAll(async () => { ship = await VesselAdapter.create() }, 60_000)

/** 스냅샷 안의 모든 Quantity를 경로와 함께 훑는다. */
function walk(node: unknown, path = ''): Array<[string, Quantity]> {
  if (node === null || typeof node !== 'object') return []
  const obj = node as Record<string, unknown>
  if (typeof obj.value === 'number' && typeof obj.confidence === 'string') {
    return [[path, obj as unknown as Quantity]]
  }
  return Object.entries(obj).flatMap(([k, v]) => walk(v, path ? `${path}.${k}` : k))
}

describe('computeSnapshot — 화면 값의 단일 출처', () => {
  let snap: PhysicsSnapshot

  beforeAll(() => { snap = computeSnapshot(ship, sea(), vessel) })

  it('모든 수치에 신뢰 등급이 붙어 있다 (배지를 빠뜨릴 수 없다)', () => {
    const all = walk(snap)
    expect(all.length).toBeGreaterThan(10)
    const valid: Confidence[] = ['library', 'reference', 'estimate', 'illustrative']
    for (const [path, q] of all) {
      expect(valid, `${path}의 등급이 유효하지 않다`).toContain(q.confidence)
      expect(Number.isFinite(q.value), `${path}가 NaN/Infinity다`).toBe(true)
      expect(q.unit.length, `${path}에 단위가 없다`).toBeGreaterThan(0)
      expect(q.method.length, `${path}에 계산 방법이 없다`).toBeGreaterThan(0)
    }
  })

  it('추정값·연출값에는 한계 설명(note)이 반드시 있다', () => {
    for (const [path, q] of walk(snap)) {
      if (q.confidence === 'estimate' || q.confidence === 'illustrative') {
        expect(q.note, `${path}에 한계 설명이 없다`).toBeTruthy()
      }
    }
  })

  it('같은 입력이면 항상 같은 결과 (화면 위치마다 다른 값이 뜰 수 없다)', () => {
    const a = computeSnapshot(ship, sea(), vessel)
    const b = computeSnapshot(ship, sea(), vessel)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('풍압 경사는 추정식과 기준 절차를 둘 다 담는다 — 화면에서 나란히 비교한다', () => {
    expect(snap.windHeelEstimate.confidence).toBe('estimate')
    expect(snap.windHeelReference.steady.confidence).toBe('reference')
    expect(snap.windHeelReference.gust.value).toBeGreaterThan(snap.windHeelReference.steady.value)
  })

  it('상대 파향이 선수방위를 반영한다', () => {
    expect(computeSnapshot(ship, sea({ waveDirection: 120 }), { ...vessel, heading: 0 }).relativeWaveHeading).toBe(120)
    expect(computeSnapshot(ship, sea({ waveDirection: 120 }), { ...vessel, heading: 120 }).relativeWaveHeading).toBe(0)
  })

  it('타각은 편류각에서 파생되며 둘의 관계가 유지된다', () => {
    expect(snap.rudder.value).toBeCloseTo(Math.min(Math.abs(snap.drift.driftAngle.value * 2.5), 35), 6)
  })

  it('정온한 바다에서는 운동·저항·경사가 모두 0으로 수렴한다', () => {
    const calm = computeSnapshot(
      ship,
      sea({ waveHeight: 0, currentVelocity: 0, windSpeed: 0 }),
      vessel,
    )
    expect(calm.seakeeping.heaveAmp.value).toBeCloseTo(0, 6)
    expect(calm.resistance.addedResistance.value).toBe(0)
    expect(calm.resistance.speedLoss.value).toBe(0)
    expect(calm.drift.driftAngle.value).toBe(0)
    expect(calm.windHeelEstimate.value).toBe(0)
    expect(calm.windHeelReference.steady.value).toBe(0)
    expect(calm.wavePower.value).toBe(0)
  })

  it('정수저항은 바다 상태와 무관하다 (파고를 바꿔도 변하지 않는다)', () => {
    const a = computeSnapshot(ship, sea({ waveHeight: 0.5 }), vessel).resistance.calmResistance.value
    const b = computeSnapshot(ship, sea({ waveHeight: 4 }), vessel).resistance.calmResistance.value
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('toSeaState — API 결측값 처리', () => {
  const full = {
    waveHeight: 1.5, wavePeriod: 7, waveDirection: 200,
    currentVelocity: 0.4, currentDirection: 30, windSpeed: 9, windDirection: 150,
  }

  it('값이 다 있으면 그대로 통과시킨다', () => {
    const { sea, usedDefaults } = toSeaState(full)
    expect(usedDefaults).toBe(false)
    expect(sea).toEqual(full)
  })

  it('해양 자료가 없으면 파고 0으로 두고 그 사실을 알린다', () => {
    // 배포본은 여기서 1.5 m를 기본값으로 넣어, 육지를 찍어도 배가 계속 흔들렸다.
    const { sea, usedDefaults } = toSeaState({ ...full, waveHeight: null, wavePeriod: null })
    expect(usedDefaults).toBe(true)
    expect(sea.waveHeight).toBe(0)
    expect(sea.wavePeriod).toBe(8)
  })

  it('일부만 없어도 나머지는 살린다', () => {
    const { sea } = toSeaState({ ...full, currentVelocity: null, windSpeed: null })
    expect(sea.currentVelocity).toBe(0)
    expect(sea.windSpeed).toBe(0)
    expect(sea.waveHeight).toBe(1.5)
  })
})
