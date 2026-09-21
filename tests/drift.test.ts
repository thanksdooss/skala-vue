import { describe, it, expect } from 'vitest'
import { setAndDrift, leewayFromWind, rudderCompensation } from '../src/physics/drift'

const vessel = { heading: 0, speed: 10 * 0.514444 } // 10 kn 북향

describe('setAndDrift', () => {
  it('해류가 없으면 편류각 0', () => {
    const r = setAndDrift({ currentVelocity: 0, currentDirection: 90, vessel })
    expect(r.driftAngle.value).toBe(0)
    expect(r.speedOverGround.value).toBeCloseTo(vessel.speed, 9)
  })

  it('정횡 해류에서 편류각 = atan(Vc/U)', () => {
    const Vc = 1.0
    const r = setAndDrift({ currentVelocity: Vc, currentDirection: 90, vessel })
    expect(r.driftAngle.value).toBeCloseTo((Math.atan(Vc / vessel.speed) * 180) / Math.PI, 9)
    expect(r.driftAngle.value).toBeCloseTo(11.0, 2)
  })

  it('좌현 해류는 부호가 반대다', () => {
    const stb = setAndDrift({ currentVelocity: 1, currentDirection: 90, vessel })
    const port = setAndDrift({ currentVelocity: 1, currentDirection: 270, vessel })
    expect(port.driftAngle.value).toBeCloseTo(-stb.driftAngle.value, 9)
  })

  it('정선수/정선미 해류는 편류를 만들지 않고 대지속력만 바꾼다', () => {
    const following = setAndDrift({ currentVelocity: 1, currentDirection: 0, vessel })
    const head = setAndDrift({ currentVelocity: 1, currentDirection: 180, vessel })
    expect(following.driftAngle.value).toBeCloseTo(0, 9)
    expect(head.driftAngle.value).toBeCloseTo(0, 9)
    expect(following.speedOverGround.value).toBeCloseTo(vessel.speed + 1, 9)
    expect(head.speedOverGround.value).toBeCloseTo(vessel.speed - 1, 9)
  })

  it('선수방위를 돌리면 같은 해류라도 편류각이 달라진다 (heading 하드코딩 회귀 방지)', () => {
    const north = setAndDrift({ currentVelocity: 1, currentDirection: 90, vessel })
    const east = setAndDrift({ currentVelocity: 1, currentDirection: 90, vessel: { ...vessel, heading: 90 } })
    expect(north.driftAngle.value).not.toBeCloseTo(east.driftAngle.value, 3)
    expect(east.driftAngle.value).toBeCloseTo(0, 9)
  })

  it('해류가 전진속도보다 빠르면 적용범위를 벗어났다고 표시한다', () => {
    const slow = { heading: 0, speed: 0.5 }
    const r = setAndDrift({ currentVelocity: 2, currentDirection: 90, vessel: slow })
    expect(r.driftAngle.range?.inRange).toBe(false)
  })

  it('운동학 관계이므로 reference 등급이되 유체력학적 편각이 아님을 명시한다', () => {
    const r = setAndDrift({ currentVelocity: 1, currentDirection: 45, vessel })
    expect(r.driftAngle.confidence).toBe('reference')
    expect(r.driftAngle.note).toMatch(/sideslip/)
  })
})

describe('leewayFromWind', () => {
  it('정횡풍 20 m/s, 계수 3% → 0.6 m/s', () => {
    const q = leewayFromWind({ windSpeedMs: 20, windDirection: 90, vessel })
    expect(q.value).toBeCloseTo(0.6, 9)
  })

  it('정선수풍에서는 횡방향 성분이 0', () => {
    expect(leewayFromWind({ windSpeedMs: 20, windDirection: 0, vessel }).value).toBeCloseTo(0, 9)
  })

  it('경험칙이므로 estimate 등급 — 화면에 참고용 배지가 붙어야 한다', () => {
    expect(leewayFromWind({ windSpeedMs: 20, windDirection: 90, vessel }).confidence).toBe('estimate')
  })
})

describe('rudderCompensation', () => {
  it('35°에서 잘린다', () => {
    expect(rudderCompensation(90).value).toBe(35)
  })

  it('근거 없는 연출값이므로 illustrative 등급이다', () => {
    expect(rudderCompensation(5).confidence).toBe('illustrative')
  })
})
