import type { Conversation } from '../types';

const CONVERSATION_STORAGE_KEY = 'reRideConversations';

/**
 * Retrieves all conversations from localStorage.
 * Optionally filters by customerId to only return conversations for a specific user.
 * @param customerEmail - Optional email to filter conversations (only show conversations for this customer)
 * @returns An array of conversations.
 */
export const getConversations = (customerEmail?: string): Conversation[] => {
  try {
    const conversationsJson = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (conversationsJson) {
      const allConversations = JSON.parse(conversationsJson);
      // Filter by customerEmail if provided
      if (customerEmail) {
        return allConversations.filter((conv: Conversation) => conv.customerId === customerEmail);
      }
      return allConversations;
    }
    
    // Only create sample conversations if the user matches the test customer email
    // This prevents new users from seeing sample data
    if (!customerEmail || customerEmail !== 'customer@test.com') {
      return [];
    }
    
    // If no conversations exist and user is the test customer, create sample conversations for testing
    const sampleConversations: Conversation[] = [
      {
        id: "conv_1703123456789",
        customerId: "customer@test.com",
        customerName: "John Doe",
        sellerId: "seller@test.com",
        vehicleId: 1,
        vehicleName: "2025 Toyota Fortuner",
        vehiclePrice: 2500000,
        messages: [
          {
            id: 1,
            sender: "user",
            text: "Hi, I'm interested in this Toyota Fortuner. Is it still available?",
            timestamp: "2024-01-15T10:30:00.000Z",
            isRead: true,
            type: "text"
          },
          {
            id: 2,
            sender: "seller",
            text: "Yes, it's still available! The vehicle is in excellent condition with only 15,000 km on the odometer.",
            timestamp: "2024-01-15T10:35:00.000Z",
            isRead: true,
            type: "text"
          },
          {
            id: 3,
            sender: "user",
            text: "That sounds great! Can I schedule a test drive?",
            timestamp: "2024-01-15T10:40:00.000Z",
            isRead: true,
            type: "text"
          },
          {
            id: 4,
            sender: "seller",
            text: "Absolutely! I can arrange a test drive for you. What time works best for you?",
            timestamp: "2024-01-15T10:45:00.000Z",
            isRead: false,
            type: "text"
          },
          {
            id: 5,
            sender: "user",
            text: "Offer: 600000",
            timestamp: "2024-01-15T11:20:00.000Z",
            isRead: false,
            type: "offer",
            payload: {
              offerPrice: 600000,
              status: "pending"
            }
          },
          {
            id: 6,
            sender: "user",
            text: "Offer: 123444",
            timestamp: "2024-01-15T11:20:00.000Z",
            isRead: false,
            type: "offer",
            payload: {
              offerPrice: 123444,
              status: "pending"
            }
          },
          {
            id: 7,
            sender: "user",
            text: "Offer: 100000",
            timestamp: "2024-01-15T11:37:00.000Z",
            isRead: false,
            type: "offer",
            payload: {
              offerPrice: 100000,
              status: "pending"
            }
          }
        ],
        lastMessageAt: "2024-01-15T11:37:00.000Z",
        isReadBySeller: false,
        isReadByCustomer: true,
        isFlagged: false
      },
      {
        id: "conv_1703123456790",
        customerId: "customer@test.com",
        customerName: "John Doe",
        sellerId: "seller@test.com",
        vehicleId: 2,
        vehicleName: "2023 Honda City",
        vehiclePrice: 1200000,
        messages: [
          {
            id: 5,
            sender: "user",
            text: "Hello, I saw your Honda City listing. What's the best price you can offer?",
            timestamp: "2024-01-14T14:20:00.000Z",
            isRead: true,
            type: "text"
          },
          {
            id: 6,
            sender: "seller",
            text: "Hi! The listed price is ₹12,00,000, but I can offer you ₹11,50,000 if you're serious about buying.",
            timestamp: "2024-01-14T14:25:00.000Z",
            isRead: true,
            type: "text"
          },
          {
            id: 7,
            sender: "user",
            text: "That's a good offer. Let me think about it and get back to you.",
            timestamp: "2024-01-14T14:30:00.000Z",
            isRead: true,
            type: "text"
          },
          {
            id: 8,
            sender: "user",
            text: "Offer: 1100000",
            timestamp: "2024-01-14T15:00:00.000Z",
            isRead: false,
            type: "offer",
            payload: {
              offerPrice: 1100000,
              status: "pending"
            }
          }
        ],
        lastMessageAt: "2024-01-14T15:00:00.000Z",
        isReadBySeller: true,
        isReadByCustomer: true,
        isFlagged: false
      }
    ];
    
    // Save sample conversations to localStorage
    saveConversations(sampleConversations);
    return sampleConversations;
  } catch (error) {
    console.error("Failed to parse conversations from localStorage", error);
    return [];
  }
};

/**
 * Saves the entire array of conversations to localStorage.
 * @param conversations The array of conversations to save.
 */
export const saveConversations = (conversations: Conversation[]) => {
  try {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error("Failed to save conversations to localStorage", error);
  }
};