/**
 * 물리 계산 레이어와 화면을 잇는 유일한 지점.
 *
 * Vue 컴포넌트는 Vessel.js도, physics 모듈의 개별 함수도 직접 부르지 않는다.
 * 화면에 뜨는 모든 수치는 여기서 만든 `PhysicsSnapshot` 하나에서 나온다.
 * (1단계에서 HUD와 3D 오버레이가 서로 다른 부가저항을 표시하던 문제의 구조적 해결책)
 */
import { ref, shallowRef, computed, type Ref } from 'vue'
import {
  VesselAdapter,
  computeSnapshot,
  type PhysicsSnapshot,
  type SeaState,
  type VesselHeadingState,
} from '../physics'

/** 어댑터는 무거우므로 앱 전체에서 하나만 만든다(비교 모드도 같은 선박을 쓴다). */
let adapterPromise: Promise<VesselAdapter> | null = null

function getAdapter(): Promise<VesselAdapter> {
  adapterPromise ??= VesselAdapter.create()
  return adapterPromise
}

export function useVesselPhysics(sea: Ref<SeaState>, vessel: Ref<VesselHeadingState>) {
  const adapter = shallowRef<VesselAdapter | null>(null)
  const loadError = ref<string | null>(null)

  const ready = getAdapter()
    .then((a) => {
      adapter.value = a
      return a
    })
    .catch((e: unknown) => {
      loadError.value = e instanceof Error ? e.message : String(e)
      throw e
    })

  const snapshot = computed<PhysicsSnapshot | null>(() =>
    adapter.value ? computeSnapshot(adapter.value, sea.value, vessel.value) : null,
  )

  /** 비교 모드처럼 임의의 조건으로 한 번 계산하고 싶을 때. */
  function snapshotFor(s: SeaState, v: VesselHeadingState): PhysicsSnapshot | null {
    return adapter.value ? computeSnapshot(adapter.value, s, v) : null
  }

  const particulars = computed(() => adapter.value?.particulars ?? null)
  const designDraft = computed(() => adapter.value?.designDraft ?? 6.5)

  return { adapter, ready, loadError, snapshot, snapshotFor, particulars, designDraft }
}
