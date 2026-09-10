export type VisibleMessage = { author: "subscriber" | "creator" | "unknown"; text: string };

export type ThreadContext = {
  messages: VisibleMessage[];
  composeFound: boolean;
  conversationId?: string;
};

export interface PlatformAdapter {
  id: string;
  matches(url: string): boolean;
  getVisibleThread(): ThreadContext | null;
  insertReply(text: string): { ok: boolean; reason?: string };
  diagnostics(): Record<string, boolean | string>;
}

export function detectAdapter(url: string, adapters: PlatformAdapter[]): PlatformAdapter | null {
  return adapters.find((a) => a.matches(url)) ?? null;
}
