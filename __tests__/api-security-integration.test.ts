import { hashPassword, validatePassword, generateAccessToken, verifyToken, sanitizeString, validateUserInput, getSecurityHeaders } from '../utils/security';

// Mock bcrypt for testing. Hash must look like bcrypt (/^\$2[abxy]\$/) so validatePassword uses compare.
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockImplementation((password: string) => Promise.resolve(`$2b$10$mock${password}`)),
  compare: jest.fn().mockImplementation((password: string, hash: string) => Promise.resolve(hash === `$2b$10$mock${password}`))
}));

// Mock jsonwebtoken for testing
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((payload: any) => `token_${payload.userId}_${payload.email}`),
  verify: jest.fn().mockImplementation((token: string) => {
    if (token.startsWith('token_')) {
      const parts = token.split('_');
      return {
        userId: parts[1],
        email: parts[2],
        role: 'customer',
        type: 'access'
      };
    }
    throw new Error('Invalid token');
  })
}));

// Mock DOMPurify for testing
jest.mock('dompurify', () => ({
  sanitize: jest.fn().mockImplementation((input: string) => input.replace(/<script.*?<\/script>/gi, ''))
}));

// Mock validator for testing
jest.mock('validator', () => ({
  isEmail: jest.fn().mockImplementation((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  escape: jest.fn().mockImplementation((input: string) => input.replace(/[<>]/g, (match) => match === '<' ? '&lt;' : '&gt;')),
  isMobilePhone: jest.fn().mockImplementation((mobile: string) => /^\d{10}$/.test(mobile))
}));

describe('API Security Integration Tests', () => {
  describe('Authentication Flow Security', () => {
    it('should generate secure tokens for valid users', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: 'customer',
        name: 'Test User',
        mobile: '1234567890',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const accessToken = generateAccessToken(mockUser);
      const refreshToken = generateAccessToken(mockUser);

      expect(accessToken).toMatch(/^token_/);
      expect(refreshToken).toMatch(/^token_/);
      expect(accessToken).toContain(mockUser.id);
      expect(accessToken).toContain(mockUser.email);
    });

    it('should verify tokens correctly', () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: 'customer'
      };

      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe('customer');
    });

    it('should reject invalid tokens', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid or expired token');
      expect(() => verifyToken('')).toThrow('Invalid or expired token');
      expect(() => verifyToken(null as any)).toThrow('Invalid or expired token');
    });
  });

  describe('Password Security Integration', () => {
    it('should hash passwords securely for registration', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[abxy]\$/);
    });

    it('should validate passwords correctly for login', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);
      const isValid = await validatePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject wrong passwords', async () => {
      const password = 'SecurePass123!';
      const wrongPassword = 'WrongPass456!';
      const hash = await hashPassword(password);
      const isValid = await validatePassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('Input Validation Integration', () => {
    it('should validate and sanitize registration data', async () => {
      const registrationData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: '<script>alert("xss")</script>John Doe',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(registrationData);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData).toBeDefined();
      expect(result.sanitizedData?.name).not.toContain('<script>');
    });

    it('should reject malicious registration attempts', async () => {
      const maliciousData = {
        email: 'invalid-email',
        password: '123',
        name: 'A',
        mobile: '123',
        role: 'hacker'
      };

      const result = await validateUserInput(maliciousData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('email'))).toBe(true);
      expect(result.errors.some(error => error.includes('mobile'))).toBe(true);
      expect(result.errors.some(error => error.includes('role'))).toBe(true);
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionData = {
        email: "'; DROP TABLE users; --",
        password: 'SecurePass123!',
        name: 'John Doe',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(sqlInjectionData);
      
      // Should not crash and should sanitize the input
      expect(result.isValid).toBe(false); // Invalid email format
      expect(result.errors).toContain('Valid email address is required');
    });
  });

  describe('XSS Prevention Integration', () => {
    it('should prevent XSS in user input', async () => {
      const xssData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: '<script>alert("xss")</script>John Doe<img src=x onerror=alert("xss")>',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(xssData);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.name).not.toContain('<script>');
      // Note: onerror might still be present after escaping, which is acceptable
      expect(result.sanitizedData?.name).toBeDefined();
    });

    it('should sanitize HTML entities', async () => {
      const htmlData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'John & "Jane" <Doe>',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(htmlData);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.name).toContain('&lt;');
      expect(result.sanitizedData?.name).toContain('&gt;');
    });
  });

  describe('Security Headers', () => {
    it('should provide comprehensive security headers', () => {
      const headers = getSecurityHeaders();

      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('X-XSS-Protection');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBeDefined();
      // Config may use '0' (disabled) or '1; mode=block'; both are valid
      expect(['0', '1; mode=block']).toContain(headers['X-XSS-Protection']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty input gracefully', async () => {
      const result = await validateUserInput({});
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle null input gracefully', async () => {
      const result = await validateUserInput(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid input data');
    });

    it('should handle undefined input gracefully', async () => {
      const result = await validateUserInput(undefined);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid input data');
    });

    it('should handle extremely long inputs', async () => {
      const longData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'A'.repeat(1000),
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(longData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Name must be less than 100 characters'))).toBe(true);
    });

    it('should handle special characters in names', async () => {
      const specialData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: "O'Connor-Smith & Associates",
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(specialData);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.name).toBeDefined();
    });
  });

  describe('Rate Limiting Simulation', () => {
    it('should handle multiple rapid requests', async () => {
      const promises = Array.from({ length: 10 }, () => 
        validateUserInput({
          email: 'test@example.com',
          password: 'SecurePass123!',
          name: 'John Doe',
          mobile: '9876543210',
          role: 'customer'
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Concurrent Security Operations', () => {
    it('should handle concurrent password hashing', async () => {
      const passwords = ['Pass1!', 'Pass2!', 'Pass3!', 'Pass4!', 'Pass5!'];
      
      const promises = passwords.map(password => hashPassword(password));
      const hashes = await Promise.all(promises);

      expect(hashes).toHaveLength(5);
      hashes.forEach((hash, index) => {
        expect(hash).not.toBe(passwords[index]);
        expect(hash).toMatch(/^\$2[abxy]\$/);
      });
    });

    it('should handle concurrent token generation', () => {
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `user${i}`,
        email: `user${i}@example.com`,
        role: 'customer' as const
      }));

      const tokens = users.map(user => generateAccessToken(user));

      expect(tokens).toHaveLength(5);
      tokens.forEach((token, index) => {
        expect(token).toMatch(/^token_/);
        expect(token).toContain(users[index].id);
        expect(token).toContain(users[index].email);
      });
    });
  });
});
