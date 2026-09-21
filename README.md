<h1 align="center">SKALA marine</h1>

<p align="center">
  <em>실시간 해양 기상 데이터로 선박 운동을 계산하고, <strong>그 계산을 어디까지 믿을 수 있는지 함께 표시하는</strong> 웹 시뮬레이터</em>
</p>

<p align="center">
  <a href="https://skala-vue-marine.vercel.app">라이브 데모</a> ·
  <a href="docs/validation.md"><strong>검증 문서</strong></a> ·
  <a href="docs/decisions.md">개발 결정 기록</a> ·
  <a href="#credit">무엇이 내 코드인가</a>
</p>

---

## 이 프로젝트가 다른 점

지도에서 해역을 클릭하면 Open-Meteo로 실제 파고·주기·풍속·조류를 받아, Vessel.js(NTNU ShipLab)로
PX121 Platform Supply Vessel의 거동을 계산하고 3D로 보여 준다. 여기까지는 흔한 구성이다.

이 프로젝트가 신경 쓴 것은 **화면의 모든 숫자에 "이 값을 얼마나 믿어도 되는가"를 붙이는 것**이다.

| 배지 | 뜻 |
|---|---|
| ■ 라이브러리 계산 | Vessel.js가 계산 |
| ◆ 표준 절차 | IMO IS Code 등 공개된 기준을 구현 |
| ▲ 참고용 추정값 | **내가 만든 단순화 추정식** — 오차 범위를 검증 문서에 적어 두었다 |
| ○ 화면 연출값 | 물리적 근거 없음 |

등급은 타입으로 강제되어, 새 계산을 추가하면서 등급을 빠뜨릴 수 없다.

### 검증으로 실제로 찾아낸 것

| 발견 | 내용 |
|---|---|
| 부가저항이 파고 2 m에서 뒤집힘 | Vessel.js는 Hw > 2 m에서 Kreitner를 버리고 정수저항의 20% 고정값을 쓴다. 그래서 화면에는 Hs 2.0 → 2.1 m에서 ΔRaw가 **53.6 → 17.7 kN으로 떨어지고** 그 뒤 파고와 무관해졌다. 어댑터에서 연속 적용하도록 고치고 적용범위를 표시한다. |
| 같은 화면에 부가저항이 두 개 | HUD와 3D 오버레이가 서로 다른 식을 썼다(2.35배 차이). 계산 경로를 하나로 합쳤다. |
| 풍압 경사각이 약 1/6.7 | IMO 기준풍속 26 m/s에서 내 추정식 0.31°, IMO 절차 2.05°. 수풍면적·모멘트 팔·풍압계수 세 가지가 겹쳤다. |
| 속도 손실 식은 **맞았다** | `ΔR/(3R₀)`는 일정출력 3차식의 1차 근사로, r < 1에서 차이가 0.4%p 미만이다. 틀린 것은 식이 아니라 입력이던 ΔR이었다. |
| 탭을 가리면 3D 품질이 영구 저하 | 브라우저가 가려진 탭의 rAF를 1 Hz로 낮추는데, 그걸 "저사양 기기"로 오해하고 있었다. |

자세한 표와 근거: **[docs/validation.md](docs/validation.md)**

---

<h2 id="credit">무엇이 라이브러리이고 무엇이 내 코드인가</h2>

### 라이브러리가 계산하는 것 (내가 만들지 않았다)

| 계산 | 모듈 | 출처 |
|---|---|---|
| 6자유도 운동 진폭 (heave·pitch·roll), 수직가속도 | `WaveMotion` | Vessel.js — NTNU ShipLab, MIT |
| 복원성 (GMt, KB, BMt, 배수량, 흘수) | `Ship.calculateStability` | Vessel.js |
| 정수저항 (Holtrop), 유효마력 | `HullResistance` | Vessel.js |
| 선체 형상 생성·3D 메시 | `Hull`, `Ship3D` | Vessel.js |
| 해면 렌더링·스카이박스 | `Regular_ocean`, `Water`, `Skybox` | Vessel.js 예제 |
| WebGL 렌더링 | Three.js r126 | Vessel.js 예제에 동봉된 사본 |
| 선박 사양 (PX121 PSV) | `PX121_dbb.json` | Vessel.js 예제 |
| 지도 | Leaflet | Leaflet, BSD-2 |
| 파고·주기·파향·조류·풍속 | Marine / Forecast API | Open-Meteo, CC BY 4.0 |
| 지도 타일 | World Imagery / Ocean / Topo / Dark Gray | Esri |
| 강수 레이더 타일 | RainViewer | RainViewer |

### 내가 만든 것

| 영역 | 파일 | 내용 |
|---|---|---|
| **물리 계산 레이어** | `src/physics/*.ts` | 아래 계산들을 순수 함수로 구현. 신뢰 등급 체계(`Confidence`) 설계 |
| ├ IMO 풍압 경사 | `windHeel.ts` | IS Code 2008 A/2.3 절차 구현 (◆), 수풍면적 박스 추정 (▲) |
| ├ 편류 | `drift.ts` | 속도 삼각형 (◆), 풍압 편류 (▲), 타각 (○) |
| ├ 부가저항·속도손실 | `speedLoss.ts` | Kreitner 연속 적용 (◆), 일정출력 3차식 (◆) |
| ├ 파랑 운동학 | `waves.ts` | 조우주파수, 파장, 에너지 플럭스 (◆) |
| ├ 복원성 판정 | `stability.ts` | IMO 최소 GM 기준 적용 |
| └ **Vessel.js 어댑터** | `vesseljsAdapter.ts` | 라이브러리 격리, 파고 2 m 분기 보정, 적용범위 표시 |
| 데이터 파이프라인 | `composables/useOpenMeteo.ts` | 요청 취소·캐시·오프라인 폴백·레이트리밋 처리 |
| 계산 ↔ 화면 연결 | `composables/useVesselPhysics.ts` | 단일 스냅샷 경로 |
| 화면 | `views/`, `components/` | 대시보드, 지도, 3D 브리지, HUD, **신뢰 배지**, **해역 비교 모드** |
| 3D 렌더러 구성 | `public/vesseljs/examples/vessel_simulation.html` | Vessel.js 예제를 바탕으로 재구성. **물리 계산 없음 — 부모가 준 자세를 그리기만 한다** |
| 검증 | `docs/validation.md`, `scripts/`, `tests/` | 검증 표 생성기, 단위 테스트 89개 |

**Vessel.js 원본 소스는 한 줄도 고치지 않았다.** 적용범위 밖 동작은 전부 어댑터에서 감싼다.

### 개발 이력에 대해

저장소 초기 4개 커밋(`b40ac80` → `2ae8d54`)은 **강사가 제공한 Vue 과목 템플릿**이다.
그 이후의 커밋이 내 작업이다.

---

## 구조

```
사용자가 지도를 클릭
      │
      ▼
useOpenMeteo.ts ──── Open-Meteo Marine / Forecast API
      │              (요청 취소 · 10분 캐시 · 오프라인 폴백)
      ▼
   SeaState  +  VesselHeadingState (선수방위·선속)
      │
      ▼
useVesselPhysics.ts
      │
      ▼
src/physics/computeSnapshot()  ◀── VesselAdapter ──▶ Vessel.js (public/)
      │                                              WaveMotion / HullResistance / Stability
      │  PhysicsSnapshot — 모든 값에 신뢰 등급이 붙어 있다
      │
      ├──────────────┬───────────────┬──────────────┐
      ▼              ▼               ▼              ▼
  3D 렌더러      운동 오버레이      하단 HUD      해역 비교 패널
  (iframe)       (배지 포함)       (배지 포함)    (A vs B + 주기 스윕)
```

**핵심 규칙**: Vue 컴포넌트는 Vessel.js를 직접 부르지 않는다. 화면에 뜨는 모든 수치는
`computeSnapshot()` 하나에서 나온다. 1단계 점검에서 같은 화면에 다른 값이 뜨던 문제의 구조적 해결책이다.

3D iframe은 **렌더러 전용**이다. 이전에는 이 파일 안에서 물리 계산까지 했는데,
그러면 (a) 내 코드가 MIT 벤더 디렉터리에 섞이고 (b) Vite가 처리하지 않는 경로라 테스트를 붙일 수 없었다.

---

## 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

| 명령 | 하는 일 |
|---|---|
| `npm run test:run` | 단위 테스트 89개 |
| `npm run coverage` | physics 커버리지 (현재 statements 98%) |
| `npm run typecheck` | physics·composables 타입 검사 (strict) |
| `npm run validation:report` | `docs/validation.md`의 표 재생성 |
| `npm run build` | 프로덕션 빌드 |

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | Vue 3 (Composition API), Vue Router |
| 빌드·테스트 | Vite, Vitest, TypeScript (physics·composables는 strict) |
| 3D | Three.js r126 (Vessel.js 예제 동봉본), iframe + postMessage |
| 조선공학 계산 | Vessel.js (NTNU ShipLab, MIT) |
| 지도 | Leaflet |
| 데이터 | Open-Meteo Marine / Forecast API |
| 배포 | Vercel |

### 번들

의존성을 정리하면서 실제로 쓰지 않던 라이브러리(Element Plus 전체 등록, chart.js, gsap, suncalc,
axios, canvas-confetti, vue-chartjs, three npm 패키지)를 걷어냈다.

| | 이전 | 이후 |
|---|---|---|
| JS | 1.1 MB | **280 KB** (gzip 95 KB) |
| CSS | 376 KB | **34 KB** (gzip 10 KB) |

Vessel.js와 Three.js는 `public/`에서 런타임에 불러오므로 번들에 포함되지 않는다.

## 접근성

- 확대 차단(`user-scalable=no`) 제거 — WCAG 1.4.4
- 본문 색 대비를 AA(4.5:1) 이상으로 조정 (`--text-muted` 3.68:1 → 5.45:1)
- 모든 조작 요소에 키보드 포커스 링, 상태는 색과 **글자**로 함께 표시
- `prefers-reduced-motion` 존중, 비교표에 `<caption>`·`scope` 부여

## 한계

이 도구는 **실제 운항 판단에 쓸 수 없다.** 규칙파 단일 주파수 응답이고, 수풍면적은 추정이며,
조종운동방정식을 풀지 않고, 복원성은 GM 하나만 본다.
무엇이 어디까지 유효한지는 [docs/validation.md](docs/validation.md)의 "요약" 절에 정리해 두었다.

## 라이선스·출처

- **Vessel.js** — MIT, [NTNU ShipLab](https://github.com/shiplab/vesseljs). 전문: `public/vesseljs/LICENSE`
- **Three.js** — MIT (Vessel.js 예제에 동봉된 r126 사본)
- **Leaflet** — BSD-2-Clause
- **Open-Meteo** — CC BY 4.0, 비상업 무료. 화면 하단에 출처 표기
- **Esri 지도 타일** — Esri 이용약관에 따른 출처 표기. 화면과 지도 attribution에 표시
- **RainViewer** — 무료 티어

교육·포트폴리오 목적으로 작성했다.
