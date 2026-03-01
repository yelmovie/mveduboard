# public 스키마 점검 및 RLS 요약

Supabase MCP가 없을 때는 **SQL Editor**에서 `supabase/sql/034_schema_inspection.sql`를 실행한 뒤, 결과를 아래 표와 비교해 누락 여부를 확인한다. 누락 시 `035_schema_supplement_no_drop.sql`로 **추가만** 보완한다 (DROP/DELETE 금지).

---

## 1) A. 테이블 목록 (기대값)

| table_name   | 주요테이블 | 비고 |
|-------------|-----------|------|
| classes     | Y         | 학급, join_code, created_by 필요 |
| post_images | Y         | 001_init |
| posts       | Y         | 001_init |
| profiles    | Y         | role, school_id, class_id, display_name 필요 |
| schools     | Y         | 001_init |
| memberships | 확인      | 있으면 사용, 없으면 무시 |
| students    | 확인      | 있으면 사용 |
| comments    | 확인      | 있으면 사용 |
| join_codes  | 확인      | 있으면 사용 (없으면 classes.join_code 사용) |

---

## 2) B. 테이블별 컬럼 (앱에서 사용하는 최소 요구)

### profiles
| column_name  | data_type   | is_nullable | 비고 |
|-------------|-------------|-------------|------|
| id         | uuid        | NO          | PK, FK → auth.users |
| role       | text        | NO          | 'teacher' \| 'student' |
| school_id  | uuid        | YES         | FK → schools |
| class_id   | uuid        | YES         | FK → classes |
| display_name | text      | NO          | |
| created_at | timestamptz | NO         | default now() |

- **권한 기준**: `profiles.role = 'teacher'` 로 교사 판단. (is_teacher 컬럼 사용 시 코드/DB 단일 기준으로 통일 필요.)

### classes
| column_name         | data_type   | is_nullable | 비고 |
|---------------------|-------------|-------------|------|
| id                  | uuid        | NO          | PK |
| school_id           | uuid        | NO          | FK → schools |
| name                | text        | NO          | |
| join_code           | text        | NO          | unique |
| join_code_created_at| timestamptz | NO         | |
| max_students        | integer     | NO          | default 30 |
| created_at          | timestamptz | NO         | |
| grade               | integer     | NO          | default 1 (032) |
| class_no            | integer     | NO          | default 1 (032) |
| **created_by**      | uuid        | YES         | FK → auth.users, 학급 생성자(teacher) |

- **학급 생성 경로**: 앱은 `created_by = auth.uid()` 로 insert. RLS에서 `classes_authenticated_insert`(authenticated 허용) 또는 teacher 정책으로 통과해야 함.

### schools
| column_name | data_type   | is_nullable | 비고 |
|------------|-------------|-------------|------|
| id         | uuid        | NO          | PK |
| name       | text        | NO          | |
| created_at | timestamptz | NO         | default now() |

---

## 3) C. RLS 활성화 여부

| tablename   | rls_enabled |
|------------|-------------|
| profiles   | true        |
| classes    | true        |
| schools    | true        |
| posts      | true        |
| post_images| true        |

---

## 4) D. RLS 정책 (기대 목록, pg_policies 조회 결과와 비교)

### profiles
| policyname               | cmd    | 역할 분리 |
|--------------------------|--------|----------|
| profiles_owner_read      | SELECT | 본인(id=auth.uid()) |
| profiles_owner_write     | INSERT | 본인만 insert (id=auth.uid()) |
| profiles_owner_update     | UPDATE | 본인만 update (032) |
| profiles_teacher_read_same_class | SELECT | teacher가 같은 class_id 조회 (002) |

- **프로필 upsert**: Google 로그인 직후 `ensureTeacherProfile`가 본인 id로 insert. `profiles_owner_write`(WITH CHECK (id = auth.uid()))로 통과해야 함.

### classes
| policyname                   | cmd   | 역할 분리 |
|-----------------------------|-------|----------|
| classes_authenticated_insert| INSERT| authenticated 전원 (학급 생성 경로, 006) |
| classes_teacher_write       | INSERT| teacher + school_id 일치 시 (002) |
| classes_teacher_read        | SELECT| teacher + school_id 일치 (002) |
| classes_student_read        | SELECT| student + class_id 일치 (002) |
| classes_teacher_update_own  | UPDATE| created_by = auth.uid() (032) |
| classes_teacher_select_own  | SELECT| created_by = auth.uid() 또는 teacher 동일 학교 (032) |

- **학급 저장**: insert는 `classes_authenticated_insert`로 통과 가능. `created_by = auth.uid()` 는 앱에서 반드시 설정.

### schools
| policyname                   | cmd   |
|-----------------------------|-------|
| schools_authenticated_select| SELECT|
| schools_authenticated_insert| INSERT|
| schools_authenticated_update| UPDATE|

---

## 5) E. 권한 플로우 검증 (SQL로 확인)

- `profiles.role` 컬럼 존재 → 위 B의 profiles 표 참고.
- `classes.created_by` (또는 teacher_id) 존재 → 위 B의 classes 표 참고.
- memberships: 있으면 “classes/users 연결” 용도로만 사용. 없으면 profiles.class_id 등으로 대체.

---

## 6) [2] 보완 SQL 요약 (035_schema_supplement_no_drop.sql)

| 적용 내용 | 변경 유형 | 비고 |
|----------|----------|------|
| profiles: role, display_name, created_at | ADD COLUMN IF NOT EXISTS | 이미 있으면 무시 |
| classes: created_by, grade, class_no, join_code_created_at, created_at | ADD COLUMN IF NOT EXISTS | |
| schools: name, created_at | ADD COLUMN IF NOT EXISTS | |
| classes.created_by → auth.users(id) FK | ADD CONSTRAINT (없을 때만) | ON DELETE SET NULL |
| RLS 활성화 (profiles, classes, schools) | ALTER ... ENABLE ROW LEVEL SECURITY | 이미 켜져 있으면 no-op |
| 정책 profiles_owner_read, _write, _update | CREATE POLICY (pg_policies에 없을 때만) | 기존 정책 덮어쓰지 않음 |
| 정책 classes_authenticated_insert, _teacher_update_own, _teacher_select_own | CREATE POLICY (없을 때만) | |
| 정책 schools_authenticated_select, _insert, _update | CREATE POLICY (없을 때만) | |

- **변경하지 않은 것**: 기존 테이블/행 삭제, 기존 정책 DROP, 기존 컬럼 삭제. memberships/students/comments/join_codes 테이블 생성은 하지 않음 (필요 시 별도 마이그레이션).

---

## 7) [3] 검증 체크리스트

1. **034 실행 후**  
   - 테이블 목록에 profiles, schools, classes, posts 존재.  
   - profiles에 role, display_name; classes에 created_by 존재.  
   - RLS 활성화 및 위 정책 목록과 일치하는지 pg_policies 결과로 확인.

2. **035 실행 후**  
   - 034의 B/C/D 쿼리 다시 실행해 컬럼·RLS·정책 추가 여부 확인.

3. **앱 검증**  
   - Google 로그인 → 대시보드 → 나의 정보 수정(학교/학급 입력) → 저장.  
   - Network에서 `/rest/v1/classes`, `/rest/v1/profiles` 요청이 2xx인지 확인.  
   - Table Editor에서 profiles에 해당 uid 행(role=teacher), classes에 새 행(created_by=uid) 생성 여부 확인.

---

## 8) 변경하지 않은 이유 (기록)

- **DROP POLICY / DROP TABLE / DELETE 사용 안 함**: 요구사항(임의 삭제 금지) 준수.
- **기존 정책 덮어쓰기 안 함**: pg_policies에 같은 policyname이 있으면 CREATE 하지 않음.
- **role CHECK 제약 추가 안 함**: 기존 데이터에 따라 제약 추가 시 실패할 수 있어, 035에서는 컬럼만 추가하고 제약은 필요 시 수동 적용.
- **memberships/students/comments/join_codes 테이블 생성 안 함**: 001_init 등 기존 마이그레이션에 없으면 별도 설계 후 추가하는 것이 안전.
