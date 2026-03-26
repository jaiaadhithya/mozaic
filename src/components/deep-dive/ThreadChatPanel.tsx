import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChatInput } from "@/components/chat/ChatInput";
import { AI_MODELS } from "@/types/ai";
import type { AIProvider } from "@/types/ai";
import type { DeepDiveThreadRecord, DeepDiveUIMessage } from "@/lib/deep-dive-types";

function getMessageText(message: DeepDiveUIMessage) {
  return message.parts
    .filter(part => part.type === "text" || part.type === "reasoning")
    .map(part => part.text)
    .join("\n")
    .trim();
}

function hasRenderableParts(message: DeepDiveUIMessage) {
  return message.parts.some((part) => {
    if (part.type === "text" || part.type === "reasoning") {
      return Boolean(part.text?.trim());
    }
    return true;
  });
}

interface ThreadChatPanelProps {
  thread: DeepDiveThreadRecord;
  onAskOther: (seedMessages: DeepDiveUIMessage[], provider?: AIProvider) => void;
  onVote: (seedMessages: DeepDiveUIMessage[]) => void;
  onDebate: (seedMessages: DeepDiveUIMessage[]) => void;
  onSend: (text: string) => void | Promise<void>;
  isSending: boolean;
  errorMessage?: string | null;
  defaultOther: (provider?: AIProvider) => AIProvider;
}

export function ThreadChatPanel({
  thread,
  onAskOther,
  onVote,
  onDebate,
  onSend,
  isSending,
  errorMessage,
  defaultOther,
}: ThreadChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const visibleMessages = thread.messages.filter(hasRenderableParts);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, isSending]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-2 px-5 py-6">
          {visibleMessages.length === 0 && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Start a conversation. Mention <span className="font-medium text-foreground">@GPT</span>,{" "}
                <span className="font-medium text-foreground">@Gemini</span>, or{" "}
                <span className="font-medium text-foreground">@Claude</span> to route.
              </p>
            </div>
          )}

          {visibleMessages.map((message, idx) => {
            const isUser = message.role === "user";
            const provider = message.metadata?.provider as AIProvider | undefined;
            const model = provider ? AI_MODELS[provider] : null;
            const text = getMessageText(message);

            if (isUser) {
              return (
                <div key={message.id} className="flex justify-end py-2">
                  <div className="max-w-[75%] rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground">
                    <div className="whitespace-pre-wrap break-words">{text}</div>
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className="group relative py-2">
                {model && (
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: `hsl(var(--${model.color}))` }}
                    />
                    {model.name}
                  </div>
                )}

                <div className="relative">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-2 -top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="end">
                      <Button variant="ghost" size="sm" onClick={() => onAskOther(visibleMessages.slice(0, idx + 1), provider)} className="w-full justify-start text-[13px]">
                        Ask {AI_MODELS[defaultOther(provider)].name}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onVote(visibleMessages.slice(0, idx + 1))} className="w-full justify-start text-[13px]">
                        Call a vote
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDebate(visibleMessages.slice(0, idx + 1))} className="w-full justify-start text-[13px]">
                        Start a debate
                      </Button>
                    </PopoverContent>
                  </Popover>

                  <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:rounded-lg">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                </div>

                {message.metadata?.routingNote && (
                  <p className="mt-1 text-xs text-muted-foreground">{message.metadata.routingNote}</p>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-center gap-1.5 py-2 text-sm text-muted-foreground">
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-4 pt-2">
        <ChatInput
          onSend={onSend}
          placeholder="Message this thread…"
          disabled={isSending}
        />
      </div>
    </div>
  );
}
