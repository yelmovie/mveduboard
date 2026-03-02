export const BINGO_AI_MAX_WORD_LEN = 20;
export const BINGO_AI_MIN_WORD_LEN = 1;

export const BINGO_AI_PROMPT_SYSTEM = `당신은 초등학생용 빙고 게임 단어를 생성하는 전문가입니다.
반드시 요청된 개수만큼 정확히 생성하고, JSON 배열만 반환하세요.
추가 설명이나 마크다운 없이 순수 JSON만 출력하세요.`;

const detectLanguage = (text: string): 'ko' | 'en' => {
  const koreanChars = text.match(/[\uAC00-\uD7AF\u3131-\u3163\u1100-\u11FF]/g);
  const englishChars = text.match(/[a-zA-Z]/g);
  const koCount = koreanChars?.length || 0;
  const enCount = englishChars?.length || 0;
  if (enCount > 0 && koCount === 0) return 'en';
  return 'ko';
};

export const buildBingoAiPrompt = (topic: string, count: number) => {
  const lang = detectLanguage(topic);

  if (lang === 'en') {
    return `Topic: ${topic}
Required count: exactly ${count} items.

Generate exactly ${count} English vocabulary words/terms related to the topic above.

Rules:
1) "word" must be in English, "meaning" must be the Korean translation/explanation.
2) No duplicates.
3) Each word should be 1~4 English words (concise).
4) Suitable for elementary school students.
5) You MUST return exactly ${count} items. Not more, not less.
6) Return ONLY a JSON array. No markdown, no explanation.

Format: [{"word":"apple","meaning":"사과"}, ...]`;
  }

  return `주제: ${topic}
필요 개수: 정확히 ${count}개

위 주제와 관련된 단어/용어를 정확히 ${count}개 생성하세요.

규칙:
1) "word"에는 한글 단어/용어/이름을 넣으세요.
2) "meaning"에는 해당 단어의 간단한 설명(한글)을 넣으세요.
3) 중복 없이 모두 다른 단어여야 합니다.
4) 초등학생 수준에 적합해야 합니다.
5) 반드시 정확히 ${count}개를 생성하세요. 더 많거나 적으면 안 됩니다.
6) 순수 JSON 배열만 반환하세요. 마크다운이나 설명 없이.

형식: [{"word":"독도","meaning":"우리나라 동쪽 끝 섬"}, ...]`;
};
