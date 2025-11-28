import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface ScoreViewerProps {
    pdfUrl: string;
    onClose: () => void;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({ pdfUrl, onClose }) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(true);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setIsLoading(false);
    }

    function onDocumentLoadError(error: Error) {
        console.error('Error loading PDF:', error);
        setIsLoading(false);
    }

    const changePage = (offset: number) => {
        setPageNumber(prevPageNumber => {
            const newPage = prevPageNumber + offset;
            return Math.max(1, Math.min(newPage, numPages));
        });
    };

    const previousPage = () => changePage(-1);
    const nextPage = () => changePage(1);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') previousPage();
            if (e.key === 'ArrowRight') nextPage();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [numPages]); // Dependency on numPages to ensure bounds are correct if used inside changePage, though updater form handles it.

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xs flex items-center justify-center p-4">
            {/* Close Button */}
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 z-[110] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all hover:scale-110"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>

            <div className="relative flex flex-col items-center max-h-full w-full max-w-6xl">
                
                {/* Main Content */}
                <div className="relative flex items-center justify-center w-full h-full min-h-[500px]">
                    
                    {/* Left Arrow */}
                    <button 
                        onClick={previousPage} 
                        disabled={pageNumber <= 1}
                        className="fixed left-4 top-1/2 -translate-y-1/2 z-[120] p-4 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>

                    {/* PDF Document */}
                    <div className="bg-white shadow-2xl max-h-[90vh] overflow-auto scrollbar-hide rounded-md border border-neutral-800">
                        <Document
                            file={pdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                                <div className="flex items-center justify-center w-[600px] h-[800px] bg-neutral-900 text-white">
                                    Loading PDF...
                                </div>
                            }
                            error={
                                <div className="flex items-center justify-center w-[600px] h-[400px] bg-neutral-900 text-red-400 p-8 text-center">
                                    Failed to load PDF. <br/> It might be missing or corrupted.
                                </div>
                            }
                        >
                            {/* Pre-render all pages but hide inactive ones to solve flickering */}
                            {Array.from(new Array(numPages), (_, index) => (
                                <div key={index} style={{ display: pageNumber === index + 1 ? 'block' : 'none' }}>
                                    <Page 
                                        pageNumber={index + 1} 
                                        renderTextLayer={false} 
                                        renderAnnotationLayer={false}
                                        className="max-w-full h-auto"
                                        height={window.innerHeight * 0.9} 
                                    />
                                </div>
                            ))}
                        </Document>
                    </div>

                    {/* Right Arrow */}
                    <button 
                        onClick={nextPage} 
                        disabled={pageNumber >= numPages}
                        className="fixed right-4 top-1/2 -translate-y-1/2 z-[120] p-4 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                </div>

                {/* Page Indicator */}
                {!isLoading && numPages > 0 && (
                    <div className="mt-4 px-4 py-2 bg-black/50 backdrop-blur rounded-full text-white text-sm font-medium border border-white/10">
                        Page {pageNumber} of {numPages}
                    </div>
                )}
            </div>
        </div>
    );
};


