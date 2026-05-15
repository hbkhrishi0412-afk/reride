import type { Conversation, User, Vehicle } from '../types';

jest.mock('../utils/secureRandom.js', () => ({
  randomAlphanumeric: jest.fn(() => 'testid123'),
}));

const mockSaveConversationWithSync = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/syncService.js', () => ({
  saveConversationWithSync: (...args: unknown[]) => mockSaveConversationWithSync(...args),
}));

const mockSaveConversationToSupabase = jest.fn();
jest.mock('../services/conversationService.js', () => ({
  saveConversationToSupabase: (...args: unknown[]) => mockSaveConversationToSupabase(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { openOrCreateVehicleConversation } = require('../utils/vehicleConversationFlow') as typeof import('../utils/vehicleConversationFlow');

const baseVehicle = {
  id: 42,
  sellerEmail: 'seller@example.com',
  year: 2021,
  make: 'Maruti',
  model: 'Swift',
  price: 650000,
} as Vehicle;

const baseUser = {
  name: 'Buyer',
  email: 'buyer@example.com',
  mobile: '9999999999',
  role: 'customer',
  location: 'Mumbai',
  status: 'active',
  createdAt: new Date().toISOString(),
} as User;

function makeDeps(overrides: Partial<Parameters<typeof openOrCreateVehicleConversation>[0]> = {}) {
  const setConversations = jest.fn();
  const setActiveChat = jest.fn();
  return {
    vehicle: baseVehicle,
    currentUser: baseUser,
    conversations: [] as Conversation[],
    setConversations,
    setActiveChat,
    ...overrides,
  };
}

describe('openOrCreateVehicleConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveConversationToSupabase.mockResolvedValue({ success: true, data: undefined });
    localStorage.clear();
  });

  it('returns null when sellerEmail is missing', async () => {
    const deps = makeDeps({
      vehicle: { ...baseVehicle, sellerEmail: '' } as Vehicle,
    });
    const result = await openOrCreateVehicleConversation(deps);
    expect(result).toBeNull();
    expect(deps.setActiveChat).not.toHaveBeenCalled();
  });

  it('reuses an existing thread (case-insensitive customer email)', async () => {
    const existing: Conversation = {
      id: 'conv_existing',
      customerId: 'Buyer@Example.com',
      customerName: 'Buyer',
      sellerId: 'seller@example.com',
      vehicleId: 42,
      vehicleName: '2021 Maruti Swift',
      messages: [],
      lastMessageAt: '2026-01-01T00:00:00.000Z',
      isReadBySeller: false,
      isReadByCustomer: true,
    };
    const deps = makeDeps({ conversations: [existing] });

    const result = await openOrCreateVehicleConversation(deps);

    expect(result).toBe(existing);
    expect(deps.setActiveChat).toHaveBeenCalledWith(existing);
    expect(deps.setConversations).not.toHaveBeenCalled();
    expect(mockSaveConversationToSupabase).not.toHaveBeenCalled();
    expect(localStorage.getItem('reRideActiveChat')).toContain('conv_existing');
  });

  it('creates a new conversation and persists to Supabase', async () => {
    const deps = makeDeps();

    const result = await openOrCreateVehicleConversation(deps);

    expect(result).not.toBeNull();
    expect(result!.sellerId).toBe('seller@example.com');
    expect(result!.vehicleId).toBe(42);
    expect(deps.setConversations).toHaveBeenCalled();
    expect(deps.setActiveChat).toHaveBeenCalledWith(result);
    expect(mockSaveConversationToSupabase).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'buyer@example.com',
        vehicleId: 42,
      }),
    );
    expect(mockSaveConversationWithSync).not.toHaveBeenCalled();
  });

  it('queues sync when Supabase save fails', async () => {
    mockSaveConversationToSupabase.mockResolvedValue({
      success: false,
      error: 'network',
    });
    const deps = makeDeps();

    const result = await openOrCreateVehicleConversation(deps);

    expect(result).not.toBeNull();
    expect(mockSaveConversationWithSync).toHaveBeenCalledWith(
      expect.objectContaining({ id: result!.id }),
    );
  });

  it('remaps local id when server returns a different conversation id', async () => {
    const serverConv: Conversation = {
      id: 'server_conv_uuid',
      customerId: 'buyer@example.com',
      customerName: 'Buyer',
      sellerId: 'seller@example.com',
      vehicleId: 42,
      vehicleName: '2021 Maruti Swift',
      messages: [],
      lastMessageAt: '2026-01-02T00:00:00.000Z',
      isReadBySeller: false,
      isReadByCustomer: true,
    };
    mockSaveConversationToSupabase.mockResolvedValue({
      success: true,
      data: serverConv,
    });
    const deps = makeDeps();

    const result = await openOrCreateVehicleConversation(deps);

    expect(result).toBe(serverConv);
    expect(deps.setActiveChat).toHaveBeenLastCalledWith(serverConv);
    expect(deps.setConversations).toHaveBeenCalled();
    expect(localStorage.getItem('reRideActiveChat')).toContain('server_conv_uuid');
  });
});
