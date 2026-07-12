import {
  parseVehicleIdentityFromBody,
  hasResolvableVehicleIdentity,
  stringToNumericVehicleId,
  buildVehicleMutationBody,
  normalizeVehicleIdentity,
  normalizeVehiclesList,
  getCanonicalPrimaryKey,
  canMutateVehicle,
  vehicleMissingCanonicalId,
  isUuidPrimaryKey,
  isHashedClientId,
  findVehicleByIdentity,
  VehicleMutationIdentityError,
  migrateVehicleListCache,
  VEHICLE_LIST_CACHE_VERSION_KEY,
  VEHICLE_LIST_CACHE_VERSION,
  generateSafeVehicleNumericId,
  isUnsafeVehicleNumericId,
} from '../utils/vehicleIdentity';

describe('vehicleIdentity', () => {
  describe('parseVehicleIdentityFromBody', () => {
    it('prefers databaseId when present', () => {
      const parsed = parseVehicleIdentityFromBody({
        vehicleId: 123,
        databaseId: 'uuid-abc-123',
      });
      expect(parsed.databaseId).toBe('uuid-abc-123');
      expect(parsed.numericId).toBe(123);
    });

    it('accepts id alias', () => {
      const parsed = parseVehicleIdentityFromBody({ id: '456' });
      expect(parsed.numericId).toBe(456);
      expect(parsed.databaseId).toBe('');
    });

    it('rejects invalid numeric ids', () => {
      const parsed = parseVehicleIdentityFromBody({ vehicleId: 'not-a-number' });
      expect(parsed.numericId).toBeUndefined();
    });
  });

  describe('hasResolvableVehicleIdentity', () => {
    it('is true with databaseId only', () => {
      expect(hasResolvableVehicleIdentity({ databaseId: 'pk-1' })).toBe(true);
    });

    it('is false with empty input', () => {
      expect(hasResolvableVehicleIdentity({})).toBe(false);
    });
  });

  describe('stringToNumericVehicleId', () => {
    it('is stable for the same UUID', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(stringToNumericVehicleId(uuid)).toBe(stringToNumericVehicleId(uuid));
    });

    it('differs for different UUIDs', () => {
      const a = stringToNumericVehicleId('uuid-a');
      const b = stringToNumericVehicleId('uuid-b');
      expect(a).not.toBe(b);
    });
  });

  describe('normalizeVehicleIdentity', () => {
    it('does not invent databaseId from numeric id alone', () => {
      const v = normalizeVehicleIdentity({ id: 17473928401234 } as any);
      expect(v.databaseId).toBeUndefined();
    });

    it('preserves UUID primary keys from API', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const v = normalizeVehicleIdentity({
        id: stringToNumericVehicleId(uuid),
        databaseId: uuid,
      } as any);
      expect(v.databaseId).toBe(uuid);
    });

    it('does not invent databaseId from hashed id alone', () => {
      const uuid = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
      const hashed = stringToNumericVehicleId(uuid);
      const v = normalizeVehicleIdentity({ id: hashed } as any);
      expect(v.databaseId).toBeUndefined();
      expect(vehicleMissingCanonicalId(v)).toBe(true);
    });
  });

  describe('isHashedClientId', () => {
    it('detects UUID-backed listings', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(
        isHashedClientId({ id: stringToNumericVehicleId(uuid), databaseId: uuid }),
      ).toBe(true);
    });
  });

  describe('getCanonicalPrimaryKey', () => {
    it('infers decimal PK for unsafe integer ids missing databaseId', () => {
      const unsafePk = '17772276006460884';
      const corruptedId = Number(unsafePk);
      expect(getCanonicalPrimaryKey({ id: corruptedId } as any)).toBe(unsafePk);
    });
  });

  describe('buildVehicleMutationBody', () => {
    it('includes databaseId when listing has one', () => {
      const body = buildVehicleMutationBody(99, [
        { id: 99, databaseId: 'real-pk-99' },
        { id: 1, databaseId: 'other' },
      ]);
      expect(body).toEqual({ vehicleId: 99, databaseId: 'real-pk-99' });
    });

    it('throws when canonical id is missing', () => {
      const uuid = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
      expect(() =>
        buildVehicleMutationBody(stringToNumericVehicleId(uuid), [{ id: stringToNumericVehicleId(uuid) }]),
      ).toThrow(VehicleMutationIdentityError);
    });

    it('includes inferred databaseId for unsafe numeric primary keys', () => {
      const unsafePk = '17772276006460884';
      const corruptedId = Number(unsafePk);
      const body = buildVehicleMutationBody(corruptedId, [{ id: corruptedId, status: 'sold' } as any]);
      expect(body).toEqual({ vehicleId: unsafePk, databaseId: unsafePk });
    });
  });

  describe('generateSafeVehicleNumericId', () => {
    it('returns a safe integer', () => {
      const id = generateSafeVehicleNumericId();
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
    });
  });

  describe('parseVehicleIdentityFromBody large ids', () => {
    it('preserves digit-string primary keys', () => {
      const parsed = parseVehicleIdentityFromBody({ vehicleId: '17772276006460884' });
      expect(parsed.databaseId).toBe('17772276006460884');
      expect(parsed.numericId).toBe(Number('17772276006460884'));
    });
  });

  describe('normalizeVehicleIdentity unsafe ids', () => {
    it('backfills databaseId for unsafe numeric ids', () => {
      const unsafePk = '17772276006460884';
      const v = normalizeVehicleIdentity({ id: Number(unsafePk) } as any);
      expect(v.databaseId).toBe(unsafePk);
      expect(isUnsafeVehicleNumericId(v.id)).toBe(true);
    });
  });

  describe('migrateVehicleListCache', () => {
    it('bumps cache schema version and clears legacy keys', () => {
      localStorage.setItem('reRideVehicles_prod', '[]');
      localStorage.setItem(VEHICLE_LIST_CACHE_VERSION_KEY, '1');
      migrateVehicleListCache();
      expect(localStorage.getItem(VEHICLE_LIST_CACHE_VERSION_KEY)).toBe(
        String(VEHICLE_LIST_CACHE_VERSION),
      );
      expect(localStorage.getItem('reRideVehicles_prod')).toBeNull();
    });
  });

  describe('normalizeVehiclesList', () => {
    it('normalizes every row', () => {
      const list = normalizeVehiclesList([
        { id: 42, databaseId: ' 42 ' } as any,
        { id: 1, databaseId: '1' } as any,
      ]);
      expect(getCanonicalPrimaryKey(list[0])).toBe('42');
      expect(canMutateVehicle(list[1])).toBe(true);
    });
  });

  describe('isUuidPrimaryKey', () => {
    it('recognizes UUIDs', () => {
      expect(isUuidPrimaryKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
      expect(isUuidPrimaryKey('17473928401234')).toBe(false);
    });
  });

  describe('findVehicleByIdentity', () => {
    it('finds by databaseId when numeric id lost precision', () => {
      const unsafePk = '17772276006460884';
      const corruptedId = Number(unsafePk);
      const list = [{ id: corruptedId, databaseId: unsafePk, make: 'Bajaj' } as any];
      const found = findVehicleByIdentity(list, corruptedId, unsafePk);
      expect(found?.make).toBe('Bajaj');
      expect(getCanonicalPrimaryKey(found!)).toBe(unsafePk);
    });
  });
});
