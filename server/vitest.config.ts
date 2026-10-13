import { defineConfig } from 'vitest/config';

process.env.DATABASE_URL ??= 'mysql://booking:booking@127.0.0.1:3306/booking';
process.env.JWT_ACCESS_SECRET ??= 'test-only-access-secret-with-32-characters';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
  },
});
