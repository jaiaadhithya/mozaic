import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import {
  ChevronLeft,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Scale,
  Users2,
} from "lucide-react";
import { AI_MODELS } from "@/types/ai";
import type { AIProvider } from "@/types/ai";
import { convexApi } from "@/lib/convex-api";
import type { DeepDiveThreadRecord, DeepDiveUIMessage } from "@/lib/deep-dive-types";
import { DEEP_DIVE_PROVIDERS } from "@/lib/deep-dive-types";
import { ThreadChatPanel } from "@/components/deep-dive/ThreadChatPanel";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

function truncateOneLine(s: string, max = 48) {
  const first = (s.split("\n")[0] ?? "").trim().replace(/\s+/g, " ");
  if (first.length <= max) return first || "Thread";
  return `${first.slice(0, max - 1)}…`;
}

function getMessageText(message: DeepDiveUIMessage) {
  return message.parts
    .filter(part => part.type === "text" || part.type === "reasoning")
    .map(part => part.text)
    .join("\n")
    .trim();
}

const proseClasses = "prose prose-sm prose-neutral max-w-none dark:prose-invert prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:rounded-lg";

function threadTypeIcon(type: DeepDiveThreadRecord["type"]) {
  if (type === "vote") return <Scale className="h-3.5 w-3.5" />;
  if (type === "teamwork") return <Users2 className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
}

function formatTime(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(ts);
}

export default function DeepDive() {
  const navigate = useNavigate();
  const { diveId } = useParams();
  const deepDive = useConvexQuery(convexApi.deepDives.get, diveId ? { diveId } : "skip");
  const createThread = useConvexMutation(convexApi.deepDives.createThread);
  const appendUserMessage = useConvexMutation(convexApi.deepDives.appendUserMessage);
  const sendThreadMessage = useAction(convexApi.ai.sendThreadMessage);
  const runVote = useAction(convexApi.ai.runVote);
  const runDebate = useAction(convexApi.ai.runDebate);

  const renameDeepDive = useConvexMutation(convexApi.deepDives.renameDeepDive);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [askDialog, setAskDialog] = useState<{ open: boolean; seed: DeepDiveUIMessage[]; target: AIProvider } | null>(null);
  const [debateDialog, setDebateDialog] = useState<{ open: boolean; seed: DeepDiveUIMessage[] } | null>(null);
  const [debateParticipants, setDebateParticipants] = useState<AIProvider[]>(DEEP_DIVE_PROVIDERS);
  const [creatingThread, setCreatingThread] = useState(false);
  const [runningVote, setRunningVote] = useState(false);
  const [runningDebate, setRunningDebate] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const activeThread = useMemo(() => {
    if (!deepDive) return null;
    if (activeThreadId) {
      const match = deepDive.threads.find(thread => thread.id === activeThreadId);
      if (match) return match;
    }
    return deepDive.threads[0] ?? null;
  }, [activeThreadId, deepDive]);

  const isLoading = Boolean(diveId) && deepDive === undefined;

  if (!diveId) return null;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!deepDive) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-foreground">Project not found</p>
        <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Back to projects
        </Link>
      </div>
    );
  }

  const sortedThreads = deepDive.threads.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const participantOrder = deepDive.providers.length ? deepDive.providers : [...DEEP_DIVE_PROVIDERS];

  const defaultOther = (provider?: AIProvider) => {
    if (!provider) return participantOrder[0] ?? "gpt";
    const idx = participantOrder.indexOf(provider);
    if (idx === -1) return participantOrder[0] ?? "gpt";
    return participantOrder[(idx + 1) % participantOrder.length] ?? (participantOrder[0] ?? "gpt");
  };

  const newThread = async () => {
    if (!deepDive) return;
    setCreatingThread(true);
    try {
      const threadId = await createThread({ deepDiveId: deepDive.id, title: "New thread", type: "chat", seedMessages: [] });
      setActiveThreadId(String(threadId));
    } finally {
      setCreatingThread(false);
    }
  };

  const askOtherAI = (seedMessages: DeepDiveUIMessage[], provider?: AIProvider) => {
    const next = defaultOther(provider);
    setAskDialog({ open: true, seed: seedMessages, target: next });
  };

  const confirmAskOther = async () => {
    if (!askDialog) return;
    setCreatingThread(true);
    try {
      const threadId = await createThread({
        deepDiveId: deepDive.id,
        type: "chat",
        title: `Ask ${AI_MODELS[askDialog.target].name}: ${truncateOneLine(getMessageText(askDialog.seed[askDialog.seed.length - 1] ?? { parts: [] } as DeepDiveUIMessage))}`,
        seedMessages: askDialog.seed,
      });
      setActiveThreadId(String(threadId));
      setAskDialog(null);
    } finally {
      setCreatingThread(false);
    }
  };

  const callVote = async (seedMessages: DeepDiveUIMessage[]) => {
    const subject = truncateOneLine(getMessageText(seedMessages[seedMessages.length - 1] ?? { parts: [] } as DeepDiveUIMessage), 60);
    setCreatingThread(true);
    try {
      const threadId = await createThread({
        deepDiveId: deepDive.id,
        type: "vote",
        title: `Vote: ${subject}`,
        seedMessages,
      });
      setActiveThreadId(String(threadId));
      setRunningVote(true);
      await runVote({
        threadId: String(threadId),
        prompt: subject,
        participants: deepDive.providers,
      });
    } finally {
      setCreatingThread(false);
      setRunningVote(false);
    }
  };

  const startDebate = (seedMessages: DeepDiveUIMessage[]) => {
    setDebateParticipants(participantOrder);
    setDebateDialog({ open: true, seed: seedMessages });
  };

  const toggleDebater = (provider: AIProvider) => {
    setDebateParticipants(prev => (prev.includes(provider) ? prev.filter(x => x !== provider) : [...prev, provider]));
  };

  const confirmDebate = async () => {
    if (!debateDialog) return;
    const subject = truncateOneLine(getMessageText(debateDialog.seed[debateDialog.seed.length - 1] ?? { parts: [] } as DeepDiveUIMessage), 60);
    const participants = debateParticipants.length ? debateParticipants : participantOrder;
    setCreatingThread(true);
    try {
      const threadId = await createThread({
        deepDiveId: deepDive.id,
        type: "teamwork",
        title: `Debate: ${subject}`,
        seedMessages: debateDialog.seed,
      });
      setActiveThreadId(String(threadId));
      setDebateDialog(null);
      setRunningDebate(true);
      await runDebate({
        threadId: String(threadId),
        prompt: subject,
        participants,
      });
    } finally {
      setCreatingThread(false);
      setRunningDebate(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeThread) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setChatError(null);
    setSendingMessage(true);
    try {
      await appendUserMessage({ threadId: activeThread.id, text: trimmed });
      await sendThreadMessage({ threadId: activeThread.id });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const contextMessages = activeThread?.messages ?? [];
  const voteResults = activeThread?.voteResults ?? [];
  const teamworkMessages = activeThread?.teamworkMessages ?? [];
  const voteWinner = voteResults.length ? [...voteResults].sort((a, b) => b.votes.length - a.votes.length)[0] : null;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Compact top bar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Projects
        </button>
        <span className="text-border">/</span>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={async () => {
              const trimmed = editTitle.trim();
              if (trimmed && trimmed !== deepDive.title) {
                await renameDeepDive({ diveId: deepDive.id, title: trimmed });
              }
              setIsEditingTitle(false);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setIsEditingTitle(false);
              }
            }}
            className="min-w-0 flex-1 truncate rounded border border-border bg-transparent px-1 text-[13px] font-medium text-foreground outline-none focus:border-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditTitle(deepDive.title);
              setIsEditingTitle(true);
              setTimeout(() => titleInputRef.current?.select(), 0);
            }}
            className="min-w-0 truncate rounded px-1 text-[13px] font-medium text-foreground hover:bg-accent"
            title="Click to rename"
          >
            {deepDive.title}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {deepDive.providers.map(provider => (
            <span
              key={provider}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: `hsl(var(--${AI_MODELS[provider].color}))` }}
              title={AI_MODELS[provider].name}
            />
          ))}
        </div>
      </div>

      {/* Main workspace area */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Threads</span>
            <button
              type="button"
              onClick={newThread}
              disabled={creatingThread}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-1.5 pb-2">
            {sortedThreads.map(thread => {
              const isActive = thread.id === activeThread?.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <span className="shrink-0 text-muted-foreground">{threadTypeIcon(thread.type)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{thread.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chat / Content area */}
        <section className="flex min-w-0 flex-1 flex-col">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">Select or create a thread</p>
            </div>
          ) : activeThread.type === "chat" ? (
            <ThreadChatPanel
              key={activeThread.id}
              thread={activeThread}
              defaultOther={defaultOther}
              onAskOther={askOtherAI}
              onVote={callVote}
              onDebate={startDebate}
              onSend={handleSendMessage}
              isSending={sendingMessage}
              errorMessage={chatError}
            />
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Vote view */}
              {activeThread.type === "vote" && (
                <div className="mx-auto max-w-3xl space-y-4 px-5 py-6">
                  {contextMessages.length > 0 && (
                    <div className="space-y-3 border-b border-border pb-4">
                      <span className="text-xs font-medium text-muted-foreground">Context</span>
                      {contextMessages.map(message => {
                        const provider = message.metadata?.provider as AIProvider | undefined;
                        const model = provider ? AI_MODELS[provider] : null;
                        const text = getMessageText(message);
                        const isUser = message.role === "user";
                        return (
                          <div key={message.id} className={isUser ? "flex justify-end" : ""}>
                            <div className={isUser ? "max-w-[75%]" : ""}>
                              {!isUser && model && (
                                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(var(--${model.color}))` }} />
                                  {model.name}
                                </div>
                              )}
                              {isUser ? (
                                <div className="rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground">
                                  <div className="whitespace-pre-wrap break-words">{text}</div>
                                </div>
                              ) : (
                                <div className={proseClasses}>
                                  <ReactMarkdown>{text}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {voteResults.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {runningVote ? "Gathering proposals…" : "No vote results yet."}
                    </div>
                  )}

                  {voteResults.map(result => {
                    const model = AI_MODELS[result.provider];
                    const isWinner = voteWinner?.provider === result.provider;
                    const seed: DeepDiveUIMessage[] = [
                      ...contextMessages,
                      {
                        id: `vote-${activeThread.id}-${result.provider}`,
                        role: "assistant",
                        metadata: { provider: result.provider, createdAt: Date.now() },
                        parts: [{ type: "text", text: result.response }],
                      },
                    ];

                    return (
                      <div
                        key={result.provider}
                        className={`group relative rounded-lg border p-4 ${
                          isWinner ? "border-foreground/20 bg-accent/50" : "border-border bg-card"
                        }`}
                      >
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-1" align="end">
                            <Button variant="ghost" size="sm" onClick={() => askOtherAI(seed, result.provider)} className="w-full justify-start text-[13px]">
                              Ask {AI_MODELS[defaultOther(result.provider)].name}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => callVote(seed)} className="w-full justify-start text-[13px]">
                              Call a vote
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => startDebate(seed)} className="w-full justify-start text-[13px]">
                              Start a debate
                            </Button>
                          </PopoverContent>
                        </Popover>

                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: `hsl(var(--${model.color}))` }}
                          />
                          <span className="text-sm font-medium text-foreground">{model.name}</span>
                          <span className="text-xs text-muted-foreground">{result.votes.length} votes</span>
                          {isWinner && (
                            <span className="ml-auto rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground">
                              Leading
                            </span>
                          )}
                        </div>

                        <div className={`mt-3 ${proseClasses}`}>
                          <ReactMarkdown>{result.response}</ReactMarkdown>
                        </div>

                        {result.votes.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Voted by</span>
                            {result.votes.map(voter => (
                              <span
                                key={voter}
                                className="text-xs font-medium"
                                style={{ color: `hsl(var(--${AI_MODELS[voter].color}))` }}
                              >
                                {AI_MODELS[voter].name}
                              </span>
                            ))}
                          </div>
                        )}

                        {result.reasoning && (
                          <p className="mt-3 text-xs italic text-muted-foreground">{result.reasoning}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Debate view */}
              {activeThread.type === "teamwork" && (
                <div className="mx-auto max-w-3xl space-y-4 px-5 py-6">
                  {contextMessages.length > 0 && (
                    <div className="space-y-3 border-b border-border pb-4">
                      <span className="text-xs font-medium text-muted-foreground">Context</span>
                      {contextMessages.map(message => {
                        const provider = message.metadata?.provider as AIProvider | undefined;
                        const model = provider ? AI_MODELS[provider] : null;
                        const text = getMessageText(message);
                        const isUser = message.role === "user";
                        return (
                          <div key={message.id} className={isUser ? "flex justify-end" : ""}>
                            <div className={isUser ? "max-w-[75%]" : ""}>
                              {!isUser && model && (
                                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(var(--${model.color}))` }} />
                                  {model.name}
                                </div>
                              )}
                              {isUser ? (
                                <div className="rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground">
                                  <div className="whitespace-pre-wrap break-words">{text}</div>
                                </div>
                              ) : (
                                <div className={proseClasses}>
                                  <ReactMarkdown>{text}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {teamworkMessages.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {runningDebate ? "The debate is underway…" : "No debate messages yet."}
                    </div>
                  )}

                  {teamworkMessages.map((message, idx) => {
                    const from = AI_MODELS[message.from];
                    const toLabel = message.to === "all" ? "everyone" : AI_MODELS[message.to as AIProvider]?.name;
                    const seed: DeepDiveUIMessage[] = [
                      ...contextMessages,
                      ...teamworkMessages.slice(0, idx + 1).map(item => ({
                        id: item.id,
                        role: "assistant" as const,
                        metadata: { provider: item.from, createdAt: item.timestamp },
                        parts: [{ type: "text", text: item.content }],
                      })),
                    ];

                    return (
                      <div key={message.id} className="group relative rounded-lg border border-border bg-card p-4">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-1" align="end">
                            <Button variant="ghost" size="sm" onClick={() => askOtherAI(seed, message.from)} className="w-full justify-start text-[13px]">
                              Ask {AI_MODELS[defaultOther(message.from)].name}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => callVote(seed)} className="w-full justify-start text-[13px]">
                              Call a vote
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => startDebate(seed)} className="w-full justify-start text-[13px]">
                              Start a debate
                            </Button>
                          </PopoverContent>
                        </Popover>

                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: `hsl(var(--${from.color}))` }}
                          />
                          <span className="text-sm font-medium text-foreground">{from.name}</span>
                          <span className="text-xs text-muted-foreground">to {toLabel}</span>
                        </div>

                        <div className={`mt-3 ${proseClasses}`}>
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Ask another AI dialog */}
      <Dialog open={!!askDialog?.open} onOpenChange={(open) => !open && setAskDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Ask another model</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {participantOrder.map(provider => (
              <label key={provider} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent">
                <Checkbox checked={askDialog?.target === provider} onCheckedChange={() => askDialog && setAskDialog({ ...askDialog, target: provider })} />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(var(--${AI_MODELS[provider].color}))` }} />
                <span className="text-sm text-foreground">{AI_MODELS[provider].name}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAskDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={confirmAskOther} disabled={creatingThread}>Ask</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debate dialog */}
      <Dialog open={!!debateDialog?.open} onOpenChange={(open) => !open && setDebateDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Start a debate</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {participantOrder.map(provider => (
              <label key={provider} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent">
                <Checkbox checked={debateParticipants.includes(provider)} onCheckedChange={() => toggleDebater(provider)} />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(var(--${AI_MODELS[provider].color}))` }} />
                <span className="text-sm text-foreground">{AI_MODELS[provider].name}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDebateDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={confirmDebate} disabled={creatingThread || runningDebate}>Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
