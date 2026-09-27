import React, { useState, useEffect } from 'react';
import { Smartphone, Share, PlusSquare, X, Download, MoreVertical, CheckCircle2 } from 'lucide-react';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).deferredPwaPrompt || null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [installed, setInstalled] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect if running standalone (already installed as PWA)
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

    // 3. Detect mobile platform / user agent
    const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();
    const iosCheck = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const androidCheck = /android/i.test(ua);
    const mobileCheck = androidCheck || iosCheck || /mobile|tablet|kindle|silk|opera mini/i.test(ua) || (window.innerWidth <= 768);

    setIsMobile(mobileCheck);
    setIsIOS(iosCheck);
    setIsAndroid(androidCheck);

    // 4. Check global prompt if captured prior to mount
    if ((window as any).deferredPwaPrompt) {
      setDeferredPrompt((window as any).deferredPwaPrompt);
    }

    // 5. Event listeners for beforeinstallprompt and appinstalled
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredPwaPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPwaPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setInstalled(true);
          localStorage.setItem('pwa_install_banner_dismissed', 'true');
        }
        setDeferredPrompt(null);
        (window as any).deferredPwaPrompt = null;
      } catch (err) {
        console.error('Error al solicitar instalación nativa:', err);
        setShowInstructions(true);
      }
    } else {
      // If no native prompt event is available yet, show browser instructions
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_install_banner_dismissed', 'true');
  };

  // If running in standalone app, or dismissed, or installed, or not mobile -> hide
  if (isStandalone || dismissed || installed || !isMobile) {
    return null;
  }

  const promptAvailable = !!(deferredPrompt || (window as any).deferredPwaPrompt);

  return (
    <div className="mb-4 mx-2 sm:mx-0 p-4 rounded-2xl bg-gradient-to-r from-blue-950/95 via-indigo-950/95 to-slate-900/95 border border-blue-500/30 text-white shadow-xl backdrop-blur-md transition-all animate-fadeIn">
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
              Accedé con un toque desde tu pantalla de inicio y usala a pantalla completa.
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

      {/* Primary Action Button */}
      <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-300">
          {isIOS 
            ? 'Disponible para Safari en iPhone/iPad' 
            : promptAvailable 
              ? '¿Instalar aplicación en tu dispositivo?' 
              : 'Agregala a tu pantalla de inicio'}
        </span>

        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 shrink-0"
        >
          {promptAvailable ? (
            <>
              <Download className="w-4 h-4" />
              Instalar App
            </>
          ) : isIOS ? (
            <>
              <Share className="w-3.5 h-3.5" />
              Ver instrucciones
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Instalar App
            </>
          )}
        </button>
      </div>

      {/* Step-by-Step Instructions Panel */}
      {showInstructions && (
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-blue-400/30 space-y-2 mt-3 animate-fadeIn">
          {isIOS ? (
            <>
              <p className="text-xs font-bold text-blue-300">Pasos para instalar en iPhone / iPad:</p>
              <ol className="text-xs text-slate-200 space-y-2 list-decimal list-inside pl-1">
                <li className="leading-snug">
                  Toca el botón <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/10"><Share className="w-3.5 h-3.5 text-blue-400 inline" /> Compartir</strong> en la barra inferior de Safari.
                </li>
                <li className="leading-snug">
                  Desplázate hacia abajo y elige <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/10"><PlusSquare className="w-3.5 h-3.5 text-blue-400 inline" /> Agregar a inicio</strong> (Add to Home Screen).
                </li>
              </ol>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-blue-300">Pasos para instalar en Android (Chrome / Edge / Samsung):</p>
              <ol className="text-xs text-slate-200 space-y-2 list-decimal list-inside pl-1">
                <li className="leading-snug">
                  Toca el menú de opciones <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/10"><MoreVertical className="w-3.5 h-3.5 text-blue-400 inline" /> (3 puntos)</strong> arriba a la derecha en tu navegador.
                </li>
                <li className="leading-snug">
                  Selecciona <strong className="text-white inline-flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/10"><Download className="w-3.5 h-3.5 text-blue-400 inline" /> Agregar a pantalla principal</strong> o <strong>Instalar aplicación</strong>.
                </li>
              </ol>
            </>
          )}

          <div className="pt-1 flex justify-end">
            <button
              onClick={() => setShowInstructions(false)}
              className="text-[11px] text-slate-400 hover:text-white underline"
            >
              Cerrar guía
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
