export function assertUserId(userId?: string): string {
  if (!userId) throw new Error('User ID is required.');
  return userId;
}
