import type { SupportTicket } from '../types';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

const SUPPORT_TICKET_STORAGE_KEY = 'reRideSupportTickets';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const getSupportTickets = (): SupportTicket[] | null => {
  try {
    const ticketsJson = localStorage.getItem(SUPPORT_TICKET_STORAGE_KEY);
    return ticketsJson ? JSON.parse(ticketsJson) : null;
  } catch (error) {
    console.error("Failed to parse support tickets from localStorage", error);
    return null;
  }
};

export const saveSupportTickets = (tickets: SupportTicket[]) => {
  try {
    localStorage.setItem(SUPPORT_TICKET_STORAGE_KEY, JSON.stringify(tickets));
  } catch (error) {
    console.error("Failed to save support tickets to localStorage", error);
  }
};

const toNumericTicketId = (id: unknown): number => {
  if (typeof id === 'number') return id;
  if (typeof id === 'string') {
    const digits = id.match(/\d+/g)?.join('');
    if (digits) return Number(digits);
  }
  return Date.now();
};

const normalizeTicket = (ticket: any): SupportTicket => {
  return {
    id: toNumericTicketId(ticket?.id),
    userEmail: ticket?.userEmail || '',
    userName: ticket?.userName || '',
    subject: ticket?.subject || '',
    message: ticket?.message || '',
    status: (ticket?.status || 'Open') as SupportTicket['status'],
    createdAt: ticket?.createdAt || new Date().toISOString(),
    updatedAt: ticket?.updatedAt || new Date().toISOString(),
    replies: Array.isArray(ticket?.replies) ? ticket.replies : []
  };
};

export const fetchSupportTicketsFromSupabase = async (
  userEmail?: string,
  status?: SupportTicket['status']
): Promise<SupportTicket[]> => {
  try {
    const params = new URLSearchParams();
    if (userEmail) params.append('userEmail', userEmail);
    if (status) params.append('status', status);

    const query = params.toString();
    const url = query ? `${API_BASE_URL}/support-tickets?${query}` : `${API_BASE_URL}/support-tickets`;

    const response = await authenticatedFetch(url, { method: 'GET' });
    const parsed = await handleApiResponse<{ tickets?: any[] }>(response);
    if (!parsed.success) {
      throw new Error(parsed.reason || parsed.error || 'Failed to fetch support tickets');
    }

    const tickets = (parsed.data?.tickets || []).map(normalizeTicket);
    saveSupportTickets(tickets);
    return tickets;
  } catch (error) {
    console.warn('Failed to fetch support tickets from API, using local fallback:', error);
    return getSupportTickets() || [];
  }
};

export const createSupportTicketInSupabase = async (
  ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'replies' | 'status'>
): Promise<SupportTicket | null> => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/support-tickets`, {
      method: 'POST',
      body: JSON.stringify(ticket)
    });
    const parsed = await handleApiResponse<{ ticket?: any }>(response);
    if (!parsed.success || !parsed.data?.ticket) {
      throw new Error(parsed.reason || parsed.error || 'Failed to create support ticket');
    }
    return normalizeTicket(parsed.data.ticket);
  } catch (error) {
    console.error('Failed to create support ticket in API:', error);
    return null;
  }
};

export const updateSupportTicketInSupabase = async (
  ticket: SupportTicket
): Promise<boolean> => {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/support-tickets?id=${encodeURIComponent(String(ticket.id))}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          status: ticket.status,
          subject: ticket.subject,
          message: ticket.message,
          replies: ticket.replies
        })
      }
    );
    const parsed = await handleApiResponse(response);
    return parsed.success;
  } catch (error) {
    console.error('Failed to update support ticket in API:', error);
    return false;
  }
};