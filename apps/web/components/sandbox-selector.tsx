"use client";

import { useState, useEffect } from "react";
import { GitHubAuthConnector } from "./github-auth-connector";
import {
  Cloud,
  Laptop,
  Terminal,
  Cpu,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Layers,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Loader2,
  Check,
  Github,
  Plus,
  Search,
  ExternalLink,
  LogOut,
  FolderGit2,
} from "lucide-react";

export type EnvironmentType = "sandbox" | "local";

export type ProviderId =
  | "e2b"
  | "vercel"
  | "google-cloud-run"
  | "github-codespaces"
  | "github-repository"
  | "local";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  configured: boolean;
  capabilities: {
    terminal: boolean;
    files: boolean;
    processes: boolean;
    build: boolean;
    heavyJobs: boolean;
    git: boolean;
  };
  description: string;
}

export const PROVIDER_METADATA: Record<ProviderId, ProviderMeta> = {
  e2b: {
    id: "e2b",
    name: "E2B",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: true,
      build: true,
      heavyJobs: false,
      git: true,
    },
    description: "Interactive cloud sandbox for terminal, filesystem, and processes.",
  },
  vercel: {
    id: "vercel",
    name: "Vercel Sandbox",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: false,
      build: true,
      heavyJobs: false,
      git: true,
    },
    description: "Serverless build and execution runtime.",
  },
  "google-cloud-run": {
    id: "google-cloud-run",
    name: "Google Cloud Run",
    configured: false,
    capabilities: {
      terminal: false,
      files: true,
      processes: true,
      build: true,
      heavyJobs: true,
      git: true,
    },
    description: "Cloud Run Job for heavy builds (cargo, cmake, gcc, ISO creation).",
  },
  "github-codespaces": {
    id: "github-codespaces",
    name: "GitHub Codespaces",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: true,
      build: true,
      heavyJobs: false,
      git: true,
    },
    description: "Remote dev container workspace on session branch.",
  },
  "github-repository": {
    id: "github-repository",
    name: "GitHub Repository",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: false,
      build: false,
      heavyJobs: false,
      git: true,
    },
    description: "Direct Git tree repository filesystem & live workspace.",
  },
  local: {
    id: "local",
    name: "Local Machine",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: true,
      build: true,
      heavyJobs: true,
      git: true,
    },
    description: "Direct local filesystem and process runner (LocalProvider).",
  },
};

interface SandboxSelectorProps {
  sessionId?: string;
  currentEnvironment?: EnvironmentType;
  currentProviderId?: ProviderId;
  onSelectEnvironmentAndProvider: (
    environment: EnvironmentType,
    providerId: ProviderId
  ) => void;
  disabled?: boolean;
}

export function SandboxSelector({
  sessionId = "session",
  currentEnvironment = "sandbox",
  currentProviderId = "e2b",
  onSelectEnvironmentAndProvider,
  disabled = false,
}: SandboxSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  // GitHub Account & Codespaces State
  const [githubAccount, setGithubAccount] = useState<{
    connected: boolean;
    username?: string;
    avatarUrl?: string;
  }>({ connected: false });
  const [githubLoading, setGithubLoading] = useState(false);
  const [repos, setRepos] = useState<Array<{ fullName: string; name: string }>>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [branches, setBranches] = useState<Array<{ name: string }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [codespaces, setCodespaces] = useState<Array<{ id: string; name: string; state: string }>>([]);
  const [selectedCodespace, setSelectedCodespace] = useState<string>("");

  // New Repo Form Modal
  const [showNewRepoForm, setShowNewRepoForm] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [repoCreating, setRepoCreating] = useState(false);

  const [gitStatus, setGitStatus] = useState<{
    isClean: boolean;
    currentBranch: string;
    currentCommit: string;
    uncommittedFilesCount: number;
  } | null>(null);

  const [pendingChange, setPendingChange] = useState<{
    env: EnvironmentType;
    prov: ProviderId;
  } | null>(null);

  const activeEnv = currentEnvironment;
  const activeProvId = currentEnvironment === "local" ? "local" : currentProviderId;
  const activeProvMeta = PROVIDER_METADATA[activeProvId] || PROVIDER_METADATA.e2b;

  // Load GitHub Account State on Mount or when opening selector
  useEffect(() => {
    async function loadGitHubState() {
      try {
        const res = await fetch(`/api/github?action=account&sessionId=${sessionId}`);
        const data = await res.json();
        setGithubAccount(data);

        if (data.connected) {
          // Fetch repos
          const reposRes = await fetch(`/api/github?action=repos&sessionId=${sessionId}`);
          const reposData = await reposRes.json();
          if (reposData.repos?.length) {
            setRepos(reposData.repos);
            const firstRepo = reposData.repos[0].fullName;
            setSelectedRepo(firstRepo);

            // Fetch branches for first repo
            const branchRes = await fetch(`/api/github?action=branches&sessionId=${sessionId}&repo=${firstRepo}`);
            const branchData = await branchRes.json();
            if (branchData.branches?.length) {
              setBranches(branchData.branches);
              setSelectedBranch(branchData.branches[0].name);
            }

            // Fetch codespaces
            const csRes = await fetch(`/api/github?action=codespaces&sessionId=${sessionId}&repo=${firstRepo}`);
            const csData = await csRes.json();
            if (csData.codespaces?.length) {
              setCodespaces(csData.codespaces);
              setSelectedCodespace(csData.codespaces[0].id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load GitHub state:", e);
      }
    }
    if (isOpen) void loadGitHubState();
  }, [isOpen, sessionId]);

  const handleConnectGitHub = async () => {
    setGithubLoading(true);
    try {
      const res = await fetch(`/api/github?action=connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, username: "soryos-dev" }),
      });
      const data = await res.json();
      if (data.account) {
        setGithubAccount(data.account);
        // Refresh repos
        const reposRes = await fetch(`/api/github?action=repos&sessionId=${sessionId}`);
        const reposData = await reposRes.json();
        if (reposData.repos?.length) {
          setRepos(reposData.repos);
          setSelectedRepo(reposData.repos[0].fullName);
        }
      }
    } finally {
      setGithubLoading(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    await fetch(`/api/github?action=disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setGithubAccount({ connected: false });
    setRepos([]);
    setBranches([]);
    setCodespaces([]);
  };

  const handleSelectRepo = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    try {
      const branchRes = await fetch(`/api/github?action=branches&sessionId=${sessionId}&repo=${repoFullName}`);
      const branchData = await branchRes.json();
      if (branchData.branches?.length) {
        setBranches(branchData.branches);
        setSelectedBranch(branchData.branches[0].name);
      }

      const csRes = await fetch(`/api/github?action=codespaces&sessionId=${sessionId}&repo=${repoFullName}`);
      const csData = await csRes.json();
      if (csData.codespaces?.length) {
        setCodespaces(csData.codespaces);
        setSelectedCodespace(csData.codespaces[0].id);
      } else {
        setCodespaces([]);
      }
    } catch (e) {
      console.error("Failed to update branches for repo:", e);
    }
  };

  const handleCreateNewRepo = async () => {
    if (!newRepoName.trim()) return;
    setRepoCreating(true);
    try {
      const res = await fetch(`/api/github?action=create_repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: newRepoName.trim(),
          description: newRepoDesc.trim(),
          private: newRepoPrivate,
        }),
      });
      const data = await res.json();
      if (data.repo) {
        setRepos((prev) => [data.repo, ...prev]);
        setSelectedRepo(data.repo.fullName);
        setShowNewRepoForm(false);
        setNewRepoName("");
        setNewRepoDesc("");
      }
    } finally {
      setRepoCreating(false);
    }
  };

  const handleCreateOrConnectCodespace = async () => {
    if (!selectedRepo) return;
    setGithubLoading(true);
    try {
      await fetch(`/api/github?action=create_codespace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          repo: selectedRepo,
          branch: selectedBranch,
        }),
      });
      onSelectEnvironmentAndProvider("sandbox", "github-codespaces");
      setIsOpen(false);
    } finally {
      setGithubLoading(false);
    }
  };

  const getDiscreetBadgeLabel = () => {
    if (activeEnv === "local") {
      return "💻 Local";
    }
    return `☁️ Sandbox · ${activeProvMeta.name}`;
  };

  const checkGitAndInitiateTransition = async (env: EnvironmentType, prov: ProviderId) => {
    setPendingChange({ env, prov });
    setIsOpen(false);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/git-sync`);
      const data = await res.json();
      if (data.gitStatus) {
        setGitStatus(data.gitStatus);
      }
    } catch {
      setGitStatus({
        isClean: true,
        currentBranch: `soryos-code/${sessionId.slice(0, 8)}`,
        currentCommit: "latest",
        uncommittedFilesCount: 0,
      });
    }

    setSyncModalOpen(true);
  };

  const handleCommitAndPushThenSwitch = async () => {
    if (!pendingChange) return;
    setSyncing(true);

    try {
      await fetch(`/api/sessions/${sessionId}/git-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit_and_push",
          providerId: activeProvId,
          commitMessage: `soryos-code: checkpoint before switching to ${pendingChange.prov}`,
        }),
      });

      if (pendingChange.env === "sandbox") {
        await fetch(`/api/sessions/${sessionId}/git-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_cloud",
            providerId: pendingChange.prov,
          }),
        });
      }

      setSyncDone(true);
      setTimeout(() => {
        onSelectEnvironmentAndProvider(pendingChange.env, pendingChange.prov);
        setSyncModalOpen(false);
        setSyncing(false);
        setSyncDone(false);
        setPendingChange(null);
      }, 800);
    } catch {
      onSelectEnvironmentAndProvider(pendingChange.env, pendingChange.prov);
      setSyncModalOpen(false);
      setSyncing(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-lg border border-[#e2ddd5] bg-[#faf8f5] px-2.5 py-1.5 text-xs font-semibold text-[#3d3830] shadow-2xs transition hover:bg-[#f3eee7] hover:border-[#c6623f]/50 focus:outline-none ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        title="Environment & Sandbox Selector"
      >
        <span className="flex items-center gap-1 text-emerald-800">
          <span>{getDiscreetBadgeLabel()}</span>
        </span>
        <ChevronDown className="h-3 w-3 text-[#8a8175]" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 z-50 mt-1.5 w-92 rounded-xl border border-[#e2ddd5] bg-white p-3.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-1 pb-2 border-b border-[#eee9e1] mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3d3830] flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-[#c6623f]" />
                  Execution Environment
                </span>
                <span className="text-[10px] text-[#8a8175] font-mono">
                  SoryOS-Code
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* 1. FIRST SELECTOR: ENVIRONMENT */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[#5c5348] uppercase tracking-wider">
                  Environment
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeEnv !== "sandbox") {
                        checkGitAndInitiateTransition("sandbox", currentProviderId === "local" ? "e2b" : currentProviderId);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg border transition ${
                      activeEnv === "sandbox"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs"
                        : "bg-white border-[#e5e0d8] text-[#5c5348] hover:bg-[#faf8f5]"
                    }`}
                  >
                    <span>☁️ Sandbox</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeEnv !== "local") {
                        checkGitAndInitiateTransition("local", "local");
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg border transition ${
                      activeEnv === "local"
                        ? "bg-slate-100 border-slate-300 text-slate-900 shadow-2xs"
                        : "bg-white border-[#e5e0d8] text-[#5c5348] hover:bg-[#faf8f5]"
                    }`}
                  >
                    <span>💻 Local</span>
                  </button>
                </div>
              </div>

              {/* 2. SECOND SELECTOR: SANDBOX PROVIDER */}
              {activeEnv === "sandbox" ? (
                <div className="space-y-2 border-t border-[#eee9e1] pt-3">
                  <label className="block text-[11px] font-bold text-[#5c5348] uppercase tracking-wider">
                    Sandbox Provider
                  </label>
                  <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                    {(["e2b", "vercel", "google-cloud-run", "github-codespaces"] as ProviderId[]).map((pId) => {
                      const meta = PROVIDER_METADATA[pId];
                      const isSelected = activeProvId === pId;

                      return (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => {
                            if (pId !== activeProvId) {
                              checkGitAndInitiateTransition("sandbox", pId);
                            }
                          }}
                          className={`w-full text-left rounded-lg p-2 transition border flex items-start gap-2.5 ${
                            isSelected
                              ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium"
                              : "bg-white border-[#eee9e1] hover:bg-[#f8f5f0] text-[#3d3830]"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">☁️ {meta.name}</span>
                              {meta.configured ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Configured
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Not configured
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-[#6e6559] mt-0.5 line-clamp-1">
                              {meta.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 3. GITHUB AUTHENTICATION & CODESPACES CONNECTOR */}
                  {activeProvId === "github-codespaces" && (
                    <div className="mt-3">
                      <GitHubAuthConnector
                        sessionId={sessionId}
                        onCodespaceSelected={() => {
                          onSelectEnvironmentAndProvider("sandbox", "github-codespaces");
                          setIsOpen(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-[#eee9e1] pt-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-slate-900">💻 Mode Local Autonome Active</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      L&apos;Agent et le Terminal fonctionnent directement sur votre système de fichiers local (`LocalProvider`). Aucune connexion GitHub requise.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* GitHub Sync Transition Modal */}
      {syncModalOpen && pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#e5e0d8] bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-[#3d3830] font-bold text-base">
              <GitBranch className="h-5 w-5 text-[#c6623f]" />
              <span>Changement d&apos;environnement d&apos;exécution</span>
            </div>

            <p className="text-xs text-[#5c5348] leading-relaxed">
              Transition de <strong>{activeEnv === "local" ? "💻 Local" : `☁️ ${activeProvMeta.name}`}</strong> vers <strong>{pendingChange.env === "local" ? "💻 Local" : `☁️ ${PROVIDER_METADATA[pendingChange.prov]?.name}`}</strong>.
            </p>

            {gitStatus && !gitStatus.isClean ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Modifications non enregistrées
                  </span>
                  <span className="font-mono text-[10px] bg-amber-200/60 px-1.5 py-0.5 rounded">
                    {gitStatus.uncommittedFilesCount} fichier(s)
                  </span>
                </div>
                <p className="text-[11px] leading-snug">
                  Votre espace de travail contient des fichiers non commités. Pour retrouver exactement le même état dans <strong>{pendingChange.prov}</strong>, nous recommandons de commiter et pusher vers la branche de session GitHub.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Espace de travail propre (Clean Git Status)
                </div>
                <p className="text-[11px]">
                  Branche : <code className="font-mono">{gitStatus?.currentBranch || `soryos-code/${sessionId.slice(0, 8)}`}</code>
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={syncing}
                onClick={handleCommitAndPushThenSwitch}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-[#c6623f] hover:bg-[#b05332] rounded-lg shadow-2xs transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Synchronisation avec GitHub en cours...</span>
                  </>
                ) : syncDone ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Synchronisé !</span>
                  </>
                ) : (
                  <>
                    <GitPullRequest className="h-4 w-4" />
                    <span>Commit & Push vers GitHub puis basculer</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={syncing}
                onClick={() => {
                  onSelectEnvironmentAndProvider(pendingChange.env, pendingChange.prov);
                  setSyncModalOpen(false);
                  setPendingChange(null);
                }}
                className="w-full py-2 px-3 text-xs font-semibold text-[#5c5348] hover:bg-[#faf8f5] rounded-lg border border-[#e5e0d8] transition flex items-center justify-center gap-1.5"
              >
                <GitCommit className="h-3.5 w-3.5" />
                <span>Changer directement (Sans pousser)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
