/**
 * Open-Meteo 연동 (API 키 불필요, 비상업 무료).
 *
 * 1단계 점검에서 드러난 신뢰성 구멍을 메운 버전이다.
 *  - 실패해도 화면이 조용히 기본값으로 돌던 문제 → status/error를 밖으로 노출
 *  - 지도를 연타하면 응답 순서가 뒤집히던 문제 → AbortController로 이전 요청 취소
 *  - 오프라인·레이트리밋에서 아무것도 못 보여주던 문제 → 캐시 + "마지막 값" 표시
 *
 * 출처 표기: Open-Meteo (https://open-meteo.com, CC BY 4.0). 화면 하단에 표기한다.
 */
import { ref, reactive, computed, readonly } from 'vue'

export interface CurrentWeather {
  temperature: number | null
  windSpeed: number | null // m/s — 요청 단위를 명시해 km/h 혼동을 없앴다
  windDirection: number | null
  weatherCode: number | null
  surfacePressure: number | null
  isDay: boolean
}

export interface MarineConditions {
  waveHeight: number | null
  waveDirection: number | null
  wavePeriod: number | null
  currentVelocity: number | null
  currentDirection: number | null
}

export type FetchStatus = 'idle' | 'loading' | 'live' | 'cached' | 'error'

interface CacheEntry {
  at: number
  current: CurrentWeather
  marine: MarineConditions
}

const CACHE_PREFIX = 'skala-marine:v1:'
/** 해양 예보는 시간 단위로 갱신되므로 10분 캐시면 충분하다. */
const CACHE_TTL_MS = 10 * 60 * 1000
/** 소수점 2자리 ≈ 1.1 km. 이보다 촘촘히 찍어도 예보 격자가 같다. */
const cacheKey = (lat: number, lon: number) =>
  `${CACHE_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`

function readCache(lat: number, lon: number): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon))
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry
  } catch {
    return null // 사생활 보호 모드 등에서 localStorage가 막혀도 앱은 계속 돈다
  }
}

function writeCache(lat: number, lon: number, entry: CacheEntry): void {
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify(entry))
  } catch {
    /* 용량 초과·차단 시 조용히 포기한다 */
  }
}

export function useOpenMeteo() {
  const current = reactive<CurrentWeather>({
    temperature: null,
    windSpeed: null,
    windDirection: null,
    weatherCode: null,
    surfacePressure: null,
    isDay: true,
  })

  const marine = reactive<MarineConditions>({
    waveHeight: null,
    waveDirection: null,
    wavePeriod: null,
    currentVelocity: null,
    currentDirection: null,
  })

  const status = ref<FetchStatus>('idle')
  const error = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)
  /** 마지막 성공이 지금 화면 좌표의 것인가 */
  const servedFromCache = ref(false)

  let inFlight: AbortController | null = null
  let lastRequest: { lat: number; lon: number } | null = null

  const hasMarineData = computed(
    () => marine.waveHeight !== null && Number.isFinite(marine.waveHeight),
  )

  const ageMinutes = computed(() =>
    lastUpdated.value === null ? null : Math.floor((Date.now() - lastUpdated.value) / 60000),
  )

  function applyCache(entry: CacheEntry): void {
    Object.assign(current, entry.current)
    Object.assign(marine, entry.marine)
    lastUpdated.value = entry.at
    servedFromCache.value = true
    status.value = 'cached'
  }

  async function getJson(url: string, signal: AbortSignal): Promise<Record<string, any>> {
    const res = await fetch(url, { signal })
    if (res.status === 429) throw new Error('RATE_LIMIT')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  /**
   * 예보 + 해양을 함께 가져온다.
   *
   * 둘 중 하나만 실패해도 나머지는 살린다. 해양 데이터가 없는 곳(육지·내해)은
   * 실패가 아니라 "그 좌표에 자료 없음"이므로 error로 올리지 않는다.
   */
  async function fetchAll(lat: number, lon: number): Promise<void> {
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller
    lastRequest = { lat, lon }

    status.value = 'loading'
    error.value = null

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,surface_pressure,is_day` +
      `&wind_speed_unit=ms&timezone=auto`

    const marineUrl =
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
      `&current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction` +
      `&timezone=auto`

    const [weatherRes, marineRes] = await Promise.allSettled([
      getJson(weatherUrl, controller.signal),
      getJson(marineUrl, controller.signal),
    ])

    if (controller.signal.aborted) return // 더 최신 요청이 이미 출발했다

    let weatherOk = false
    if (weatherRes.status === 'fulfilled' && weatherRes.value.current) {
      const c = weatherRes.value.current
      current.temperature = c.temperature_2m ?? null
      current.windSpeed = c.wind_speed_10m ?? null
      current.windDirection = c.wind_direction_10m ?? null
      current.weatherCode = c.weather_code ?? null
      current.surfacePressure = c.surface_pressure ?? null
      current.isDay = c.is_day === 1
      weatherOk = true
    }

    let marineOk = false
    if (marineRes.status === 'fulfilled' && marineRes.value.current) {
      const m = marineRes.value.current
      marine.waveHeight = m.wave_height ?? null
      marine.waveDirection = m.wave_direction ?? null
      marine.wavePeriod = m.wave_period ?? null
      marine.currentVelocity = m.ocean_current_velocity ?? null
      marine.currentDirection = m.ocean_current_direction ?? null
      marineOk = true
    } else if (marineRes.status === 'rejected' && marineRes.reason?.message === 'HTTP 400') {
      // 해양 격자 밖(육지 등). 오류가 아니라 자료 없음이다.
      marine.waveHeight = null
      marine.wavePeriod = null
      marineOk = true
    }

    if (weatherOk) {
      lastUpdated.value = Date.now()
      servedFromCache.value = false
      status.value = 'live'
      writeCache(lat, lon, {
        at: lastUpdated.value,
        current: { ...current },
        marine: { ...marine },
      })
      return
    }

    // 실패 — 캐시가 있으면 마지막 값을 계속 보여주고, 그 사실을 화면에 밝힌다.
    const reason =
      weatherRes.status === 'rejected'
        ? weatherRes.reason?.message === 'RATE_LIMIT'
          ? '요청 한도 초과 — 잠시 뒤 다시 시도합니다'
          : `기상 API 응답 없음 (${weatherRes.reason?.message ?? 'unknown'})`
        : '기상 API가 빈 응답을 보냈습니다'

    const cached = readCache(lat, lon)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS * 6) {
      applyCache(cached)
      error.value = `${reason} · 마지막으로 받은 값을 표시 중`
    } else {
      status.value = 'error'
      error.value = reason
    }
    void marineOk
  }

  /** 캐시가 신선하면 네트워크를 건드리지 않고 즉시 반환한다. */
  function loadFromCacheIfFresh(lat: number, lon: number): boolean {
    const cached = readCache(lat, lon)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      applyCache(cached)
      return true
    }
    return false
  }

  function retry(): void {
    if (lastRequest) void fetchAll(lastRequest.lat, lastRequest.lon)
  }

  function dispose(): void {
    inFlight?.abort()
    inFlight = null
  }

  return {
    current,
    marine,
    status: readonly(status),
    error: readonly(error),
    lastUpdated: readonly(lastUpdated),
    servedFromCache: readonly(servedFromCache),
    ageMinutes,
    hasMarineData,
    fetchAll,
    loadFromCacheIfFresh,
    retry,
    dispose,
  }
}
