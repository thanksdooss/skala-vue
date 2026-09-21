/**
 * Vessel.js(NTNU ShipLab, MIT) 어댑터.
 *
 * 앱의 나머지 부분은 Vessel.js를 직접 부르지 않고 이 파일만 본다. 이유는 셋이다.
 *  1. 라이브러리를 교체·업그레이드할 때 수정 지점이 여기 하나다.
 *  2. Vessel.js의 적용범위 밖 동작(파고 2 m 분기 등)을 한곳에서 보정하고 표시할 수 있다.
 *  3. 라이브러리가 계산한 값(`library`)과 내가 덧붙인 값(`estimate`)의 경계가 타입으로 드러난다.
 *
 * Vessel.js 원본 파일은 한 줄도 고치지 않는다. 고치면 업스트림과 갈라져 업그레이드가 막힌다.
 */
import { KNOT_TO_MS, RAD } from './constants'
import { addedResistanceKreitner, speedLossConstantPower } from './speedLoss'
import type { Quantity, SeaState, VesselParticulars, VesselHeadingState } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type VesselModule = any

const BROWSER_MODULE_URL = '/vesseljs/source/jsm/vessel.js'
const BROWSER_SPEC_URL = '/vesseljs/examples/ship_specs/PX121_dbb.json'

let modulePromise: Promise<VesselModule> | null = null

/**
 * Vessel.js를 **런타임에** 불러온다. 번들에 포함시키지 않는다.
 *
 * Vessel.js 원본은 `public/vesseljs/`에 한 벌만 둔다. 3D 렌더러 iframe과 이 앱이 같은 파일을 본다.
 * 그런데 Vite는 소스에서 `public/` 파일을 import하는 것을 막는다(빌드 시 변환을 거치지 않는 경로이기 때문).
 * `src/vendor/`로 복사해 오면 정적 import가 되지만, 라이브러리가 두 벌이 되어
 * "무엇이 벤더 코드인가"가 다시 흐려지고 업스트림 갱신 시 한쪽만 바뀔 수 있다.
 *
 * 그래서 번들러가 정적 분석할 수 없는 형태로 감싸 브라우저가 원본 파일을 그대로 받게 한다.
 * 복사본을 만들지 않기 위해 치르는 비용이고, 대신 `setVesselModuleLoader`로 교체 가능하게 두었다.
 */
let opaqueImport: ((u: string) => Promise<VesselModule>) | null = null

let moduleLoader: () => Promise<VesselModule> = () => {
  if (typeof window === 'undefined') {
    // Node(테스트): 표준 동적 import가 그대로 동작한다.
    const url = new URL('../../public/vesseljs/source/jsm/vessel.js', import.meta.url).href
    return import(/* @vite-ignore */ url)
  }
  // 브라우저: 번들러가 손대지 못하게 감싼다. `new Function`은 Node ESM에서는 쓸 수 없어
  // 브라우저 경로에서만, 그리고 필요할 때만 만든다.
  opaqueImport ??= new Function('u', 'return import(u)') as (u: string) => Promise<VesselModule>
  return opaqueImport(BROWSER_MODULE_URL)
}

export function setVesselModuleLoader(loader: () => Promise<VesselModule>): void {
  moduleLoader = loader
  modulePromise = null
}

function loadVesselModule(): Promise<VesselModule> {
  modulePromise ??= moduleLoader()
  return modulePromise
}

/** PX121 선박 사양 JSON을 읽어온다. */
export async function loadShipSpec(): Promise<Record<string, unknown>> {
  if (typeof window === 'undefined') {
    // 지정자를 변수로 두어 번들러가 정적 분석하지 않게 한다(브라우저 빌드에 node 모듈이 섞이지 않도록).
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const path = new URL('../../public/vesseljs/examples/ship_specs/PX121_dbb.json', import.meta.url)
    return JSON.parse(await readFile(path, 'utf8'))
  }
  const res = await fetch(BROWSER_SPEC_URL)
  if (!res.ok) throw new Error(`ship spec fetch failed: HTTP ${res.status}`)
  return res.json()
}

/**
 * Vessel.js는 계산할 때마다 `console.log`로 캐시 상태를 찍는다(수백 줄/초).
 * 원본을 고치지 않고 호출 구간에서만 막는다.
 */
function quietly<T>(fn: () => T): T {
  const original = console.log
  console.log = () => {}
  try {
    return fn()
  } finally {
    console.log = original
  }
}

export interface SeakeepingResult {
  readonly heaveAmp: Quantity
  readonly pitchAmp: Quantity
  readonly rollAmp: Quantity
  readonly verticalAcc: Quantity
}

export interface ResistanceResult {
  /** 정수저항 — Holtrop, 라이브러리 계산 */
  readonly calmResistance: Quantity
  /** 부가저항 — 어댑터가 Kreitner로 연속 계산 (라이브러리 2 m 분기를 우회) */
  readonly addedResistance: Quantity
  /** 라이브러리가 그대로 내놓는 부가저항. 검증표에서 비교용으로만 쓴다. */
  readonly addedResistanceRaw: Quantity
  /** 유효마력 [W] */
  readonly effectivePower: Quantity
  /** 속도 손실 비율 [0~1] */
  readonly speedLoss: Quantity
}

/**
 * Vessel.js 선박 하나를 감싼 계산기.
 *
 * `create()`로 만든 뒤에는 모든 메서드가 동기 순수 계산이다(내부 캐시만 갱신).
 */
export class VesselAdapter {
  private constructor(
    private readonly V: VesselModule,
    private readonly ship: any,
    private readonly state: any,
    private readonly waveCreator: any,
    private readonly waveMotion: any,
    private readonly hullResistance: any,
    readonly particulars: VesselParticulars,
  ) {}

  static async create(spec?: Record<string, unknown>): Promise<VesselAdapter> {
    const V = await loadVesselModule()
    const shipSpec = spec ?? (await loadShipSpec())

    return quietly(() => {
      const ship = new V.Ship(shipSpec)
      const state = ship.designState

      const waveCreator = new V.WaveCreator()
      waveCreator.setWaveDef((2 * Math.PI) / 8, 1, 180)

      const waveMotion = new V.WaveMotion(ship, state, waveCreator)
      // PSV급 쌍축 프로펠러 기본값 — 사양서에 프로펠러 정보가 없어 어댑터에서 가정한다.
      const propeller = { D: 3.2, noProps: 2, P: 3.5, AeAo: 0.55 }
      const hullResistance = new V.HullResistance(ship, state, propeller, waveCreator)

      const float = state.discrete.FloatingCondition.state
      const stability = ship.calculateStability(state)
      const hullAttrs = ship.structure.hull.attributes

      const particulars: VesselParticulars = {
        loa: hullAttrs.LOA,
        lwl: float.LWL,
        bwl: float.BWL,
        boa: hullAttrs.BOA,
        depth: hullAttrs.Depth,
        draft: float.T,
        cb: float.Cb,
        cbDesign: state.calculationParameters.Cb_design,
        displacementMass: stability.w.mass,
        gmt: float.GMt,
        serviceSpeedKn: state.calculationParameters.speed,
      }

      return new VesselAdapter(V, ship, state, waveCreator, waveMotion, hullResistance, particulars)
    })
  }

  /** 설계 흘수 [m] — 3D 렌더링의 잠김 깊이로 쓴다(중량 기준 흘수와 다르다). */
  get designDraft(): number {
    return this.state.calculationParameters.Draft_design ?? this.particulars.draft
  }

  private applyState(sea: SeaState, vessel: VesselHeadingState): void {
    const amplitude = Math.max(sea.waveHeight, 0) / 2
    const period = sea.wavePeriod > 0 ? sea.wavePeriod : 8
    this.waveCreator.setWaveDef((2 * Math.PI) / period, amplitude, sea.waveDirection)
    this.waveMotion.setHeading(vessel.heading)
    this.waveMotion.setSpeed(vessel.speed / KNOT_TO_MS)
    this.hullResistance.setSpeed(vessel.speed / KNOT_TO_MS)
  }

  /**
   * 6자유도 운동 진폭. 전적으로 Vessel.js `WaveMotion`의 계산이다.
   *
   * 참고: 횡동요는 조우주파수가 고유 횡동요주기에 가까울 때만 의미 있는 값이 나오고,
   * 정선수·정선미파(β = 0°/180°)에서는 가진력이 0이라 0이 나온다. 버그가 아니다.
   */
  seakeeping(sea: SeaState, vessel: VesselHeadingState): SeakeepingResult {
    return quietly(() => {
      this.applyState(sea, vessel)

      const m = this.waveMotion.verticalMotion
      const roll = this.waveMotion.rollAmp
      const lib = (value: number, unit: string, note?: string): Quantity => ({
        value: Number.isFinite(value) ? value : 0,
        unit,
        method: 'vesseljs-WaveMotion',
        confidence: 'library',
        note,
      })

      return {
        heaveAmp: lib(Math.abs(m.heaveAmp), 'm'),
        pitchAmp: lib(Math.abs(m.pitchAmp) * RAD, '°'),
        rollAmp: lib(
          Math.abs(roll) * RAD,
          '°',
          '정선수/정선미파에서는 가진력이 0이므로 0으로 계산된다',
        ),
        verticalAcc: lib(Math.abs(m.verticalAcc), 'm/s²'),
      }
    })
  }

  /**
   * 저항과 속도 손실.
   *
   * 정수저항은 라이브러리(Holtrop)를 그대로 쓴다. 부가저항만 어댑터가 다시 계산한다.
   * 이유: Vessel.js `totalResistance`는 파고 2 m를 넘으면 Kreitner 식을 버리고
   * `1.2 × 정수저항` 고정값으로 갈아탄다. 그 결과 파고가 2.0 m → 2.1 m로 커질 때
   * 부가저항이 53.6 kN → 17.7 kN으로 **떨어지고** 그 뒤로 파고와 무관해진다.
   * 화면에 "파도가 거칠수록 배가 덜 느려진다"고 뜨는 것을 두고 볼 수 없어서,
   * 어댑터에서 Kreitner를 연속 적용하고 2 m 초과 구간은 적용범위 밖으로 표시한다.
   */
  resistance(sea: SeaState, vessel: VesselHeadingState): ResistanceResult {
    return quietly(() => {
      this.applyState(sea, vessel)

      const calm: number = this.hullResistance.calmResistance
      const raw = this.hullResistance.totalResistance
      const added = addedResistanceKreitner(sea.waveHeight, this.particulars)
      const loss = speedLossConstantPower(added.value, calm)

      return {
        calmResistance: {
          value: calm,
          unit: 'N',
          method: 'vesseljs-HullResistance (Holtrop)',
          confidence: 'library',
          range: {
            description: 'Holtrop 적용범위: 3.9 < L/B < 15, 2.1 < B/T < 4, 0.55 < Cp < 0.85',
            inRange: true,
            outOfRangeNote: 'PX121은 세 조건을 모두 만족한다 (docs/validation.md 참조)',
          },
        },
        addedResistance: added,
        addedResistanceRaw: {
          value: raw.Rtadd - calm,
          unit: 'N',
          method: 'vesseljs-HullResistance.totalResistance',
          confidence: 'library',
          range: {
            description: 'Hw ≤ 2 m에서만 Kreitner, 초과 시 정수저항의 20% 고정',
            inRange: sea.waveHeight <= 2,
            outOfRangeNote: '2 m 초과 구간에서는 파고에 무관한 상수가 된다',
          },
        },
        effectivePower: {
          value: raw.Pe,
          unit: 'W',
          method: 'vesseljs-HullResistance',
          confidence: 'library',
        },
        speedLoss: loss,
      }
    })
  }

  /** 복원성 원시값. `classifyStability`에 넘겨 판정한다. */
  stability(): { gmt: number; displacementMass: number; draftFromWeight: number } {
    return quietly(() => {
      const s = this.ship.calculateStability(this.state)
      return { gmt: s.GMt, displacementMass: s.w.mass, draftFromWeight: s.T }
    })
  }
}
