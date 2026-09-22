import { z } from 'zod';

export const updateNotificationSchema = z.object({
  isRead: z.boolean(),
});
