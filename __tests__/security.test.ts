import { hashPassword, validatePassword, generateAccessToken, verifyToken, sanitizeString, validateUserInput } from '../utils/security';
import type { User } from '../types';

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

describe('Security Utilities', () => {
  describe('Password Hashing', () => {
    it('should hash passwords securely', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[abxy]\$/);
    });

    it('should validate correct passwords', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const isValid = await validatePassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hash = await hashPassword(password);
      const isValid = await validatePassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should handle password hashing errors gracefully', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.hash.mockRejectedValueOnce(new Error('Hashing failed'));
      
      await expect(hashPassword('test')).rejects.toThrow('Password hashing failed');
    });

    it('should handle password validation errors gracefully', async () => {
      // Test with missing hash - should return false
      const result1 = await validatePassword('test', '');
      expect(result1).toBe(false);
      
      // Test with null/undefined hash - should return false
      const result2 = await validatePassword('test', null as any);
      expect(result2).toBe(false);
      
      // Test with invalid hash format - should return false (not throw)
      const result3 = await validatePassword('test', 'invalid-hash-format');
      expect(result3).toBe(false);
    });
  });

  describe('JWT Token Management', () => {
    const mockUser: User = {
      id: '123',
      email: 'test@example.com',
      role: 'customer',
      name: 'Test User',
      mobile: '1234567890',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    it('should generate valid access tokens', () => {
      const token = generateAccessToken(mockUser);
      
      expect(token).toMatch(/^token_/);
      expect(token).toContain(mockUser.id);
      expect(token).toContain(mockUser.email);
    });

    it('should verify valid tokens', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe('customer');
    });

    it('should reject invalid tokens', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid or expired token');
    });

    it('should handle token verification errors', () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Token expired');
      });
      
      expect(() => verifyToken('expired-token')).toThrow('Invalid or expired token');
    });

    it('should propagate token expired error explicitly', () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementationOnce(() => {
        const err = new Error('jwt expired');
        (err as any).name = 'TokenExpiredError';
        throw err;
      });

      expect(() => verifyToken('token_expired')).toThrow('Token has expired');
    });

    it('should include clock tolerance when verifying tokens', () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockClear();

      const token = generateAccessToken(mockUser);
      verifyToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(
        token,
        expect.anything(),
        expect.objectContaining({ clockTolerance: expect.any(Number) })
      );
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious HTML', async () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const sanitized = await sanitizeString(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello World');
    });

    it('should escape HTML entities', async () => {
      const input = 'Hello <world> & "quotes"';
      const sanitized = await sanitizeString(input);
      
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    });

    it('should handle empty strings', async () => {
      expect(await sanitizeString('')).toBe('');
    });

    it('should handle non-string inputs', async () => {
      expect(await sanitizeString(null as any)).toBe('');
      expect(await sanitizeString(undefined as any)).toBe('');
      expect(await sanitizeString(123 as any)).toBe('');
    });
  });

  describe('User Input Validation', () => {
    it('should validate correct user input', async () => {
      const validInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(validInput);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const invalidInput = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'John Doe',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid email address is required');
    });

    it('should reject weak passwords', async () => {
      const invalidInput = {
        email: 'test@example.com',
        password: '123',
        name: 'John Doe',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Password must be at least 8 characters'))).toBe(true);
    });

    it('should reject invalid mobile numbers', async () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
        mobile: '123',
        role: 'customer'
      };

      const result = await validateUserInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid 10-digit mobile number is required');
    });

    it('should reject invalid roles', async () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
        mobile: '9876543210',
        role: 'hacker'
      };

      const result = await validateUserInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Valid role') && e.includes('customer'))).toBe(true);
    });

    it('should reject short names', async () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'A',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be at least 2 characters long');
    });

    it('should reject long names', async () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'A'.repeat(101),
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be less than 100 characters');
    });

    it('should detect common weak passwords', async () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'password',
        name: 'John Doe',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common, please choose a stronger password');
    });

    it('should sanitize input data', async () => {
      const maliciousInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: '<script>alert("xss")</script>John Doe',
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(maliciousInput);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.name).not.toContain('<script>');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', async () => {
      const nullResult = await validateUserInput(null);
      const undefinedResult = await validateUserInput(undefined);
      expect(nullResult.isValid).toBe(false);
      expect(undefinedResult.isValid).toBe(false);
    });

    it('should handle empty objects', async () => {
      const result = await validateUserInput({});
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle extremely long inputs', async () => {
      const longInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'A'.repeat(1000),
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(longInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be less than 100 characters');
    });

    it('should handle special characters in names', async () => {
      const specialInput = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: "O'Connor-Smith",
        mobile: '9876543210',
        role: 'customer'
      };

      const result = await validateUserInput(specialInput);
      
      expect(result.isValid).toBe(true);
    });
  });
});
