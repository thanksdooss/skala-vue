/** 물리 상수와 단위 변환. 숫자 리터럴이 계산식에 흩어지지 않게 여기 모은다. */

/** 중력가속도 [m/s²] — Vessel.js 기본값과 동일하게 맞춘다 */
export const G = 9.81

/** 해수 밀도 [kg/m³] — Vessel.js 기본값과 동일 */
export const RHO_SEA = 1025

/** 공기 밀도 [kg/m³], 15 °C 해면 표준 */
export const RHO_AIR = 1.225

/** knot → m/s */
export const KNOT_TO_MS = 0.514444

/** km/h → m/s */
export const KMH_TO_MS = 1 / 3.6

export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI

/**
 * IMO 2008 IS Code, Part A 2.3 (Severe wind and rolling criterion, "weather criterion")
 * 무제한 항해구역 선박에 적용하는 풍압 [Pa].
 *
 * 같은 값을 동압으로 역산하면 0.5·ρ_air·V² = 504 Pa → V ≈ 28.7 m/s,
 * 또는 기준풍속 26 m/s 기준으로는 형상계수 약 1.22에 해당한다.
 */
export const IMO_WIND_PRESSURE_PA = 504

/** IMO weather criterion에서 돌풍(gust)을 반영하는 배수: lw2 = 1.5 × lw1 */
export const IMO_GUST_FACTOR = 1.5

/**
 * IMO 2008 IS Code, Part A 2.2.4: 초기 횡메타센터 높이 GM0 최소 기준 [m].
 * 이 값 미만은 기준 미달이므로 CRITICAL로 판정한다.
 */
export const IMO_MIN_GM = 0.15

/** 심해파 에너지 플럭스 계수 ρg²/(64π) [W/(m·m²·s)] ≈ 490.6 → kW/m 단위로 0.4906 */
export const WAVE_FLUX_COEFF_KW = (RHO_SEA * G * G) / (64 * Math.PI) / 1000
