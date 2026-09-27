import React, { useState, useEffect } from 'react';
import { Smartphone, Share, PlusSquare, X, Download } from 'lucide-react';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [installed, setInstalled] = useState<boolean>(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect if running standalone (already installed)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // 2. Check dismissal status
    const isDismissed = localStorage.getItem('pwa_install_banner_dismissed') === 'true';
    setDismissed(isDismissed);

    // 3. Detect user agent / device
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const mobileCheck = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const iosCheck = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const androidCheck = /android/i.test(ua);

    setIsMobile(mobileCheck);
    setIsIOS(iosCheck);
    setIsAndroid(androidCheck);

    // 4. Listen for beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        setShowIOSInstructions(true);
      }
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
        localStorage.setItem('pwa_install_banner_dismissed', 'true');
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Error al solicitar instalación:', err);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_install_banner_dismissed', 'true');
  };

  // If already running inside standalone app, or user dismissed, or not a mobile device, don't show
  if (isStandalone || dismissed || installed || !isMobile) {
    return null;
  }

  return (
    <div className="mb-4 mx-2 sm:mx-0 p-4 rounded-2xl bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-slate-900/90 border border-blue-500/30 text-white shadow-xl backdrop-blur-md transition-all animate-fadeIn">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/20 shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-semibold text-sm sm:text-base text-white flex items-center gap-2 flex-wrap">
              Instalá Personal Flight Log
              <span className="text-[10px] bg-blue-500/30 text-blue-300 font-medium px-2 py-0.5 rounded-full border border-blue-400/30 uppercase tracking-wider">
                App Móvil
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Accedé de forma rápida desde tu pantalla de inicio y disfrutá de la experiencia a pantalla completa.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          title="Descartar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action area for Android / Chromium with prompt support */}
      {deferredPrompt && (
        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300">¿Deseas agregarla a tu teléfono?</span>
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <Download className="w-4 h-4" />
            Instalar App
          </button>
        </div>
      )}

      {/* Action area for iOS (iPhone/iPad) or Android without direct event prompt */}
      {(!deferredPrompt || isIOS) && (
        <div className="mt-3.5 pt-3 border-t border-white/10">
          {isIOS ? (
            <div>
              {!showIOSInstructions ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300">Disponible para Safari en iPhone/iPad</span>
                  <button
                    onClick={() => setShowIOSInstructions(true)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-md transition-all shrink-0"
                  >
                    <Share className="w-3.5 h-3.5" />
                    Cómo instalar en iOS
                  </button>
                </div>
              ) : (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-white/10 space-y-2 mt-1 animate-fadeIn">
                  <p className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                    <span>Pasos para instalar en iPhone/iPad:</span>
                  </p>
                  <ol className="text-xs text-slate-200 space-y-2 list-decimal list-inside pl-1">
                    <li className="leading-snug">
                      Toca el botón <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/10"><Share className="w-3.5 h-3.5 text-blue-400 inline" /> Compartir</strong> en la barra inferior de Safari.
                    </li>
                    <li className="leading-snug">
                      Desplázate hacia abajo y selecciona <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/10"><PlusSquare className="w-3.5 h-3.5 text-blue-400 inline" /> Agregar a inicio</strong> (Add to Home Screen).
                    </li>
                  </ol>
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => setShowIOSInstructions(false)}
                      className="text-[11px] text-slate-400 hover:text-white underline"
                    >
                      Ocultar instrucciones
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-300">
                Podés agregar la app desde el menú de opciones de tu navegador ({isAndroid ? 'Chrome/Edge: "Agregar a pantalla principal"' : 'Menú (...) -> Instalar'}).
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
