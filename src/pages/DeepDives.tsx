import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import { useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import { AI_MODELS } from "@/types/ai";
import type { AIProvider } from "@/types/ai";
import { convexApi } from "@/lib/convex-api";
import { DEEP_DIVE_PROVIDERS } from "@/lib/deep-dive-types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / (60 * 1000));
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function DeepDives() {
  const navigate = useNavigate();
  const deepDives = useConvexQuery(convexApi.deepDives.list, {}) ?? [];
  const createDeepDive = useConvexMutation(convexApi.deepDives.createDeepDive);
  const availableProviders = DEEP_DIVE_PROVIDERS;

  const [open, setOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<AIProvider[]>(
    availableProviders.length ? availableProviders : ["gpt"]
  );
  const [creating, setCreating] = useState(false);
  const renameDeepDive = useConvexMutation(convexApi.deepDives.renameDeepDive);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const onNew = () => {
    setOpen(true);
    setSelectedProviders(availableProviders.length ? availableProviders : ["gpt"]);
  };

  const onClose = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedProviders(availableProviders.length ? availableProviders : ["gpt"]);
    }
  };

  const toggleProvider = (p: AIProvider) => {
    setSelectedProviders(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const deepDiveId = await createDeepDive({
        providers: selectedProviders,
        title: "New Deep Dive",
      });
      if (!deepDiveId) return;
      onClose(false);
      navigate(`/dive/${String(deepDiveId)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Projects</h1>
          <Button size="sm" onClick={onNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        </div>

        {deepDives.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <button
              type="button"
              onClick={onNew}
              className="mt-3 text-sm font-medium text-foreground underline underline-offset-4"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-1">
            {deepDives.map(dive => {
              const providerDots = dive.providers.map(p => AI_MODELS[p]);
              const isRenaming = renamingId === dive.id;

              const commitRename = async () => {
                const trimmed = renameValue.trim();
                if (trimmed && trimmed !== dive.title) {
                  await renameDeepDive({ diveId: dive.id as any, title: trimmed });
                }
                setRenamingId(null);
              };

              return (
                <div
                  key={dive.id}
                  className="group grid items-center rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
                  style={{ gridTemplateColumns: "28px 1fr auto auto auto" }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/dive/${dive.id}`)}
                    className="col-span-2 grid items-center gap-0"
                    style={{ gridTemplateColumns: "subgrid" }}
                  >
                    <div className="flex items-center gap-1">
                      {providerDots.map(model => (
                        <span
                          key={model.id}
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: `hsl(var(--${model.color}))` }}
                        />
                      ))}
                    </div>

                    <div className="min-w-0 truncate">
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            else if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="w-full rounded border border-border bg-transparent px-1 text-sm text-foreground outline-none focus:border-ring"
                        />
                      ) : (
                        <span className="text-sm text-foreground">{dive.title}</span>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(dive.id);
                      setRenameValue(dive.title);
                      setTimeout(() => renameInputRef.current?.select(), 0);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>

                  <span className="pl-3 text-right text-xs text-muted-foreground">
                    {dive.threads.length} {dive.threads.length === 1 ? "thread" : "threads"}
                  </span>

                  <span className="w-20 text-right text-xs text-muted-foreground">
                    {formatRelative(dive.updatedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">New project</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Choose models for this workspace. You can branch conversations later.
            </p>
            <div className="space-y-1">
              {availableProviders.map(provider => {
                const model = AI_MODELS[provider];
                const checked = selectedProviders.includes(provider);
                return (
                  <label
                    key={provider}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleProvider(provider)} />
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: `hsl(var(--${model.color}))` }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-foreground">{model.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{model.fullName}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={selectedProviders.length === 0 || creating}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
