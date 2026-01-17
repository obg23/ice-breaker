# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

**얼음깨기 (Ice Breaker)**는 Phaser 3와 Vite로 만들어진 캐주얼 육각형 타일 깨기 퍼즐 게임입니다. 플레이어는 인접한 3개의 육각형 타일을 회전시켜 같은 색상의 클러스터(5개 이상)를 만들어 점수와 시간 보너스를 얻으며 카운트다운 타이머와 경쟁합니다.

## 개발 명령어

```bash
# 핫 리로드가 적용된 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 빌드 미리보기
npm run preview
```

## 아키텍처

### 게임 플로우
게임은 Phaser의 씬 기반 아키텍처를 사용하며, 세 개의 주요 씬이 순차적으로 실행됩니다:

1. **BootScene** → 타일 에셋 로드 및 로딩 화면 표시
2. **GameScene** → 메인 게임플레이 루프
3. **ResultScene** → 최종 점수 및 최고 점수 표시

씬 전환: `BootScene`은 로딩 완료 후 자동으로 `GameScene`을 시작하고, `GameScene`은 시간이 다 되면 `ResultScene`을 시작합니다.

### 좌표 시스템

게임은 **pointy-top 방향**의 육각형 그리드를 위해 **축 좌표계(axial coordinate system)** (q, r)를 사용합니다. 모든 육각형 수학 유틸리티는 [src/utils/hexUtils.js](src/utils/hexUtils.js)에 있습니다:

- `axialToPixel(q, r, size)` - 그리드 좌표를 화면 픽셀로 변환
- `getNeighbors(q, r)` - 인접한 6개의 육각형 좌표 반환
- `pixelToAxial(x, y, size)` - 화면 위치를 그리드 좌표로 변환
- `hexDistance(q1, r1, q2, r2)` - 육각형 간 그리드 거리 계산

타일은 빠른 조회를 위해 `"q,r"` 형식의 키로 Map에 저장됩니다.

### 핵심 게임 메커니즘 (GameScene)

**타일 시스템:**
- 각 타일은 `hp`(현재)와 `maxHp`(1-6, 색상 결정)를 가짐
- 타일은 sprite + text를 포함하는 비주얼 컨테이너이며, `this.tiles` Map에 저장됨
- 6개의 개별 타일 이미지 로드: `tile_0`부터 `tile_5`까지 (프레임 = hp - 1)

**회전 메커니즘:**
- 클릭 시 `onTileClick(tile)`이 트리거되어 클릭된 타일 + 인접 2개 선택
- `playRotationAnimation()`은 3개 타일을 시계방향 120° 회전시키는 트윈 실행
- `applyRotationState()`는 애니메이션 후 Map 키와 타일 데이터 업데이트

**매칭 및 파괴:**
- `findMatchingClusters()`는 flood-fill BFS를 사용하여 같은 색상의 연결된 그룹 찾기
- 최소 클러스터 크기: 5개 타일 (`MIN_MATCH_COUNT`)
- `destroyMatchedTiles()`는 타일을 파괴하고, 콤보 배수가 적용된 점수 부여 및 시간 보너스 추가
- `updateBoardStateAfterMatches()`는 500ms 지연 후 빈 위치에 타일 재생성
- 연쇄 반응: 새 타일은 자동 매칭 여부를 재귀적으로 확인

**점수 시스템:**
- 기본: 파괴된 타일당 100점
- 콤보 배수: 1.0× (콤보 1-2), 1.2× (3-5), 1.4× (6+)
- 콤보 윈도우: 매칭 간 1350ms
- 시간 보너스: 클러스터 크기에 따라 +0.2-0.8초, 콤보 배수로 스케일링

**퀘스트 시스템:**
- 색상별로 30개 타일 파괴 추적 (총 6가지 색상)
- 상단 UI 바에 색상 칩으로 진행 상황 표시
- 퀘스트 완료는 체크되지만 현재 게임 종료 효과 없음

### 반응형 레이아웃 (GameScene)

게임은 `updateLayoutConfig()`에서 동적 설정으로 다양한 화면 크기에 적응합니다:

- **≤360px**: tileSize=36, gridRadius=3 (작은 폰)
- **361-480px**: tileSize=42, gridRadius=3 (중간 폰)
- **481-720px**: tileSize=51, gridRadius=4 (큰 폰/태블릿)
- **>720px**: tileSize=60, gridRadius=4 (데스크톱)

그리드 컨테이너는 종횡비를 유지하면서 사용 가능한 공간에 자동으로 스케일됩니다. 모든 UI 요소(폰트, 퀘스트 바, 터치 영역)는 `onResize()` 핸들러를 통해 반응형으로 크기 조정됩니다.

### 스케일 모드 설정

게임은 Phaser의 `FIT` 스케일 모드를 사용합니다 ([src/main.js](src/main.js:8)의 `USE_ENVELOP_SCALE` 플래그로 설정 가능):
- **FIT 모드** (기본값): 종횡비 유지, 필요시 레터박스 추가
- **ENVELOP 모드** (선택사항): 화면을 채우도록 스케일, 가장자리가 잘릴 수 있음

기본 캔버스 크기: 720×1280 (모바일용 세로 방향)

### 입력 차단

`this.isInputBlocked` 플래그는 애니메이션 중 클릭 스팸을 방지합니다. 회전 시작 시 `true`로 설정되고, 모든 애니메이션과 연쇄 반응 완료 후 `finally` 블록에서 해제됩니다.

### 깊이 정렬

타일은 z-파이팅을 방지하기 위해 계산된 깊이를 사용합니다: `depth = (r + gridRadius*2) * 1000 + (q + gridRadius*2)`. 이는 하단 행이 상단 행보다 일관되게 앞에 렌더링되도록 보장합니다.

## 파일 구조

```
src/
  main.js              - Phaser 설정, 씬 등록, 스케일 모드
  scenes/
    BootScene.js       - 진행 바가 있는 에셋 로딩
    GameScene.js       - 메인 게임 로직 및 매니저 조율 (~250 라인)
    ResultScene.js     - 점수 표시, 최고 점수 추적 (localStorage)
  managers/            - 기능별 매니저 클래스
    ParticleManager.js - 파티클 효과 생성 및 관리
    UIManager.js       - UI 요소 생성, 업데이트, 레이아웃
    ScoreManager.js    - 점수, 콤보, 타이머 관리
    MatchManager.js    - 타일 매칭 로직, 클러스터 찾기
    TileManager.js     - 타일 생성, 회전, 파괴, 재생성
  utils/
    hexUtils.js        - 육각형 그리드 수학 유틸리티
  config/
    uiConfig.js        - 색상 정의 (현재 사용 안 됨)

public/assets/
  tiles/               - 개별 타일 이미지 (tile_1.png부터 tile_6.png까지)
```

### Manager 패턴 아키텍처

게임은 Manager 패턴을 사용하여 기능별로 명확하게 분리되어 있습니다:

- **ParticleManager**: 타일 파괴 시 파티클 효과 생성
- **UIManager**: 모든 UI 요소(점수, 시간, 콤보) 관리 및 반응형 레이아웃
- **ScoreManager**: 점수 계산, 콤보 시스템, 타이머 로직
- **MatchManager**: BFS를 통한 클러스터 탐지, 시간 보너스 계산
- **TileManager**: 타일 생성/파괴/회전, 그리드 관리

GameScene은 이러한 매니저들을 조율하는 역할만 수행합니다.

## 주요 구현 세부사항

- **색상-HP 매핑**: HP 값 1-6은 `GameScene.colorDefinitions` 배열에 정의된 특정 색상에 매핑됩니다. 프레임 인덱스는 `hp - 1`입니다.
- **타이머**: `time.addEvent`를 통해 100ms 간격으로 실행되며, 각 틱마다 0.1초씩 감소합니다. 최대 시간: 90초, 시작 시간: 30초.
- **터치 처리**: 터치 영역은 타일 크기의 90% (마우스는 70%)로 모바일에서 겹치는 클릭을 방지합니다.
- **콤보 감쇠**: 매칭 간 1350ms 이상 경과하면 콤보가 리셋됩니다 (`this.lastMatchAt` 타임스탬프로 추적).
- **최고 점수**: `ice-breaker-highscore` 키로 localStorage에 저장됩니다.

## 현재 알려진 이슈

최근 git 히스토리 기반:
- 그리드 밸런스를 위해 육각형 타일 크기가 여러 번 조정됨
- 모바일의 레터박스 이슈가 스케일 모드 변경으로 해결됨
- public/assets/의 일부 텍스처 파일이 변경 중일 수 있음 (tiles3.json/tiles3.png 삭제됨)
