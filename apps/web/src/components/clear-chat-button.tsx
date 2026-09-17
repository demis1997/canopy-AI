"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ClearChatButton(props: {
  conversationId: string;
  onCleared?: () => void;
  onError?: (message: string) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clear(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm("Clear this chat? Messages and AI suggestions will be deleted. The fan stays in the inbox.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/conversations/${props.conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clearChat: true }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; cleared?: boolean };
    setBusy(false);
    if (!res.ok || json.error) {
      props.onError?.(json.error || "Could not clear chat");
      return;
    }
    props.onCleared?.();
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="danger"
      size={props.size ?? "sm"}
      className={props.className}
      disabled={busy}
      onClick={(event) => void clear(event)}
    >
      {busy ? "Clearing…" : "Clear chat"}
    </Button>
  );
}
