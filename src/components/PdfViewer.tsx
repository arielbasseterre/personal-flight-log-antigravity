import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Loader2, Download } from 'lucide-react';

interface PdfViewerProps {
  url: string;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [libraryLoaded, setLibraryLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const renderedPagesRef = useRef<{ [key: number]: boolean }>({});

  const isAndroid = /android/i.test(navigator.userAgent);

  // Load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) {
      setLibraryLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = '/assets/pdf.min.js';
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';
      setLibraryLoaded(true);
    };
    script.onerror = () => {
      setError('Error al cargar la librería de PDF.');
      setLoading(false);
    };
    document.body.appendChild(script);
  }, []);

  // Load PDF document
  useEffect(() => {
    if (!libraryLoaded) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    renderedPagesRef.current = {};

    const loadingTask = window.pdfjsLib.getDocument(url);
    loadingTask.promise.then(
      (pdfDoc: any) => {
        if (!isMounted) return;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      },
      (err: any) => {
        console.error('Error loading PDF:', err);
        if (!isMounted) return;
        setError('No se pudo cargar el archivo PDF.');
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [url, libraryLoaded]);

  // Render all pages in a list
  useEffect(() => {
    if (!pdf || numPages === 0) return;

    const renderPages = async () => {
      const container = pagesContainerRef.current;
      if (!container) return;

      // Clear previous canvases if reloading
      container.innerHTML = '';
      renderedPagesRef.current = {};

      const width = container.clientWidth || 375;

      for (let i = 1; i <= numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          
          // Create wrapper for the page
          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'w-full flex justify-center bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 py-2 relative';
          
          const canvas = document.createElement('canvas');
          canvas.className = 'block w-full max-w-full';
          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);

          const context = canvas.getContext('2d');
          if (!context) continue;

          const unscaledViewport = page.getViewport({ scale: 1.0 });
          // Make it fit the container width perfectly
          const fitScale = (width / unscaledViewport.width) * scale;
          const viewport = page.getViewport({ scale: fitScale });

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;
          renderedPagesRef.current[i] = true;
        } catch (err) {
          console.error(`Error rendering page ${i}:`, err);
        }
      }
    };

    renderPages();
  }, [pdf, numPages, scale]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.15, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.15, 0.7));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const handleDownload = async () => {
    if (isAndroid) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const response = await fetch(url);
        const blob = await response.blob();

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
          };
        });
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;

        const fileName = 'Normativa_Anexo_I.pdf';
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents
        });

        const { uri } = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Documents
        });

        await Share.share({
          title: 'Normativa Aeronáutica',
          url: uri,
        });
      } catch (err) {
        console.error('Error downloading PDF:', err);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Normativa_Anexo_I.pdf';
        a.click();
      }
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Normativa_Anexo_I.pdf';
      a.click();
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-slate-900 text-white relative">
      {/* Zoom toolbar */}
      <div className="flex items-center justify-between p-3 bg-[#1a2233] border-b border-slate-800 sticky top-0 z-20 shadow-md">
        <span className="text-xs font-semibold text-slate-400">
          Scroll Continuo ({numPages} Págs)
        </span>
        <div className="flex items-center gap-1 bg-[#101622] rounded-lg p-0.5 border border-slate-800">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.7 || loading}
            className="p-2 hover:bg-slate-800 rounded-md disabled:opacity-30 transition-colors"
            title="Alejar"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[11px] font-mono w-10 text-center text-slate-300">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 2.5 || loading}
            className="p-2 hover:bg-slate-800 rounded-md disabled:opacity-30 transition-colors"
            title="Acercar"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleResetZoom}
            disabled={scale === 1.0 || loading}
            className="p-2 hover:bg-slate-800 rounded-md disabled:opacity-30 transition-colors text-slate-400 hover:text-white"
            title="Ajustar"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Pages Container - Full Width, scrollable, dark background for high contrast */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full flex flex-col items-center bg-slate-950 pb-20">
        {loading && (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="animate-spin text-[#1152d4] mb-3" size={32} />
            <span className="text-sm font-medium text-slate-400">Cargando documento...</span>
          </div>
        )}

        {error && (
          <div className="text-center p-8 bg-slate-900 border border-red-900/30 rounded-2xl max-w-sm mt-8 mx-4">
            <p className="text-red-500 font-bold mb-2">Error</p>
            <p className="text-sm text-slate-400">{error}</p>
          </div>
        )}

        {/* This container will hold canvas elements full width */}
        <div ref={pagesContainerRef} className="w-full flex flex-col items-center" />
      </div>

      {/* Bottom Download Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800 z-20 flex justify-center" style={{ background: 'linear-gradient(to top, #020617, rgba(2, 6, 23, 0.9))' }}>
        <button
          onClick={handleDownload}
          className="w-full max-w-xs bg-[#1152d4] hover:bg-[#1152d4]/90 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-[#1152d4]/20 text-sm"
        >
          <Download size={18} />
          Descargar Normativa (PDF)
        </button>
      </div>
    </div>
  );
};
