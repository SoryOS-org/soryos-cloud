"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Github,
  FileArchive,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSession } from "@/lib/api";
import JSZip from "jszip";

interface ImportRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  onImportSuccess?: () => void;
}

type TabMode = "folder" | "github" | "zip";

export function ImportRepoModal({
  isOpen,
  onClose,
  sessionId,
  onImportSuccess,
}: ImportRepoModalProps) {
  const [tab, setTab] = useState<TabMode>("folder");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const router = useRouter();

  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const ensureTargetSession = async (title: string): Promise<string> => {
    if (sessionId) return sessionId;
    const newSession = await createSession(title, "Import de code source");
    return newSession.id;
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setStatusText(`Lecture de ${fileList.length} fichiers locaux...`);

    try {
      const extracted: Record<string, string> = {};
      const filesArray = Array.from(fileList);

      let processed = 0;
      for (const file of filesArray) {
        const relativePath = file.webkitRelativePath || file.name;
        const parts = relativePath.split("/");
        if (parts.length > 1) {
          parts.shift();
        }
        const cleanPath = parts.join("/");

        if (
          !cleanPath.includes("node_modules/") &&
          !cleanPath.includes(".git/") &&
          !cleanPath.includes(".next/") &&
          !cleanPath.includes("dist/") &&
          file.size < 500_000
        ) {
          try {
            const text = await file.text();
            extracted[cleanPath] = text;
          } catch {
            // skip binary
          }
        }

        processed++;
        if (processed % 20 === 0 || processed === filesArray.length) {
          setStatusText(`Lecture : ${processed}/${filesArray.length} fichiers...`);
        }
      }

      const targetSessionId = await ensureTargetSession("Projet importé");
      setStatusText("Enregistrement dans l'espace de travail...");

      const res = await fetch(`/api/sessions/${targetSessionId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: extracted }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'import");

      setSuccessCount(data.count || Object.keys(extracted).length);
      onImportSuccess?.();

      if (!sessionId) {
        router.push(`/chat/${targetSessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setStatusText("Décompression de l'archive ZIP...");

    try {
      const zip = await JSZip.loadAsync(file);
      const extracted: Record<string, string> = {};

      for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        const parts = rawPath.split("/");
        if (parts.length > 1) {
          parts.shift();
        }
        const cleanPath = parts.join("/");

        if (
          !cleanPath.includes("node_modules/") &&
          !cleanPath.includes(".git/") &&
          !cleanPath.includes(".next/") &&
          !cleanPath.includes("dist/")
        ) {
          try {
            const text = await zipEntry.async("string");
            if (text.length < 500_000) {
              extracted[cleanPath] = text;
            }
          } catch {
            // skip binary
          }
        }
      }

      const targetSessionId = await ensureTargetSession(file.name.replace(/\.zip$/i, ""));
      setStatusText(`Importation de ${Object.keys(extracted).length} fichiers...`);

      const res = await fetch(`/api/sessions/${targetSessionId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: extracted }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'import");

      setSuccessCount(data.count || Object.keys(extracted).length);
      onImportSuccess?.();

      if (!sessionId) {
        router.push(`/chat/${targetSessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import du ZIP");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const handleGithubImport = async () => {
    if (!githubUrl.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setStatusText("Clonage et extraction des fichiers depuis GitHub...");

    try {
      const repoNameMatch = githubUrl.match(/github\.com\/[^/]+\/([^/]+)/);
      const title = repoNameMatch ? repoNameMatch[1] : "Dépôt GitHub";
      const targetSessionId = await ensureTargetSession(title);

      const res = await fetch(`/api/sessions/${targetSessionId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: githubUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'importer le dépôt GitHub");

      setSuccessCount(data.count);
      onImportSuccess?.();

      if (!sessionId) {
        router.push(`/chat/${targetSessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'importation");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#e5e0d8] bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#eee9e1]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c6623f]/10 text-[#c6623f]">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#3d3830]">
                Importer un dépôt ou dossier
              </h2>
              <p className="text-xs text-muted-foreground">
                Extrait chaque fichier code par fichier dans l&apos;éditeur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mt-4 flex rounded-lg bg-[#f5f1ea] p-1 text-xs font-medium text-[#5c5348]">
          <button
            onClick={() => setTab("folder")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 transition ${
              tab === "folder" ? "bg-white text-[#3d3830] shadow-sm font-semibold" : "hover:text-[#3d3830]"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#c6623f]" />
            Dossier local
          </button>
          <button
            onClick={() => setTab("github")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 transition ${
              tab === "github" ? "bg-white text-[#3d3830] shadow-sm font-semibold" : "hover:text-[#3d3830]"
            }`}
          >
            <Github className="h-3.5 w-3.5 text-[#3d3830]" />
            GitHub distant
          </button>
          <button
            onClick={() => setTab("zip")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 transition ${
              tab === "zip" ? "bg-white text-[#3d3830] shadow-sm font-semibold" : "hover:text-[#3d3830]"
            }`}
          >
            <FileArchive className="h-3.5 w-3.5 text-amber-600" />
            Archive ZIP
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-5 space-y-4">
          {tab === "folder" && (
            <div className="rounded-xl border-2 border-dashed border-[#e5e0d8] bg-[#faf8f5] p-6 text-center">
              <FolderOpen className="mx-auto h-10 w-10 text-[#c6623f]/80" />
              <p className="mt-2 text-sm font-medium text-[#3d3830]">
                Sélectionnez un dossier sur votre ordinateur
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tous les fichiers de code (.ts, .tsx, .py, .css, etc.) seront scannés récursivement.
              </p>
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is standard for folder picking
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                onChange={handleFolderUpload}
              />
              <Button
                onClick={() => folderInputRef.current?.click()}
                disabled={loading}
                className="mt-4 gap-2 bg-[#3d3830] text-white hover:bg-[#2d2a26]"
              >
                <Upload className="h-4 w-4" />
                Choisir un dossier local
              </Button>
            </div>
          )}

          {tab === "github" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Collez l&apos;adresse d&apos;un dépôt GitHub public (ex: https://github.com/facebook/react) :
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://github.com/owner/repository"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-[#e5e0d8] bg-white px-3 py-2 text-sm text-[#3d3830] focus:border-[#c6623f] focus:outline-none"
                />
                <Button
                  onClick={handleGithubImport}
                  disabled={!githubUrl.trim() || loading}
                  className="bg-[#3d3830] text-white hover:bg-[#2d2a26]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importer"}
                </Button>
              </div>
            </div>
          )}

          {tab === "zip" && (
            <div className="rounded-xl border-2 border-dashed border-[#e5e0d8] bg-[#faf8f5] p-6 text-center">
              <FileArchive className="mx-auto h-10 w-10 text-amber-600/80" />
              <p className="mt-2 text-sm font-medium text-[#3d3830]">
                Glissez ou sélectionnez un fichier .zip
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                L&apos;archive sera décompressée et les fichiers de code injectés dans l&apos;éditeur.
              </p>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleZipUpload}
              />
              <Button
                onClick={() => zipInputRef.current?.click()}
                disabled={loading}
                className="mt-4 gap-2 bg-[#3d3830] text-white hover:bg-[#2d2a26]"
              >
                <Upload className="h-4 w-4" />
                Choisir une archive ZIP
              </Button>
            </div>
          )}

          {/* Progress / Status */}
          {loading && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{statusText}</span>
            </div>
          )}

          {/* Success */}
          {successCount !== null && (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{successCount} fichiers</strong> extraits et chargés avec succès !
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onClose}
                className="h-7 text-xs border-emerald-300"
              >
                Fermer
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
