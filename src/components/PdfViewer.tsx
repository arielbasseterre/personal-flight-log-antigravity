import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';

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
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [libraryLoaded, setLibraryLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) {
      setLibraryLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setLibraryLoaded(true);
    };
    script.onerror = () => {
      setError('Error al cargar la librería de PDF.');
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      // Keep script loaded to avoid multiple injections
    };
  }, []);

  // Load PDF document
  useEffect(() => {
    if (!libraryLoaded) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadingTask = window.pdfjsLib.getDocument(url);
    loadingTask.promise.then(
      (pdfDoc: any) => {
        if (!isMounted) return;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPageNum(1);
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

  // Render Page
  useEffect(() => {
    if (!pdf) return;

    // Cancel existing render task if any
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    setLoading(true);

    pdf.getPage(pageNum).then((page: any) => {
      // Adjust scale based on viewport width for responsive design
      const containerWidth = canvas.parentElement?.clientWidth || 350;
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const responsiveScale = (containerWidth / unscaledViewport.width) * scale;
      
      const viewport = page.getViewport({ scale: responsiveScale });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      renderTask.promise.then(
        () => {
          setLoading(false);
          renderTaskRef.current = null;
        },
        (err: any) => {
          if (err.name !== 'RenderingCancelledException') {
            console.error('Error rendering page:', err);
            setLoading(false);
          }
        }
      );
    });

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdf, pageNum, scale]);

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(pageNum + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Controls toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-[#1a2233] border-b border-slate-200 dark:border-[#2d3748] sticky top-0 z-20 shadow-sm">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1 || loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Página Anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold px-2 min-w-[70px] text-center">
            {pageNum} / {numPages || '?'}
          </span>
          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages || loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Siguiente Página"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
            title="Alejar"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs font-mono px-1 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
            title="Acercar"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleResetZoom}
            disabled={scale === 1.0 || loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
            title="Restaurar zoom"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="flex-1 overflow-auto p-4 flex justify-center items-start relative min-h-0">
        {loading && (
          <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="bg-white dark:bg-[#1a2233] p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-200 dark:border-[#2d3748]">
              <Loader2 className="animate-spin text-[#1152d4]" size={24} />
              <span className="text-sm font-medium">Cargando página...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="text-center p-8 bg-white dark:bg-[#1a2233] rounded-2xl border border-red-200 dark:border-red-900/30 max-w-sm mt-8 mx-auto shadow-sm">
            <p className="text-red-500 font-bold mb-2">Error</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden transition-all duration-200">
            <canvas ref={canvasRef} className="block max-w-full" />
          </div>
        )}
      </div>
    </div>
  );
};
