/** Browser-held keys for guest designer chats. Read only after hydration. */
export type GuestChat = { id: string; token: string; title: string; designer: string };
const KEY = "artisan-guest-chats";

export function guestChats(): GuestChat[] {
  try { const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as GuestChat[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
export function saveGuestChat(chat: GuestChat) {
  localStorage.setItem(KEY, JSON.stringify([chat, ...guestChats().filter((c) => c.id !== chat.id)].slice(0, 30)));
}
export function newGuestToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
