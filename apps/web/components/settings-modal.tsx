"use client";

import { useState } from "react";
import {
  X,
  Cloud,
  Boxes,
  Layers,
  Terminal,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useCloudCredentials } from "@/hooks/use-cloud-credentials";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProviderId?: string;
}

export function SettingsModal({
  isOpen,
  onClose,
  defaultProviderId = "e2b",
}: SettingsModalProps) {
  const {
    providers,
    definitions,
    saveCredentials,
    testConnection,
    removeCredentials,
  } = useCloudCredentials();

  const [activeTab, setActiveTab] = useState<string>(defaultProviderId);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; type: "success" | "error"; message: string } | null>(null);

  if (!isOpen) return null;

  const currentDef = definitions[activeTab];
  const currentStatus = providers.find((p) => p.id === activeTab);
  const currentForm = formValues[activeTab] || {};

  const handleInputChange = (providerId: string, fieldKey: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleSave = async (providerId: string) => {
    setSavingId(providerId);
    setFeedback(null);
    try {
      const values = formValues[providerId] || {};
      const status = await saveCredentials(providerId, values);
      setFeedback({
        id: providerId,
        type: "success",
        message: `✓ Identifiants ${status.name} enregistrés avec succès.`,
      });
      setFormValues((prev) => ({
        ...prev,
        [providerId]: {},
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Échec de sauvegarde";
      setFeedback({
        id: providerId,
        type: "error",
        message: msg,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleTest = async (providerId: string) => {
    setTestingId(providerId);
    setFeedback(null);
    try {
      const res = await testConnection(providerId);
      setFeedback({
        id: providerId,
        type: res.success ? "success" : "error",
        message: res.message,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Échec du test de connexion";
      setFeedback({
        id: providerId,
        type: "error",
        message: msg,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (providerId: string) => {
    setSavingId(providerId);
    setFeedback(null);
    try {
      await removeCredentials(providerId);
      setFormValues((prev) => ({
        ...prev,
        [providerId]: {},
      }));
      setFeedback({
        id: providerId,
        type: "success",
        message: "Identifiants supprimés.",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#faf8f5]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c6623f]/10 text-[#c6623f]">
              <Cloud className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Paramètres des Cloud Providers
              </h2>
              <p className="text-xs text-slate-500">
                Configurez vos clés d&apos;authentification et tokens API pour les environnements distants.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden">
          {/* Provider List Sidebar */}
          <div className="w-full sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 bg-[#faf8f5]/60 p-2 sm:p-3 space-y-1 overflow-x-auto sm:overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Fournisseurs
            </div>

            {providers.map((p) => {
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveTab(p.id);
                    setFeedback(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {p.id === "e2b" ? (
                      <Boxes className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : p.id === "vercel" ? (
                      <Layers className="h-4 w-4 text-slate-900 shrink-0" />
                    ) : (
                      <Terminal className="h-4 w-4 text-blue-600 shrink-0" />
                    )}
                    <span className="truncate">{p.name}</span>
                  </div>

                  {p.configured && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Configuration Form Panel */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {currentDef && (
              <div className="space-y-4">
                {/* Header for Selected Provider */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {currentDef.name}
                      </h3>
                      {currentStatus?.configured ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Connecté
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Non configuré
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {currentDef.description}
                    </p>
                  </div>
                </div>

                {/* Masked Key Display if Already Configured */}
                {currentStatus?.configured && currentStatus.maskedKey && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-slate-400" />
                        Clé actuelle enregistrée (Sécurisée) :
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(currentDef.id)}
                        disabled={savingId === currentDef.id}
                        className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Effacer</span>
                      </button>
                    </div>
                    <div className="font-mono text-xs text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 select-all">
                      {currentStatus.maskedKey}
                    </div>
                  </div>
                )}

                {/* Feedback Message */}
                {feedback && feedback.id === currentDef.id && (
                  <div
                    className={`flex items-start gap-2 p-3 text-xs rounded-xl border ${
                      feedback.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    {feedback.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{feedback.message}</span>
                  </div>
                )}

                {/* Fields Form */}
                <div className="space-y-3 pt-1">
                  <div className="text-xs font-bold text-slate-700">
                    {currentStatus?.configured ? "Mettre à jour les identifiants" : "Renseigner les identifiants"}
                  </div>

                  {currentDef.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 block">
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          rows={4}
                          value={currentForm[field.key] || ""}
                          onChange={(e) => handleInputChange(currentDef.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#c6623f] focus:outline-none focus:ring-1 focus:ring-[#c6623f]"
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={currentForm[field.key] || ""}
                          onChange={(e) => handleInputChange(currentDef.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#c6623f] focus:outline-none focus:ring-1 focus:ring-[#c6623f]"
                        />
                      )}
                      {field.description && (
                        <p className="text-[11px] text-slate-500">
                          {field.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions: Save & Test Connection */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleSave(currentDef.id)}
                    disabled={savingId === currentDef.id}
                    className="py-2 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === currentDef.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Enregistrer</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTest(currentDef.id)}
                    disabled={testingId === currentDef.id || (!currentStatus?.configured && !Object.values(currentForm).some((v) => v.trim()))}
                    className="py-2 px-4 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {testingId === currentDef.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c6623f]" />
                        <span>Test en cours...</span>
                      </>
                    ) : (
                      <span>Tester la connexion</span>
                    )}
                  </button>

                  {currentDef.id === "e2b" && (
                    <a
                      href="https://e2b.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[11px] text-[#c6623f] hover:underline flex items-center gap-1"
                    >
                      <span>Obtenir une clé E2B</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {currentDef.id === "vercel" && (
                    <a
                      href="https://vercel.com/account/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[11px] text-[#c6623f] hover:underline flex items-center gap-1"
                    >
                      <span>Obtenir un token Vercel</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
