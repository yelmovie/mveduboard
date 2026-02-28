export const BINGO_AI_MAX_WORD_LEN = 12;
export const BINGO_AI_MIN_WORD_LEN = 3;

export const BINGO_AI_PROMPT_SYSTEM =
  'You generate vocabulary pairs for kids study. Return strict JSON only.';

export const buildBingoAiPrompt = (topic: string, count: number) => `
Topic: ${topic}
Count: ${count}
Output JSON array of objects with keys word, meaning (Korean).
Rules:
1) English word only for "word", Korean only for "meaning".
2) Avoid duplicates.
3) Keep words concise (3~12 chars).
4) Return JSON only. No extra text.
`;
