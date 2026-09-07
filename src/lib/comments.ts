export const COMMENTS_CONFIG = {
  workerUrl: 'https://comments-worker.javiercorderotoscano.workers.dev',
} as const;

export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user_${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('userId', userId);
  }
  return userId;
}
