import type { FAQItem } from '../types.js';
import { DEFAULT_PLATFORM_FAQS } from '../constants/defaultFaqs.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { authenticatedFetch } from '../utils/authenticatedFetch.js';
import { faqIdQueryParam, normalizeFaqRow, sortFaqs } from '../utils/faqNormalize.js';

const FAQ_STORAGE_KEY = 'reRideFaqs';

export const fetchFaqsFromSupabase = async (): Promise<FAQItem[]> => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('faqs')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch FAQs: ${error.message}`);
    }

    const faqs: FAQItem[] = sortFaqs(
      (data || []).map((row, index) =>
        normalizeFaqRow(row as Record<string, unknown>, index),
      ),
    );

    if (faqs.length > 0 && typeof window !== 'undefined') {
      saveFaqs(faqs);
    }

    return faqs.length > 0 ? faqs : DEFAULT_PLATFORM_FAQS;
  } catch (error) {
    console.error('Error fetching FAQs from Supabase:', error);
    const localFaqs = getFaqs();
    return localFaqs?.length ? sortFaqs(localFaqs) : DEFAULT_PLATFORM_FAQS;
  }
};

export const fetchFaqsFromMongoDB = fetchFaqsFromSupabase;

export const getFaqs = (): FAQItem[] | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const faqsJson = localStorage.getItem(FAQ_STORAGE_KEY);
    return faqsJson ? JSON.parse(faqsJson) : null;
  } catch (error) {
    console.error('Failed to parse FAQs from localStorage', error);
    return null;
  }
};

export const saveFaqs = (faqs: FAQItem[]) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(faqs));
  } catch (error) {
    console.error('Failed to save FAQs to localStorage', error);
  }
};

/** Admin mutations go through the API (service role) — anon client only has SELECT on faqs. */
export const saveFaqToSupabase = async (faq: Omit<FAQItem, 'id'>): Promise<FAQItem | null> => {
  try {
    const resp = await authenticatedFetch('/api/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(faq),
    });
    if (!resp.ok) {
      throw new Error(`Failed to save FAQ (${resp.status})`);
    }
    const body = await resp.json();
    const row = body?.faq as Record<string, unknown> | undefined;
    return row ? normalizeFaqRow(row) : null;
  } catch (error) {
    console.error('Error saving FAQ:', error);
    return null;
  }
};

export const saveFaqToMongoDB = saveFaqToSupabase;

export const updateFaqInSupabase = async (faq: FAQItem): Promise<boolean> => {
  try {
    if (faq.id == null || faq.id === '') {
      throw new Error('FAQ ID is required for update');
    }
    const resp = await authenticatedFetch(`/api/faqs?id=${faqIdQueryParam(faq.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: faq.question,
        answer: faq.answer,
        category: faq.category || 'General',
      }),
    });
    return resp.ok;
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return false;
  }
};

export const updateFaqInMongoDB = async (faq: FAQItem, _mongoId?: string): Promise<boolean> =>
  updateFaqInSupabase(faq);

export const deleteFaqFromSupabase = async (faqId: FAQItem['id']): Promise<boolean> => {
  try {
    const resp = await authenticatedFetch(`/api/faqs?id=${faqIdQueryParam(faqId)}`, {
      method: 'DELETE',
    });
    return resp.ok;
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return false;
  }
};

export const deleteFaqFromMongoDB = async (faqId: string | number): Promise<boolean> =>
  deleteFaqFromSupabase(faqId);
