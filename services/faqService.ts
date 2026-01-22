import type { FAQItem } from '../types';
import { getSupabaseClient } from '../lib/supabase.js';

const FAQ_STORAGE_KEY = 'reRideFaqs';

// Fetch FAQs from Supabase
export const fetchFaqsFromSupabase = async (): Promise<FAQItem[]> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch FAQs: ${error.message}`);
    }
    
    // Transform Supabase rows to FAQItem format
    const faqs: FAQItem[] = (data || []).map((faq: any, index: number) => {
      const faqItem: FAQItem = {
        id: faq.id || index + 1,
        question: faq.question || '',
        answer: faq.answer || '',
        category: faq.category || 'General'
      };
      return faqItem;
    });
    
    // Save to localStorage as backup (client-side only)
    if (faqs.length > 0 && typeof window !== 'undefined') {
      saveFaqs(faqs);
    }
    
    return faqs;
  } catch (error) {
    console.error('Error fetching FAQs from Supabase:', error);
    // Fallback to localStorage if Supabase fails
    const localFaqs = getFaqs();
    return localFaqs || [];
  }
};

// Alias for backward compatibility
export const fetchFaqsFromMongoDB = fetchFaqsFromSupabase;

export const getFaqs = (): FAQItem[] | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const faqsJson = localStorage.getItem(FAQ_STORAGE_KEY);
    return faqsJson ? JSON.parse(faqsJson) : null;
  } catch (error) {
    console.error("Failed to parse FAQs from localStorage", error);
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
    console.error("Failed to save FAQs to localStorage", error);
  }
};

// Save FAQ to Supabase
export const saveFaqToSupabase = async (faq: Omit<FAQItem, 'id'>): Promise<FAQItem | null> => {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('faqs')
      .insert({
        question: faq.question,
        answer: faq.answer,
        category: faq.category || 'General'
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to save FAQ: ${error.message}`);
    }
    
    if (data) {
      const savedFaq: FAQItem = {
        id: data.id,
        question: data.question || faq.question,
        answer: data.answer || faq.answer,
        category: data.category || faq.category || 'General'
      };
      return savedFaq;
    }
    return null;
  } catch (error) {
    console.error('Error saving FAQ to Supabase:', error);
    return null;
  }
};

// Alias for backward compatibility
export const saveFaqToMongoDB = saveFaqToSupabase;

// Update FAQ in Supabase
export const updateFaqInSupabase = async (faq: FAQItem): Promise<boolean> => {
  try {
    if (!faq.id) {
      throw new Error('FAQ ID is required for update');
    }
    
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('faqs')
      .update({
        question: faq.question,
        answer: faq.answer,
        category: faq.category || 'General'
      })
      .eq('id', faq.id);
    
    if (error) {
      throw new Error(`Failed to update FAQ: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating FAQ in Supabase:', error);
    return false;
  }
};

// Alias for backward compatibility
export const updateFaqInMongoDB = async (faq: FAQItem, _mongoId?: string): Promise<boolean> => {
  return updateFaqInSupabase(faq);
};

// Delete FAQ from Supabase
export const deleteFaqFromSupabase = async (faqId: number): Promise<boolean> => {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', faqId);
    
    if (error) {
      throw new Error(`Failed to delete FAQ: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting FAQ from Supabase:', error);
    return false;
  }
};

// Alias for backward compatibility
export const deleteFaqFromMongoDB = async (faqId: string | number): Promise<boolean> => {
  const id = typeof faqId === 'string' ? parseInt(faqId, 10) : faqId;
  return deleteFaqFromSupabase(id);
};