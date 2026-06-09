# Project PB v2 완료 보고

## 구현 완료
- Next.js App Router 기반 PB 앱 초기 구현
- 0~99 슬롯 번호 입력 및 이동
- 슬롯별 텍스트 저장/조회/삭제 UI
- 10분 카운트다운 및 만료 상태 UI
- Upstash Redis 저장 로직과 600초 TTL
- Vercel Blob client upload 라우트
- 5MB 파일 제한, MIME allowlist, 위험 확장자 차단
- Blob 경로 파일명 sanitize 처리
- `.env.example`, README, `.ai` 문서 세트
- Vitest validation 테스트 파일

## 주요 구조
- `src/app/page.tsx`: 홈 화면
- `src/app/slot/[id]/page.tsx`: 슬롯 화면
- `src/app/api/slot/route.ts`: 슬롯 GET/POST/DELETE
- `src/app/api/upload/route.ts`: Vercel Blob client upload token route
- `src/components/*`: 입력, 편집, 업로드, 카운트다운 UI
- `src/lib/*`: Redis, Blob, validation, slot, time 유틸
- `src/types/pb.ts`: PB 타입 정의

## API
- `GET /api/slot?id=17`: 슬롯 조회
- `POST /api/slot`: 슬롯 저장 및 TTL 600초 설정
- `DELETE /api/slot?id=17`: Redis 삭제 및 Blob cleanup 시도
- `POST /api/upload`: Blob client upload token 생성

## 파일 업로드
- Vercel Blob client upload 흐름 사용
- Function body로 파일을 직접 받지 않음
- 5MB 초과 파일 거부
- 위험 확장자 거부
- `.ipynb` 확장자 허용
- Blob path 예: `pb/slot-17/{random}-{sanitized-name}`

## 10분 만료 처리
- Redis TTL 600초가 기준
- 저장 시 `expiresAt` 갱신
- 조회 시 Redis TTL 또는 `expiresAt` 기준으로 남은 시간 반환
- UI에서 0초가 되면 만료 상태 표시
- Redis 데이터가 없으면 빈 슬롯처럼 처리

## 실행한 검증
- package.json JSON parse: pass
- 필수 파일 존재 확인: pass
- 필수 의존성 선언 확인: pass
- 위험 잔여 패턴 검색: pass

## 실행하지 못한 검증
- lint: not run
- typecheck: not run
- test: not run
- build: not run

사유: 현재 Codex Windows 환경에 `npm`/package manager가 없고, 번들 Node runtime에는 Next.js, TypeScript, Vitest 패키지가 포함되어 있지 않습니다. 의존성 설치 후 아래 명령으로 검증해야 합니다.

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

## 수동 QA 결과
- 0, 99 경계값 검증 로직 작성 완료
- -1, 100, 문자 입력 거부 로직 작성 완료
- 빈 payload 거부 로직 작성 완료
- 5MB 초과 파일 거부 로직 작성 완료
- 위험 확장자 거부 로직 작성 완료
- Blob 파일명 sanitize 로직 작성 완료

## 남은 제약
- GitHub App connector가 `https://chatgpt.com/backend-api/wham/apps` 초기화 실패로 쓰기 작업을 수행하지 못했습니다.
- 로컬 `git`/`gh` 명령도 설치되어 있지 않아 원격 레포에 직접 push하지 못했습니다.
- `jengjunseo/project-pbv2`는 GitHub API 기준 public이며 empty repository입니다.

## 다음 개선 후보
- 실제 Vercel 환경에서 Blob upload callback 확인
- Playwright 또는 브라우저 기반 E2E 추가
- 명시적인 파일 첨부 제거 버튼 추가
- 업로드 완료 후 이전 Blob cleanup 정책 세분화
