/**
 * 물리 계산 레이어 공개 API.
 *
 * 규칙: Vue 컴포넌트는 이 파일에서만 import한다. Vessel.js를 직접 부르지 않는다.
 */
export * from './types'
export * from './constants'
export * from './waves'
export * from './windHeel'
export * from './drift'
export * from './speedLoss'
export * from './stability'
export * from './snapshot'
export { VesselAdapter, loadShipSpec, setVesselModuleLoader } from './vesseljsAdapter'
export type { SeakeepingResult, ResistanceResult } from './vesseljsAdapter'
