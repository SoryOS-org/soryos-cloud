"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstallButton({ className = "" }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true
    );
  });

  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });

  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstall}
        className={`gap-1.5 border-[#e5e0d8] bg-white text-xs font-semibold text-[#5c5348] hover:border-[#c6623f] hover:text-[#c6623f] ${className}`}
        title="Installer l'application sur Mobile, Tablette ou Bureau"
      >
        <Download className="h-3.5 w-3.5 text-[#c6623f]" />
        <span className="hidden sm:inline">Installer l&apos;application</span>
        <span className="sm:hidden">Installer</span>
      </Button>

      {/* iOS Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl border border-[#e5e0d8] bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-[#eee9e1]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c6623f]/10 text-[#c6623f]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#3d3830]">
                  Installer sur iPhone / iPad
                </h3>
                <p className="text-xs text-muted-foreground">
                  Accédez à CodeForge comme une vraie app
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-[#5c5348] leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f5f1ea] font-bold text-[#c6623f]">
                  1
                </span>
                <p>
                  Touchez le bouton <strong>Partager</strong> (icône carré avec flèche vers le haut) dans la barre de Safari.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f5f1ea] font-bold text-[#c6623f]">
                  2
                </span>
                <p>
                  Faites défiler et touchez <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f5f1ea] font-bold text-[#c6623f]">
                  3
                </span>
                <p>
                  Touchez <strong>Ajouter</strong> en haut à droite pour lancer l&apos;app en plein écran sans barre de navigateur !
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full bg-[#3d3830] text-white hover:bg-[#2d2a26]"
            >
              Compris
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
