import { z } from 'zod';

export const trackViewBodySchema = z.object({
  vehicleId: z.union([z.number(), z.string()]).optional(),
  databaseId: z.string().optional(),
  viewToken: z.string().min(1),
});

export const supportChatPostSchema = z.object({
  message: z.string().min(1).max(2000),
  userId: z.string().optional(),
  userName: z.string().max(120).optional(),
  sessionId: z.string().optional(),
});

export const supportChatHistoryQuerySchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const loginBodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
  role: z.enum(['customer', 'seller', 'admin', 'service_provider']).optional(),
});

export const registerBodySchema = z.object({
  action: z.literal('register').optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  mobile: z.string().min(10).max(15),
  role: z.enum(['customer', 'seller', 'service_provider']).default('customer'),
});
