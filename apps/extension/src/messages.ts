export type CanopyMessage =
  | { type: "CANOPY_READ_THREAD" }
  | { type: "CANOPY_INSERT"; text: string }
  | { type: "CANOPY_STATUS" }
  | { type: "CANOPY_PAUSE"; paused: boolean };

export type ThreadResponse = {
  adapter: string | null;
  thread: {
    messages: { author: string; text: string }[];
    composeFound: boolean;
    conversationId?: string;
  } | null;
  diagnostics: Record<string, boolean | string> | null;
  paused?: boolean;
  inboxOpen?: boolean;
};
