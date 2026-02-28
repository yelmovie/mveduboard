export const MIN_WRITING_CHARS = 300;
export const WRITING_RULES_TITLE = '주제글쓰기 안내';
export const WRITING_RULES_TEXT =
  `이번 주 주제를 잘 읽고, 내 생각을 자유롭게 써 보세요. 길게 쓰지 않아도 괜찮지만, 규칙상 내용은 띄어쓰기 포함 ${MIN_WRITING_CHARS}자 이상이어야 해요.\n` +
  '1) 제목은 주제와 어울리게 써요.\n' +
  '2) 왜 그렇게 생각했는지 한 문장 이상 적어 보세요.\n' +
  '3) 친구 글을 읽고 댓글도 꼭 한 번 남겨요.\n' +
  '[댓글 예절]\n' +
  '- 개인정보(전화번호/주소/계정)는 쓰지 않아요.\n' +
  '- 비속어, 놀리거나 상처 주는 말은 금지예요.\n' +
  '- 친구의 생각을 존중하는 댓글을 남겨요.\n' +
  '모두가 편하게 글 쓰는 공간이에요. 서로 배려하며 즐겁게 참여해요.';
export const WRITING_RULES_LS_KEY = 'edu_writing_rules_dismissed';
export const WRITING_ALL_CATEGORY = '전체';
export const WRITING_TOPIC_LS_KEY = 'edu_writing_current_topic';

export const WRITING_FALLBACK_TOPICS = [
  { id: 'fallback-1', category: '기본', topic: '어젯밤에 꾼 꿈 이야기', sort_order: 1 },
  { id: 'fallback-2', category: '기본', topic: '내가 생각하기에 가장 행복한 사람은 이런 사람이다.', sort_order: 2 },
  { id: 'fallback-3', category: '기본', topic: '천국이 있다면 어떤 모습일까?', sort_order: 3 },
  { id: 'fallback-4', category: '기본', topic: '내가 자랑하고 싶은 물건', sort_order: 4 },
  { id: 'fallback-5', category: '기본', topic: '내가 생각하는 예쁜 얼굴의 조건 (예: 쌍꺼풀은 꼭 있어야 한다!)', sort_order: 5 },
  { id: 'fallback-6', category: '기본', topic: '귀신이 실제로 있을까? 그렇게 생각하는 이유는?', sort_order: 6 },
  { id: 'fallback-7', category: '기본', topic: '내가 씨앗이라고 상상하고, 땅 속에서 일어나는 일 써보기', sort_order: 7 },
  { id: 'fallback-8', category: '기본', topic: '내가 누군가와 영혼을 바꿀 수 있다면 누구와 바꾸고 싶은가?', sort_order: 8 },
  { id: 'fallback-9', category: '기본', topic: '주말동안 있었던 화나는 일', sort_order: 9 },
  { id: 'fallback-10', category: '기본', topic: '내가 내일 죽는다면 오늘 꼭 해보고 싶은 의미 있는 일', sort_order: 10 },
  { id: 'fallback-11', category: '기본', topic: '나는 수업시간 중에 이런 딴 생각을 한 적이 있다!', sort_order: 11 },
  { id: 'fallback-12', category: '기본', topic: '스피노자: “내일 지구에 종말이 온다 하더라도 나는 오늘 한그루의 사과나무를 심겠다.” 이 말은 무슨 뜻일지 생각해보세요.', sort_order: 12 },
  { id: 'fallback-13', category: '기본', topic: '형제나 자매가 부럽게 느껴졌던 적은?', sort_order: 13 },
  { id: 'fallback-14', category: '기본', topic: '우리 집에 있는 물건 중에 내 나이보다 더 오래된 물건과 그 물건에 얽힌 사연은?', sort_order: 14 },
  { id: 'fallback-15', category: '기본', topic: '만약에 선생님이 오늘 나의 생활을 전부 보았으면 뭐라고 하셨을까?', sort_order: 15 },
  { id: 'fallback-16', category: '기본', topic: '돋보기로 보듯이 아주 자세하고 정확하게 기록하기', sort_order: 16 },
  { id: 'fallback-17', category: '기본', topic: '나의 오늘 하루를 엄마에게 편지 쓰듯이 써보기', sort_order: 17 },
  { id: 'fallback-18', category: '기본', topic: '오늘 있었던 일을 신문 기사로 써보기', sort_order: 18 },
  { id: 'fallback-19', category: '기본', topic: '나만의 걱정이나 고민을 적어보기', sort_order: 19 },
  { id: 'fallback-20', category: '기본', topic: '책을 읽고 느낀 점이나 줄거리 적기', sort_order: 20 },
  { id: 'fallback-21', category: '기본', topic: '오늘 있었던 일을 정지 화면으로 그리기', sort_order: 21 },
  { id: 'fallback-22', category: '기본', topic: '아는 단어나 쉬운 문장으로 영어로 일기 써보기', sort_order: 22 },
  { id: 'fallback-23', category: '기본', topic: '자기가 자기에게 편지 써보기 (일기장에 이름을 붙여도 좋다.)', sort_order: 23 },
  { id: 'fallback-24', category: '기본', topic: '오늘 겪은 일 중 가장 인상 깊었던 일을 자세하게 써보기', sort_order: 24 },
  { id: 'fallback-25', category: '기본', topic: '20년 후 내가 만약 나의 자식이라면 오늘 나의 행동에 대해 어떻게 생각했을까?', sort_order: 25 },
  { id: 'fallback-26', category: '기본', topic: '오늘 내가 선생님께 칭찬 받을 일이 있다면 스스로 선생님이 되어 마음껏 칭찬해보기', sort_order: 26 },
  { id: 'fallback-27', category: '기본', topic: '나의 가장 친한 친구가 되어 나의 오늘 생활 모습을 보았다면?', sort_order: 27 },
  { id: 'fallback-28', category: '기본', topic: '친구의 물건을 잃어버린 적이 있다면? 그 때의 기분과 대처방법', sort_order: 28 },
  { id: 'fallback-29', category: '기본', topic: '갑자기 당황했던 적이 있다면?', sort_order: 29 },
  { id: 'fallback-30', category: '기본', topic: '방학동안 가장 많이 변한 친구', sort_order: 30 },
  { id: 'fallback-31', category: '기본', topic: '내 생애 최고의 거짓말은?', sort_order: 31 },
  { id: 'fallback-32', category: '기본', topic: '미래에 생길 것 같은 전염병', sort_order: 32 },
  { id: 'fallback-33', category: '기본', topic: '우울함을 날리는 나만의 방법', sort_order: 33 },
  { id: 'fallback-34', category: '기본', topic: '‘가을’에 하기 좋은 것은? (독서, 운동, 다이어트, 공부 등등..)', sort_order: 34 },
  { id: 'fallback-35', category: '기본', topic: '내 안에 악마가 살고 있다고 느낄 때는 언제인가?', sort_order: 35 },
  { id: 'fallback-36', category: '기본', topic: '가족 중 한 사람의 입장이 되어, 나에 대한 관찰일기 쓰기', sort_order: 36 },
  { id: 'fallback-37', category: '기본', topic: '시간을 멈추고 싶은 순간이 있다면?', sort_order: 37 },
  { id: 'fallback-38', category: '기본', topic: '내가 공룡이라면 어떤 공룡이었을지 묘사하여 보자.', sort_order: 38 },
  { id: 'fallback-39', category: '기본', topic: '이 세상에 없을 것 같은 음식 재료는 무엇일까?', sort_order: 39 },
  { id: 'fallback-40', category: '기본', topic: '내가 살고 싶은 집을 상상해서 소개하기', sort_order: 40 },
  { id: 'fallback-41', category: '기본', topic: '내 삶의 가장 충격적인 장면', sort_order: 41 },
  { id: 'fallback-42', category: '기본', topic: '배고플 때 가장 생각나는 음식', sort_order: 42 },
  { id: 'fallback-43', category: '기본', topic: '배우고 싶은 악기가 있다면?', sort_order: 43 },
  { id: 'fallback-44', category: '기본', topic: '나에게 스트레스를 주는 것이 무엇인지, 스트레스의 원인은 무엇인지, 그 스트레스를 해결할 방법은 무엇인지 쓰기', sort_order: 44 },
  { id: 'fallback-45', category: '기본', topic: '요 근래에 가장 통쾌했던 순간', sort_order: 45 },
  { id: 'fallback-46', category: '기본', topic: '내가 가장 싫어하는 냄새', sort_order: 46 },
  { id: 'fallback-47', category: '기본', topic: '새치기를 당한 경험과 그때의 내 기분', sort_order: 47 },
  { id: 'fallback-48', category: '기본', topic: '내가 좋아하는 계절', sort_order: 48 },
  { id: 'fallback-49', category: '기본', topic: '내가 응원하는 스포츠 팀이 있다면? (종목 상관없음)', sort_order: 49 },
  { id: 'fallback-50', category: '기본', topic: '내가 조사한 지역의 사투리를 이용하여 일기 쓰기', sort_order: 50 },
  { id: 'fallback-51', category: '기본', topic: '내가 제일 싫어하는 소리는? (예를 들어 칠판 긁는 소리)', sort_order: 51 },
  { id: 'fallback-52', category: '기본', topic: '싸우고 나서 화해하는 방법은?', sort_order: 52 },
  { id: 'fallback-53', category: '기본', topic: '자아도취에 빠진 적이 있나요?', sort_order: 53 },
  { id: 'fallback-54', category: '기본', topic: '스스로 고치고 싶은 부분이 있다면?', sort_order: 54 },
  { id: 'fallback-55', category: '기본', topic: '우리반 뉴스~! 요즘 가장 유행하는 것은?', sort_order: 55 },
  { id: 'fallback-56', category: '기본', topic: '살면서 가장 서럽게 울었던 일을 써 보세요.', sort_order: 56 },
  { id: 'fallback-57', category: '기본', topic: '친구와 가까워지는 나만의 노하우', sort_order: 57 },
  { id: 'fallback-58', category: '기본', topic: '타임캡슐에 넣고 싶은 물건은?', sort_order: 58 },
  { id: 'fallback-59', category: '기본', topic: '행복한 학교를 만드는 방법은?', sort_order: 59 },
  { id: 'fallback-60', category: '기본', topic: '나의 마음을 다치게 했던 다른 사람의 말과 행동', sort_order: 60 },
  { id: 'fallback-61', category: '기본', topic: '나의 태몽 또는 태명은 무엇인가?', sort_order: 61 },
  { id: 'fallback-62', category: '기본', topic: '가장 좋아하는 케이크의 종류는?', sort_order: 62 },
  { id: 'fallback-63', category: '기본', topic: '길거리에서 꼴불견인 행동', sort_order: 63 },
  { id: 'fallback-64', category: '기본', topic: '남들이 믿지 않아 억울했던 적', sort_order: 64 },
  { id: 'fallback-65', category: '기본', topic: '양심의 가책을 느낀 적이 있다면?', sort_order: 65 },
  { id: 'fallback-66', category: '기본', topic: '내가 정말 참기 힘든 것!', sort_order: 66 },
  { id: 'fallback-67', category: '기본', topic: '쉬는 시간에 주로 하는 놀이는?', sort_order: 67 },
  { id: 'fallback-68', category: '기본', topic: '승부욕에 불타오르는 순간이 있다면', sort_order: 68 },
  { id: 'fallback-69', category: '기본', topic: '나는 ㅇㅇ없이는 못산다!', sort_order: 69 },
  { id: 'fallback-70', category: '기본', topic: '초등학교 시절 중 가장 기억에 남는 짝꿍', sort_order: 70 },
  { id: 'fallback-71', category: '기본', topic: '여름 더위와 겨울 추위 중 더 견디기 힘든 것은?', sort_order: 71 },
  { id: 'fallback-72', category: '기본', topic: '하기 싫은 데 억지로 하고 있는 것이 있다면? (예: 우유 먹기)', sort_order: 72 },
  { id: 'fallback-73', category: '기본', topic: '살면서 저지른 잘못들을 용서를 구해보자.', sort_order: 73 },
  { id: 'fallback-74', category: '기본', topic: '잠들기 전에 하는 생각', sort_order: 74 },
  { id: 'fallback-75', category: '기본', topic: '내가 도저히 혼자할 수 없는 것은?', sort_order: 75 },
  { id: 'fallback-76', category: '기본', topic: '나도 모르게 나오는 특이한 행동이나 습관은?', sort_order: 76 },
  { id: 'fallback-77', category: '기본', topic: '닮고 싶은 친구가 있다면 누구? 어떤 면을 닮고 싶은가?', sort_order: 77 },
  { id: 'fallback-78', category: '기본', topic: '몰랐던 사실을 알고 나서 신기해했던 경험은?', sort_order: 78 },
  { id: 'fallback-79', category: '기본', topic: '외계인이 있다면 어떻게 생겼으며, 어디에서 무엇을 먹고 살까?', sort_order: 79 },
  { id: 'fallback-80', category: '기본', topic: '나를 화나게 하는 친구의 행동', sort_order: 80 },
  { id: 'fallback-81', category: '기본', topic: '아주 사소한 것에 기뻤던 적이 있나요?', sort_order: 81 },
  { id: 'fallback-82', category: '기본', topic: '내가 일제강점기에 태어났다면 나는 독립투사가 될 수 있었을까?', sort_order: 82 },
  { id: 'fallback-83', category: '기본', topic: '가장 기억에 남는 선생님', sort_order: 83 },
  { id: 'fallback-84', category: '기본', topic: '일 년 동안 내가 발전한 부분, 그리고 앞으로 발전하고 싶은 부분은?', sort_order: 84 },
  { id: 'fallback-85', category: '기본', topic: '선생님께 편지 써보기', sort_order: 85 },
  { id: 'fallback-86', category: '기본', topic: '상상한 내용을 줄거리로 만들어 보기', sort_order: 86 },
  { id: 'fallback-87', category: '기본', topic: '여러분이 좋아하는 설 음식은?', sort_order: 87 },
  { id: 'fallback-88', category: '기본', topic: '스파이 일기 쓰기 - 한 친구의 하루 일과를 관찰하여 일기 쓰기', sort_order: 88 },
  { id: 'fallback-89', category: '기본', topic: '날씨로 일기 써보기', sort_order: 89 },
  { id: 'fallback-90', category: '기본', topic: '신문 광고의 장면을 오려 내고 말 주머니에 일기 쓰기', sort_order: 90 },
  { id: 'fallback-91', category: '기본', topic: '아는 한자를 이용하여 한자로 일기 써보기', sort_order: 91 },
  { id: 'fallback-92', category: '기본', topic: '내가 투명인간이 된다면?', sort_order: 92 },
  { id: 'fallback-93', category: '기본', topic: '만약 아침에 일어나니 내 키가 2m가 되었다면?', sort_order: 93 },
  { id: 'fallback-94', category: '기본', topic: '타임머신을 타고 가고 싶은 곳은?', sort_order: 94 },
  { id: 'fallback-95', category: '기본', topic: '내가 동물과 이야기 할 수 있다면?', sort_order: 95 },
  { id: 'fallback-96', category: '기본', topic: '이런 어른들은 정말 싫어요.', sort_order: 96 },
  { id: 'fallback-97', category: '기본', topic: '우리 학교를 새로 짓는다면 어떻게 짓는 것이 좋을까?', sort_order: 97 },
  { id: 'fallback-98', category: '기본', topic: '겨울을 따뜻하게 보내는 방법', sort_order: 98 },
  { id: 'fallback-99', category: '기본', topic: '나만의 징크스가 있다면?', sort_order: 99 },
];

export const MIN_LEARNING_NOTE_CHARS = 250;
export const LEARNING_NOTE_RULES_TITLE = '배움노트 쓰기 안내';
export const LEARNING_NOTE_RULES_TEXT =
  '배움노트는 오늘 수업에서 배운 내용을\n내 생각과 함께 정리하는 글입니다.\n\n' +
  '아래 규칙을 꼭 지켜서 작성해주세요 😊\n\n' +
  '[필수 규칙]\n' +
  '1. 띄어쓰기 포함 최소 250자 이상 작성\n' +
  '2. 아래 3가지 내용이 모두 들어가야 합니다\n' +
  '   - 오늘 배운 핵심 내용\n' +
  '   - 기억에 남는 점 또는 새로 알게 된 것\n' +
  '   - 내 생각이나 느낀 점\n' +
  '3. 의미 없는 문장 반복, 수업과 관계없는 내용은 안 됩니다\n' +
  '4. 친구를 놀리거나 기분 상하게 하는 말은 사용할 수 없습니다\n\n' +
  '[안내 문구]\n' +
  '배움노트에는 정답이 없습니다.\n' +
  '내가 이해한 만큼 솔직하게 쓰는 것이 가장 중요합니다.';
export const LEARNING_NOTE_RULES_LS_KEY = 'learning_note_guide_seen';
export const LEARNING_NOTE_HINT =
  '배운 내용이나 느낀 점이 잘 보이지 않아요.\n조금만 더 자세히 써볼까요?';
export const LEARNING_NOTE_KEYWORDS = [
  '배웠다',
  '알게 되었다',
  '기억에 남는다',
  '느꼈다',
  '생각했다',
  '궁금하다',
];

export const MIN_READING_LOG_CHARS = 200;
export const READING_LOG_RULES_TITLE = '독서록 쓰기 안내';
export const READING_LOG_RULES_TEXT =
  `독서록은 책을 읽고 난 뒤\n내용을 정리하고 내 생각을 쓰는 글입니다.\n\n` +
  '아래 규칙을 지켜서 작성해주세요 😊\n\n' +
  '[필수 규칙]\n' +
  `1. 띄어쓰기 포함 최소 ${MIN_READING_LOG_CHARS}자 이상 작성\n` +
  '2. 아래 4가지 내용이 모두 들어가야 합니다\n' +
  '   - 책 제목\n' +
  '   - 기억에 남는 장면이나 내용\n' +
  '   - 인상 깊었던 이유\n' +
  '   - 읽고 난 뒤 내 생각 또는 느낀 점\n' +
  '3. 줄거리만 쓰거나 한 줄 감상은 안 됩니다\n' +
  '4. 책과 관계없는 이야기, 의미 없는 문장 반복은 안 됩니다\n' +
  '5. 친구를 놀리거나 불쾌감을 주는 표현은 사용할 수 없습니다\n\n' +
  '[안내 문구]\n' +
  '독서록에는 정답이 없습니다.\n' +
  '책을 읽고 내가 느낀 점을 솔직하게 쓰면 됩니다.';
export const READING_LOG_RULES_LS_KEY = 'reading_log_guide_seen';
export const READING_LOG_HINT =
  '책 내용이나 느낀 점이 조금 더 있으면 좋아요.\n조금만 더 써볼까요?';
export const READING_LOG_KEYWORDS = [
  '책 제목',
  '인상 깊었다',
  '기억에 남는다',
  '느꼈다',
  '생각했다',
  '배웠다',
  '추천하고 싶다',
  '궁금해졌다',
];
