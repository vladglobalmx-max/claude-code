"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWindow({
  agentSlug,
  agentName,
  initialMessages = [],
}: {
  agentSlug: string;
  agentName: string;
  initialMessages?: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const message = input.trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/ai/agents/${agentSlug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      toast.error("No se pudo obtener respuesta. Intenta de nuevo.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-lg border border-border bg-surface">
      <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <p className="text-sm text-ink-faint">
            Escribe tu primer mensaje para {agentName}. Puedes adjuntar contexto de un cliente u oportunidad desde su ficha.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                m.role === "assistant" ? "bg-accent/15 text-accent" : "bg-surface-2 text-ink-soft"
              )}
            >
              {m.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                "max-w-[75%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm",
                m.role === "assistant" ? "bg-surface-2 text-ink" : "bg-accent text-accent-ink"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-xs text-ink-faint">{agentName} está escribiendo…</p>}
      </div>

      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Escribe un mensaje…"
          rows={2}
          className="resize-none"
        />
        <Button onClick={handleSend} loading={loading} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
