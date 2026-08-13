// Open-Meteo API 연동 (100% 무료, API 키 불필요)
// native fetch 사용 — axios 의존성 제거
import { ref, reactive } from 'vue'

export function useOpenMeteo() {
  const hourly = ref([])
  const daily = ref([])
  const airQuality = ref(null)
  const marine = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const current = reactive({
    temperature: null,
    apparentTemperature: null,
    humidity: null,
    windSpeed: null,
    windDirection: null,
    precipitation: null,
    weatherCode: null,
    uvIndex: null,
    surfacePressure: null,
    cloudCover: null,
    visibility: null,
    isDay: true,
    dewPoint: null,
    currentVisibility: null
  })

  /**
   * 48시간 시간별 예보 + 7일 일별 예보 + 현재 날씨
   */
  const fetchForecast = async (lat, lon) => {
    loading.value = true
    error.value = null
    try {
      const currentFields = 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,uv_index,surface_pressure,cloud_cover,is_day,dew_point_2m,visibility'
      const hourlyFields = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index,cloud_cover,visibility,relative_humidity_2m'
      const dailyFields = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${currentFields}&hourly=${hourlyFields}&daily=${dailyFields}&timezone=Asia%2FSeoul&forecast_days=7`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // 현재 날씨
      if (data.current) {
        current.temperature = data.current.temperature_2m
        current.apparentTemperature = data.current.apparent_temperature
        current.humidity = data.current.relative_humidity_2m
        current.windSpeed = data.current.wind_speed_10m
        current.windDirection = data.current.wind_direction_10m
        current.precipitation = data.current.precipitation
        current.weatherCode = data.current.weather_code
        current.uvIndex = data.current.uv_index
        current.surfacePressure = data.current.surface_pressure
        current.cloudCover = data.current.cloud_cover
        current.isDay = data.current.is_day === 1
        current.dewPoint = data.current.dew_point_2m
        current.currentVisibility = data.current.visibility
      }

      // 시간별 예보 (48시간)
      if (data.hourly) {
        const count = data.hourly.time.length
        const parsed = []
        for (let i = 0; i < count; i++) {
          parsed.push({
            time: data.hourly.time[i],
            temp: data.hourly.temperature_2m[i],
            apparentTemp: data.hourly.apparent_temperature[i],
            precipProb: data.hourly.precipitation_probability[i],
            precip: data.hourly.precipitation[i],
            weatherCode: data.hourly.weather_code[i],
            windSpeed: data.hourly.wind_speed_10m[i],
            uvIndex: data.hourly.uv_index[i],
            cloudCover: data.hourly.cloud_cover[i],
            visibility: data.hourly.visibility[i],
            humidity: data.hourly.relative_humidity_2m[i]
          })
        }
        hourly.value = parsed
      }

      // 7일 일별 예보
      if (data.daily) {
        const days = data.daily.time.length
        const parsed = []
        for (let i = 0; i < days; i++) {
          parsed.push({
            date: data.daily.time[i],
            weatherCode: data.daily.weather_code[i],
            tempMax: data.daily.temperature_2m_max[i],
            tempMin: data.daily.temperature_2m_min[i],
            apparentMax: data.daily.apparent_temperature_max[i],
            apparentMin: data.daily.apparent_temperature_min[i],
            sunrise: data.daily.sunrise[i],
            sunset: data.daily.sunset[i],
            uvMax: data.daily.uv_index_max[i],
            precipSum: data.daily.precipitation_sum[i],
            precipProbMax: data.daily.precipitation_probability_max[i],
            windMax: data.daily.wind_speed_10m_max[i]
          })
        }
        daily.value = parsed
      }
    } catch (e) {
      console.error('Open-Meteo fetch error:', e)
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  /**
   * 실시간 대기질 (PM2.5, PM10, AQI)
   */
  const fetchAirQuality = async (lat, lon) => {
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,us_aqi,uv_index&timezone=Asia%2FSeoul`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.current) {
        airQuality.value = {
          pm25: data.current.pm2_5,
          pm10: data.current.pm10,
          aqi: data.current.us_aqi,
          uvIndex: data.current.uv_index
        }
      }
    } catch (e) {
      console.warn('Air quality fetch error:', e)
      airQuality.value = { pm25: null, pm10: null, aqi: null, uvIndex: null }
    }
  }

  /**
   * 실시간 해양 기상 및 24시간 해양 예보 (파고, 파향, 파도주기, 해류속도, 해류방향)
   */
  const fetchMarine = async (lat, lon) => {
    try {
      const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity&timezone=Asia%2FSeoul`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      
      const hourlyMarine = []
      if (data?.hourly?.time) {
        for (let i = 0; i < data.hourly.time.length; i++) {
          hourlyMarine.push({
            time: data.hourly.time[i],
            waveHeight: data.hourly.wave_height[i],
            waveDirection: data.hourly.wave_direction[i],
            wavePeriod: data.hourly.wave_period[i],
            currentVelocity: data.hourly.ocean_current_velocity[i]
          })
        }
      }

      if (data?.current) {
        marine.value = {
          waveHeight: data.current.wave_height,
          waveDirection: data.current.wave_direction,
          wavePeriod: data.current.wave_period,
          currentVelocity: data.current.ocean_current_velocity,
          currentDirection: data.current.ocean_current_direction,
          hourly: hourlyMarine
        }
      }
    } catch (e) {
      console.warn('Marine API fetch error:', e)
      marine.value = { waveHeight: null, waveDirection: null, wavePeriod: null, currentVelocity: null, currentDirection: null, hourly: [] }
    }
  }

  /**
   * WMO 날씨 코드 → 한국어 설명 + 이모지
   */
  const getWeatherDescription = (code) => {
    const map = {
      0: { text: '맑음', icon: '☀️', bg: 'clear' },
      1: { text: '대체로 맑음', icon: '🌤️', bg: 'clear' },
      2: { text: '구름 조금', icon: '⛅', bg: 'partly' },
      3: { text: '흐림', icon: '☁️', bg: 'cloudy' },
      45: { text: '안개', icon: '🌫️', bg: 'foggy' },
      48: { text: '짙은 안개', icon: '🌫️', bg: 'foggy' },
      51: { text: '가벼운 이슬비', icon: '🌦️', bg: 'drizzle' },
      53: { text: '이슬비', icon: '🌦️', bg: 'drizzle' },
      55: { text: '강한 이슬비', icon: '🌧️', bg: 'rain' },
      61: { text: '약한 비', icon: '🌧️', bg: 'rain' },
      63: { text: '비', icon: '🌧️', bg: 'rain' },
      65: { text: '강한 비', icon: '⛈️', bg: 'heavy_rain' },
      71: { text: '약한 눈', icon: '🌨️', bg: 'snow' },
      73: { text: '눈', icon: '❄️', bg: 'snow' },
      75: { text: '폭설', icon: '❄️', bg: 'snow' },
      77: { text: '싸라기눈', icon: '🌨️', bg: 'snow' },
      80: { text: '소나기', icon: '🌦️', bg: 'rain' },
      81: { text: '강한 소나기', icon: '🌧️', bg: 'rain' },
      82: { text: '집중 호우', icon: '⛈️', bg: 'heavy_rain' },
      85: { text: '눈보라', icon: '❄️', bg: 'snow' },
      86: { text: '강한 눈보라', icon: '❄️', bg: 'snow' },
      95: { text: '뇌우', icon: '⛈️', bg: 'thunderstorm' },
      96: { text: '우박 동반 뇌우', icon: '⛈️', bg: 'thunderstorm' },
      99: { text: '강한 우박 뇌우', icon: '⛈️', bg: 'thunderstorm' }
    }
    return map[code] || { text: '알 수 없음', icon: '🌡️', bg: 'clear' }
  }

  /**
   * AQI → 한국어 등급 + 색상
   */
  const getAqiGrade = (aqi) => {
    if (aqi == null) return { grade: '측정중', color: '#94a3b8', emoji: '⏳' }
    if (aqi <= 50) return { grade: '좋음', color: '#10b981', emoji: '😊' }
    if (aqi <= 100) return { grade: '보통', color: '#f59e0b', emoji: '😐' }
    if (aqi <= 150) return { grade: '나쁨', color: '#ef4444', emoji: '😷' }
    return { grade: '매우 나쁨', color: '#dc2626', emoji: '🚨' }
  }

  /**
   * UV 지수 → 한국어 등급
   */
  const getUvGrade = (uv) => {
    if (uv == null) return { grade: '측정중', color: '#94a3b8', advice: '' }
    if (uv <= 2) return { grade: '낮음', color: '#10b981', advice: '선크림 불필요' }
    if (uv <= 5) return { grade: '보통', color: '#f59e0b', advice: '선크림 권장' }
    if (uv <= 7) return { grade: '높음', color: '#f97316', advice: '선크림 필수' }
    if (uv <= 10) return { grade: '매우 높음', color: '#ef4444', advice: '야외활동 자제' }
    return { grade: '위험', color: '#dc2626', advice: '외출 금지 권고' }
  }

  return {
    current,
    hourly,
    daily,
    airQuality,
    marine,
    loading,
    error,
    fetchForecast,
    fetchAirQuality,
    fetchMarine,
    getWeatherDescription,
    getAqiGrade,
    getUvGrade
  }
}
