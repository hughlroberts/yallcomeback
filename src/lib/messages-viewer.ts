/** Client-safe messages viewer helpers (no server-only imports). */

export type MessagesViewer = {
  userId: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  role: string;
  hostId: string | null;
  isHost: boolean;
  isPlatform: boolean;
};

export function isViewerHostOnConversation(
  viewer: MessagesViewer,
  hostId: string,
): boolean {
  if (viewer.isPlatform) return true;
  return viewer.isHost && viewer.hostId === hostId;
}
