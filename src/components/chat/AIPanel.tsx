import { AI_MODELS } from "@/types/ai";
import { useChatContext } from "@/context/ChatContext";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import type { AIProvider } from "@/types/ai";

interface AIPanelProps {
  provider: AIProvider;
  compact?: boolean;
}

export function AIPanel({ provider, compact }: AIPanelProps) {
  const { getProviderMessages, providerIsTyping, sendMessage } = useChatContext();
  const model = AI_MODELS[provider];
  const messages = getProviderMessages(provider);
  const isTyping = providerIsTyping[provider];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: `hsl(var(--${model.color}))` }}
        />
        <span className="text-sm font-medium text-foreground">{model.name}</span>
        {!compact && (
          <span className="text-xs text-muted-foreground">{model.fullName}</span>
        )}
      </div>

      <MessageList messages={messages} isTyping={isTyping} />

      <div className="p-3">
        <ChatInput
          onSend={(msg) => sendMessage(msg, provider)}
          placeholder={`Ask ${model.name}…`}
          disabled={isTyping}
        />
      </div>
    </div>
  );
}
