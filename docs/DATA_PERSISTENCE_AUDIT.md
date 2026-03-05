# 데이터 저장·유실 방지 점검 결과

## 설계 원칙
- **사용자가 삭제하기 전까지 데이터 유실 금지**
- Supabase 이중 저장 + localStorage 폴백
- 빈 데이터로 기존 데이터 덮어쓰기 금지

---

## Supabase 연동 완료 (classes 테이블 jsonb)

| 컬럼 | 서비스 | 로드 | 저장 |
|------|--------|------|------|
| `study_data` | studyService | ✓ | ✓ |
| `monthly_plan_data` | studyService | ✓ | ✓ |
| `handbook_files` | handbookFileService | ✓ | ✓ |
| `todo_data` | todoService | ✓ | ✓ |
| `roster_data` | studentService | ✓ (백업) | ✓ (이중) |
| `point_data` | pointService | ✓ | ✓ |
| `role_data` | roleService | ✓ | ✓ |
| `seat_data` | seatService | ✓ | ✓ |
| `message_data` | messageService | ✓ | ✓ |
| `meeting_data` | meetingService | ✓ | ✓ |
| `coupon_data` | couponService | ✓ | ✓ |

---

## 공통 유틸 (lib/classDataSync.ts)
- `loadWithSupabaseFallback()`: Supabase 우선 로드, 빈 데이터로 덮어쓰지 않음
- `saveClassColumn()`: 선생님만 Supabase 저장

---

## localStorage만 사용 (추후 연동 가능)
- noticeService (edu_notice_*)
- occasionService (edu_occasion_*)
- chatService (edu_chat_*)
- boardService (edu_posts_data - 게시판)
- bingoService (세션용)
- timerService, drawService, wordSearchService 등

---

## 마이그레이션
- `supabase/sql/045_classes_add_app_data_columns.sql`
- Supabase MCP로 이미 적용됨
