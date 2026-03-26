import { useEffect, useMemo, useState } from "react";
import { useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import { useTheme } from "next-themes";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Moon, Sun, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { convexApi } from "@/lib/convex-api";

export function AppHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [openSettings, setOpenSettings] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [serverKeyInput, setServerKeyInput] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingServerKey, setSavingServerKey] = useState(false);
  const [clearingServerKey, setClearingServerKey] = useState(false);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const appSettings = useConvexQuery(convexApi.settings.get, {});
  const saveOpenRouterKey = useConvexMutation(convexApi.settings.setOpenRouterKey);
  const clearOpenRouterKey = useConvexMutation(convexApi.settings.clearOpenRouterKey);

  const openRouterStatus = appSettings?.openRouter;

  const saveServerKey = async () => {
    const trimmed = serverKeyInput.trim();
    if (!trimmed) return;
    setSettingsError(null);
    setSavingServerKey(true);
    try {
      await saveOpenRouterKey({ apiKey: trimmed });
      setServerKeyInput("");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to save key");
    } finally {
      setSavingServerKey(false);
    }
  };

  const clearServerKey = async () => {
    setSettingsError(null);
    setClearingServerKey(true);
    try {
      await clearOpenRouterKey({});
      setServerKeyInput("");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to clear key");
    } finally {
      setClearingServerKey(false);
    }
  };

  const isHome = location.pathname === "/";
  const isPlayground = location.pathname === "/playground";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              mozaic
            </button>

            <nav className="hidden items-center gap-1 md:flex">
              <button
                type="button"
                onClick={() => navigate("/")}
                className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                  isHome
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Projects
              </button>
              <button
                type="button"
                onClick={() => navigate("/playground")}
                className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                  isPlayground
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Lab
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setOpenSettings(true)}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  openRouterStatus?.configured ? "bg-emerald-500" : "bg-red-400"
                }`}
              />
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <Dialog open={openSettings} onOpenChange={setOpenSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">OpenRouter API Key</label>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Used for all AI model access. Stored locally in the app database.
              </p>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  openRouterStatus?.configured ? "bg-emerald-500" : "bg-red-400"
                }`}
              />
              {appSettings === undefined
                ? "Checking..."
                : openRouterStatus?.configured
                  ? `Connected${openRouterStatus.lastFour ? ` · ····${openRouterStatus.lastFour}` : ""}`
                  : "Not configured"}
            </div>

            <div className="flex gap-2">
              <Input
                value={serverKeyInput}
                onChange={(e) => setServerKeyInput(e.target.value)}
                placeholder="sk-or-..."
                type="password"
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                onClick={saveServerKey}
                disabled={!serverKeyInput.trim() || savingServerKey}
              >
                Save
              </Button>
              {openRouterStatus?.source === "frontend" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearServerKey}
                  disabled={clearingServerKey}
                >
                  Clear
                </Button>
              )}
            </div>

            {settingsError && (
              <p className="text-sm text-destructive">{settingsError}</p>
            )}

            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Get an API key
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
