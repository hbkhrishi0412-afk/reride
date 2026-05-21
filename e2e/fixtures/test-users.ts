/** Shared credentials for local E2E (localStorage + dev-api mock users). */
export const E2E_TEST_USERS = [
  {
    id: 'test-admin-1',
    email: 'admin@test.com',
    password: 'password',
    name: 'Test Admin',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'test-seller-1',
    email: 'seller@test.com',
    password: 'password',
    name: 'Test Seller',
    role: 'seller',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'test-customer-1',
    email: 'customer@test.com',
    password: 'password',
    name: 'Test Customer',
    role: 'customer',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
] as const;
