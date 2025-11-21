import type { FAQItem } from '../types';

const FAQ_STORAGE_KEY = 'reRideFaqs';

// Fetch FAQs from MongoDB API
export const fetchFaqsFromMongoDB = async (): Promise<FAQItem[]> => {
  try {
    const response = await fetch('/api/faqs');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch FAQs: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform MongoDB documents to FAQItem format
    // The API now returns id field, but we'll handle both cases
    // Store _id as a property for MongoDB operations
    const faqs: FAQItem[] = (data.faqs || []).map((faq: any, index: number) => {
      const faqItem: FAQItem & { _id?: string } = {
        id: faq.id || (faq._id ? parseInt(faq._id.toString().slice(-8), 16) : index + 1),
        question: faq.question || '',
        answer: faq.answer || '',
        category: faq.category || 'General'
      };
      // Store MongoDB _id for update/delete operations
      if (faq._id) {
        (faqItem as any)._id = faq._id.toString();
      }
      return faqItem;
    });
    
    // Save to localStorage as backup
    if (faqs.length > 0) {
      saveFaqs(faqs);
    }
    
    return faqs;
  } catch (error) {
    console.error('Error fetching FAQs from MongoDB:', error);
    // Fallback to localStorage if API fails
    const localFaqs = getFaqs();
    return localFaqs || [];
  }
};

export const getFaqs = (): FAQItem[] | null => {
  try {
    const faqsJson = localStorage.getItem(FAQ_STORAGE_KEY);
    return faqsJson ? JSON.parse(faqsJson) : null;
  } catch (error) {
    console.error("Failed to parse FAQs from localStorage", error);
    return null;
  }
};

export const saveFaqs = (faqs: FAQItem[]) => {
  try {
    localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(faqs));
  } catch (error) {
    console.error("Failed to save FAQs to localStorage", error);
  }
};

// Save FAQ to MongoDB
export const saveFaqToMongoDB = async (faq: Omit<FAQItem, 'id'>): Promise<FAQItem & { _id?: string } | null> => {
  try {
    const response = await fetch('/api/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(faq)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save FAQ: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.faq) {
      // Transform the MongoDB response to FAQItem format
      const savedFaq: FAQItem & { _id?: string } = {
        id: data.faq.id || (data.faq._id ? parseInt(data.faq._id.toString().slice(-8), 16) : Date.now()),
        question: data.faq.question || faq.question,
        answer: data.faq.answer || faq.answer,
        category: data.faq.category || faq.category
      };
      // Store MongoDB _id
      if (data.faq._id) {
        savedFaq._id = data.faq._id.toString();
      }
      return savedFaq;
    }
    return null;
  } catch (error) {
    console.error('Error saving FAQ to MongoDB:', error);
    return null;
  }
};

// Update FAQ in MongoDB
// Note: This requires the MongoDB _id, not the app id
// We'll need to find the FAQ by question or store _id mapping
export const updateFaqInMongoDB = async (faq: FAQItem, mongoId?: string): Promise<boolean> => {
  try {
    // If we have the MongoDB _id, use it directly
    const idToUse = mongoId || faq.id?.toString();
    
    const response = await fetch(`/api/content?type=faqs&id=${idToUse}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: faq.question,
        answer: faq.answer,
        category: faq.category
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error updating FAQ in MongoDB:', error);
    return false;
  }
};

// Delete FAQ from MongoDB
// Note: This requires the MongoDB _id, not the app id
export const deleteFaqFromMongoDB = async (mongoId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/content?type=faqs&id=${mongoId}`, {
      method: 'DELETE'
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error deleting FAQ from MongoDB:', error);
    return false;
  }
};