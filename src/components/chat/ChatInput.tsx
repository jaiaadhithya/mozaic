import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({ onSend, placeholder = "Type a message…", disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 140) + "px";
    }
  };

  return (
    <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2">
      <Textarea
        ref={inputRef}
        value={value}
        onChange={e => { setValue(e.target.value); handleInput(); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="min-h-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed shadow-none focus-visible:ring-0"
        style={{ maxHeight: 140, height: "auto" }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim() || disabled}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background transition-opacity disabled:opacity-30"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
}
