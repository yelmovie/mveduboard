import { supabase } from './client';

export type WritingTopic = {
  id: string;
  category: string;
  topic: string;
  sort_order: number;
};

export const getWritingTopics = async (): Promise<{
  topics: WritingTopic[];
  errorCode?: string;
}> => {
  if (!supabase) return { topics: [], errorCode: 'not_configured' };
  const { data, error } = await supabase
    .from('writing_topics')
    .select('id, category, topic, sort_order')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[getWritingTopics] failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return { topics: [], errorCode: error.code };
  }
  return { topics: (data || []) as WritingTopic[] };
};

export const createWritingTopic = async (
  category: string,
  topic: string,
  sortOrder = 9999
): Promise<WritingTopic | null> => {
  if (!supabase) return null;
  const trimmed = topic.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('writing_topics')
    .insert({ category, topic: trimmed, sort_order: sortOrder, is_active: true })
    .select('id, category, topic, sort_order')
    .maybeSingle();
  if (error) {
    console.error('[createWritingTopic] failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }
  return data as WritingTopic | null;
};

export const getWritingCategories = async (): Promise<{
  categories: string[];
  errorCode?: string;
}> => {
  if (!supabase) return { categories: [], errorCode: 'not_configured' };
  const { data, error } = await supabase
    .from('writing_topics')
    .select('category')
    .eq('is_active', true);

  if (error) {
    console.error('[getWritingCategories] failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return { categories: [], errorCode: error.code };
  }

  const categories = Array.from(
    new Set((data || []).map((row) => row.category).filter(Boolean))
  );
  return { categories };
};
