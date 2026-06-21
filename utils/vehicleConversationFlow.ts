import type { Dispatch, SetStateAction } from 'react';
import type { Conversation, User, Vehicle } from '../types.js';
import { randomAlphanumeric } from './secureRandom.js';
import { logError, logInfo, logWarn } from './logger.js';
import { saveConversationToSupabase } from '../services/conversationService.js';
import { saveConversationWithSync } from '../services/syncService.js';

export type OpenVehicleConversationDeps = {
  vehicle: Vehicle;
  currentUser: User;
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setActiveChat: (conv: Conversation | null) => void;
  /** When false, find/create the thread without opening the floating chat UI. */
  openChat?: boolean;
};

/** Find or create a buyer↔seller chat for a listing. Returns null if seller email is missing. */
export async function openOrCreateVehicleConversation(
  deps: OpenVehicleConversationDeps,
): Promise<Conversation | null> {
  const { vehicle, currentUser, conversations, setConversations, setActiveChat, openChat = true } = deps;

  if (!vehicle.sellerEmail) {
    logError('Cannot open chat: vehicle.sellerEmail is missing', { vehicleId: vehicle.id });
    return null;
  }

  const normalizedCustomerEmail = currentUser.email?.toLowerCase().trim() ?? '';
  let conversation = normalizedCustomerEmail
    ? conversations.find(
        (c) =>
          c?.customerId &&
          c.vehicleId === vehicle.id &&
          c.customerId.toLowerCase().trim() === normalizedCustomerEmail,
      )
    : undefined;

  if (conversation) {
    if (openChat) {
      setActiveChat(conversation);
      try {
        localStorage.setItem(
          'reRideActiveChat',
          JSON.stringify({ id: conversation.id, updatedAt: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    }
    return conversation;
  }

  const normalizedSellerId = vehicle.sellerEmail.toLowerCase().trim();
  if (!normalizedSellerId) return null;

  const newConversation: Conversation = {
    id: `conv_${Date.now()}_${randomAlphanumeric(9)}`,
    customerId: currentUser.email,
    customerName: currentUser.name || 'Customer',
    sellerId: normalizedSellerId,
    vehicleId: vehicle.id,
    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehiclePrice: vehicle.price,
    messages: [],
    lastMessageAt: new Date().toISOString(),
    isReadBySeller: false,
    isReadByCustomer: true,
    isFlagged: false,
  };

  setConversations((prev) => [...prev, newConversation]);
  if (openChat) {
    setActiveChat(newConversation);
    try {
      localStorage.setItem(
        'reRideActiveChat',
        JSON.stringify({ id: newConversation.id, updatedAt: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }

  try {
    const saveResult = await saveConversationToSupabase(newConversation);
    if (!saveResult.success) {
      logWarn('Direct conversation save failed, using sync queue:', saveResult.error);
      await saveConversationWithSync(newConversation);
    } else if (saveResult.data && saveResult.data.id !== newConversation.id) {
      const serverConv = saveResult.data;
      setConversations((prev) => prev.map((c) => (c.id === newConversation.id ? serverConv : c)));
      if (openChat) {
        setActiveChat(serverConv);
        try {
          localStorage.setItem(
            'reRideActiveChat',
            JSON.stringify({ id: serverConv.id, updatedAt: Date.now() }),
          );
        } catch {
          /* ignore */
        }
      }
      return serverConv;
    }
  } catch (error) {
    logError('Failed to save conversation:', error);
    await saveConversationWithSync(newConversation);
  }

  if (process.env.NODE_ENV === 'development') {
    logInfo('Created vehicle conversation:', newConversation.id);
  }

  return newConversation;
}
