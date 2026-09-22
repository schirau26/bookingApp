import { defineConfig } from 'vitest/config';

process.env.DATABASE_URL ??= 'mysql://booking:booking@127.0.0.1:3306/booking';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
