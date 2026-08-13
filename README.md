<p align="center">
  <strong>S<span>K</span>ALA marine</strong>
</p>

<h1 align="center">SKALA marine — Real-time Maritime Simulation Platform</h1>

<p align="center">
  <em>Vessel.js × Open-Meteo Marine API 기반 실시간 해양 기상 선박 시뮬레이터</em>
</p>

<p align="center">
  <a href="https://skala-vue-marine.vercel.app">🌊 Live Demo</a> ·
  <a href="#architecture">📐 Architecture</a> ·
  <a href="#levels">🚢 Level System</a> ·
  <a href="#tech-stack">🛠 Tech Stack</a>
</p>

---

## 📌 프로젝트 개요

**SKALA marine**은 실시간 해양 기상 데이터와 선박 해양공학 시뮬레이션을 결합한 **풀스택 웹 애플리케이션**입니다.

사용자가 지도에서 **아무 해역이나 클릭**하면, 해당 위치의 실시간 파고·주기·조류·풍속 데이터를 Open-Meteo Marine API로 가져와서, NTNU ShipLab의 오픈소스 **Vessel.js** 라이브러리를 활용해 PX121 Platform Supply Vessel(PSV)의 **6자유도(6-DOF) 운동 응답**을 물리 기반으로 시뮬레이션합니다.

## 🎓 프로젝트의 의의

### 교육적 맥락

이 프로젝트는 **Full-stack Engineering 수업**(Vue.js 프론트엔드 프레임워크)의 **최종 과제물**을 기반으로, 수업에서 배운 Vue.js의 핵심 역량(Composition API, Composables, 컴포넌트 설계, 라우팅 등)을 활용하여 **실제 산업 도메인의 문제를 해결하는 애플리케이션**으로 확장한 결과물입니다.

### 기술적 의의

| 관점 | 의의 |
|------|------|
| **해양공학 × 웹 기술** | 전통적으로 MATLAB/Fortran으로만 수행하던 선박 운동 해석을 브라우저에서 실시간 수행 |
| **실시간 데이터 파이프라인** | Open-Meteo API → Vue Composable → postMessage → Vessel.js 엔진으로 이어지는 반응형 데이터 흐름 |
| **Multi-Level 시뮬레이션** | 단순 파도 응답(LVL1)부터 Holtrop 저항 추정(LVL4)까지 4단계 물리 모델을 하나의 UI에서 전환 |
| **Cross-Origin 3D 렌더링** | Vue 앱과 Three.js 기반 3D 엔진을 iframe + postMessage로 안전하게 분리·통신 |

### 누구에게, 어떤 가치를

- **해양공학/조선공학 학생**: 이론으로만 배우던 RAO(Response Amplitude Operator), 복원력, 풍압 경사 등의 개념을 **시각적·인터랙티브하게** 이해
- **선박 운항 관리자**: 특정 해역의 실시간 기상 조건에서 선박이 어떻게 반응하는지 사전 확인
- **풀스택 개발자**: Vue.js + Three.js + 외부 API를 결합한 실시간 데이터 시각화 아키텍처 레퍼런스

---

<h2 id="levels">🚢 Level 1~4 시뮬레이션 시스템</h2>

### Level 1 — 6-DOF Seakeeping (Ship in Regular Ocean)
> 파도 속 선박의 **Heave(상하동요)**, **Pitch(종동요)**, **Roll(횡동요)** 운동을 RAO 기반으로 계산

- Vessel.js `WaveMotion` 엔진이 파고(Hs), 주기(Tp), 파향(θw)을 입력받아 6-DOF 운동 진폭 산출
- 수직 가속도(Vertical Acceleration) 계산으로 승선감 평가

### Level 2 — Drift & Manoeuvring (Current Vector)
> 조류에 의한 **편각(Drift Angle)**, **타각 보상(Rudder Compensation)**, **횡방향 표류** 시뮬레이션

- 조류 속도(Vc)와 방향(θc)으로부터 편각 계산
- 3D 렌더링에서 선체가 실제로 **Yaw 회전**(선수 방향 변화) + 횡표류 진동

### Level 3 — Wind Heel & Stability (Wind Force)
> 풍압에 의한 **경사각(Wind Heel)** 및 **복원성(GMt)** 평가

- 풍속 → 풍압 모멘트 계산 → GMt(횡메타센트릭 높이)로 복원 모멘트 → 경사각 도출
- GMt 기반 안전 상태 판정: `SAFE` (>0.5m) / `WARNING` (>0.15m) / `CRITICAL`

### Level 4 — Added Resistance & Speed Loss (Holtrop)
> 파도에 의한 **부가 저항(ΔRaw)** 및 **속도 손실(Speed Loss %)** 추정

- Holtrop 방법론 기반 정수 저항 + 파랑 중 부가 저항 계산
- 속도 손실이 encounter frequency를 감소시켜 3D 운동 주기가 느려지는 효과

---

<h2 id="architecture">📐 시스템 아키텍처</h2>

```
┌──────────────────────────────────────────────────────────┐
│                    SKALA marine (Vue 3)                   │
│                                                          │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ PingOceanMap│  │VesselJsSimulator │  │  Telemetry  │ │
│  │  (Leaflet)  │  │  (iframe bridge) │  │    HUD      │ │
│  │             │  │                  │  │             │ │
│  │  Click ──────▶│ postMessage ──────▶│  │ ◀── Motion  │ │
│  │  → lat/lon  │  │  MARINE_API_     │  │    Data     │ │
│  │             │  │  UPDATE          │  │             │ │
│  └──────┬──────┘  └────────┬─────────┘  └─────────────┘ │
│         │                  │                             │
│         ▼                  ▼                             │
│  ┌─────────────┐  ┌──────────────────────────────────┐  │
│  │ useOpenMeteo│  │  vessel_simulation.html (iframe)  │  │
│  │ (Composable)│  │                                   │  │
│  │             │  │  Three.js r126 + Vessel.js Engine │  │
│  │ Open-Meteo ─┤  │  ┌──────────┐ ┌───────────────┐  │  │
│  │ Marine API  │  │  │ Ship3D   │ │ WaveMotion    │  │  │
│  │ Weather API │  │  │ (PX121)  │ │ 6-DOF RAO     │  │  │
│  │             │  │  └──────────┘ └───────────────┘  │  │
│  └─────────────┘  │  ┌──────────┐ ┌───────────────┐  │  │
│                   │  │ Ocean    │ │ HullResistance│  │  │
│                   │  │ (Water)  │ │ (Holtrop)     │  │  │
│                   │  └──────────┘ └───────────────┘  │  │
│                   └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   Open-Meteo APIs   │
              │  • Marine Forecast  │
              │  • Weather Current  │
              └─────────────────────┘
```

### 데이터 플로우

```
1. 사용자가 지도 클릭 → (lat, lon) 좌표 emit
2. useOpenMeteo Composable이 Marine API + Weather API 동시 fetch
3. 반응형 데이터가 VesselJsSimulator 컴포넌트로 props 전달
4. iframe 내부 vessel_simulation.html로 postMessage 전송
5. Vessel.js WaveMotion 엔진이 RAO 기반 6-DOF 운동 계산
6. LVL별 물리 모델 적용 → Three.js로 실시간 3D 렌더링
7. 계산 결과를 postMessage로 부모 Vue 앱에 역전송
8. Telemetry HUD에 실시간 수치 표시
```

---

<h2 id="tech-stack">🛠 기술 스택</h2>

| 레이어 | 기술 | 역할 |
|--------|------|------|
| **Frontend Framework** | Vue 3 (Composition API) | SPA 프레임워크, 반응형 상태 관리 |
| **Build Tool** | Vite | 번들링, HMR, 최적화 |
| **3D Engine** | Three.js r126 | WebGL 기반 3D 렌더링 (바다, 선박, 하늘) |
| **Naval Architecture** | Vessel.js (NTNU ShipLab) | 선박 모델링, 6-DOF RAO, 복원성, 저항 계산 |
| **지도** | Leaflet.js | 인터랙티브 해양 지도 (다크/위성/해양/지형) |
| **Marine Data** | Open-Meteo Marine API | 실시간 파고, 주기, 파향, 조류 |
| **Weather Data** | Open-Meteo Weather API | 실시간 풍속, 풍향 |
| **강수 레이더** | RainViewer API | 실시간 강수 타일 오버레이 |
| **Design System** | Custom CSS (SKALA marine DS) | 다크 테마, 글래스모피즘, HUD 스타일 |
| **Hosting** | Vercel | 정적 빌드 + CDN 배포 |
| **모바일 대응** | Responsive CSS (dvh, media queries) | iPhone/Android 완전 지원 |

---

## 📁 프로젝트 구조

```
skala-vue/
├── index.html                      # SPA 진입점 (PWA meta, SEO, OG tags)
├── src/
│   ├── App.vue                     # 루트 컴포넌트 (라우터 + 전환 효과)
│   ├── main.js                     # Vue 앱 초기화
│   ├── router/index.js             # Vue Router 설정
│   ├── assets/
│   │   ├── main.css                # 글로벌 리셋
│   │   └── weather-app.css         # SKALA marine 디자인 시스템
│   ├── composables/
│   │   └── useOpenMeteo.js         # Marine + Weather API 통합 Composable
│   ├── components/marine/
│   │   ├── PingOceanMap.vue        # Leaflet 해양 지도 (핑 위치 선택)
│   │   ├── VesselJsSimulator.vue   # Vessel.js 3D 시뮬레이터 브릿지
│   │   └── LiveMarineTelemetryHUD.vue  # 실시간 해양 데이터 HUD
│   └── views/
│       └── MarineDashboard.vue     # 메인 대시보드 레이아웃
├── public/
│   └── vesseljs/                   # Vessel.js 라이브러리 (NTNU ShipLab)
│       ├── source/jsm/             # 핵심 엔진 모듈
│       │   ├── 3D_engine/          # Ship3D, Hull3D, Ocean, Water, Skybox
│       │   ├── ship/               # Ship, WaveMotion, HullResistance, Stability
│       │   └── math/               # 보간, 면적/체적 계산, 벡터
│       └── examples/
│           ├── vessel_simulation.html  # 독립 3D 시뮬레이션 (iframe용)
│           └── ship_specs/PX121_dbb.json  # PX121 PSV 선박 사양
└── package.json
```

---

## 🚀 실행 방법

### 사전 요구사항
- Node.js 18+
- npm 9+

### 로컬 개발
```bash
git clone https://github.com/thanksdooss/skala-vue.git
cd skala-vue
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 프로덕션 빌드
```bash
npm run build
```

### 배포
```bash
npx vercel --prod
```

---

## 🗺 사용 방법

1. **해역 선택**: 좌측 지도에서 원하는 바다 위치를 **클릭** (핑 마커가 이동)
2. **데이터 확인**: 하단 HUD에서 실시간 파고, 주기, 조류, 풍속 등 확인
3. **3D 시뮬레이션**: 우측 패널에서 선박의 실시간 6-DOF 운동 관찰
4. **레벨 전환**: 상단 LVL 1~4 탭으로 시뮬레이션 모드 전환
5. **REFERENCE 비교**: 3D 뷰에서 REFERENCE 토글로 정수 상태 ghost와 비교
6. **지도 레이어**: 위성/해양/지형/다크 모드 + 강수 레이더 오버레이
7. **모바일 지원**: 스마트폰에서도 전체 기능 사용 가능

> ⚠️ 육지를 클릭하면 해양 데이터가 없으므로 **NO DATA** 경고가 표시되며, 해당 위치에 붉은 원이 표시됩니다.

---

## 📊 선박 제원 (PX121 PSV)

| 항목 | 값 |
|------|-----|
| 선종 | Platform Supply Vessel (PSV) |
| LOA (전장) | 82 m |
| BOA (선폭) | 18 m |
| Depth (깊이) | 8 m |
| Design Draft (설계 흘수) | 6.5 m |
| 출처 | NTNU ShipLab (노르웨이 과학기술대학교) |

---

## 📜 라이선스

이 프로젝트는 교육 목적으로 작성되었습니다.

- **Vessel.js**: MIT License — [NTNU ShipLab](https://github.com/shiplab/vesseljs)
- **Open-Meteo API**: Free for non-commercial use
- **RainViewer API**: Free tier

---

<p align="center">
  <strong>SKALA marine</strong> — Where Naval Architecture Meets Modern Web
</p>
