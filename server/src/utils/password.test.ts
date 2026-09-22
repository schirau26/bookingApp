import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('stores a hash that verifies only the original password', async () => {
    const passwordHash = await hashPassword('Password1!');

    expect(passwordHash).not.toContain('Password1!');
    expect(await verifyPassword('Password1!', passwordHash)).toBe(true);
    expect(await verifyPassword('password1!', passwordHash)).toBe(false);
  });
});
