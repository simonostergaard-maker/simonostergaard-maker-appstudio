

import React, { useState } from 'react';
import { Progress } from '../../types/common';

export const MergePdfConverter = ({ onBack }: { onBack: () => void }) => {
    const [pdfFiles, setPdfFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            // FIX: Explicitly type 'file' as 'File' to resolve the 'unknown' type error, allowing access to the 'type' property for validation.
            const validPDFFiles = Array.from(files).filter((file: File) => file.type === 'application/pdf');
            if (validPDFFiles.length > 1) {
                setPdfFiles(validPDFFiles);
                setError('');
            } else {
                setPdfFiles([]);
                setError('Please select two or more PDF files to merge.');
            }
        }
    };

    const mergePdfs = async () => {
        if (pdfFiles.length < 2 || !window.PDFLib) {
            setError('PDF library not loaded or fewer than two files selected.');
            return;
        }

        setIsLoading(true);
        setError('');
        setProgress({ total: pdfFiles.length, current: 0, fileName: '', percentage: 0, task: 'Merging PDFs...'});

        try {
            const { PDFDocument } = window.PDFLib;
            const mergedPdf = await PDFDocument.create();

            for (let i = 0; i < pdfFiles.length; i++) {
                const file = pdfFiles[i];
                 setProgress({
                    total: pdfFiles.length,
                    current: i + 1,
                    fileName: file.name,
                    percentage: Math.round(((i + 1) / pdfFiles.length) * 100),
                    task: 'Merging PDFs...'
                });

                const pdfBytes = await file.arrayBuffer();
                const pdf = await PDFDocument.load(pdfBytes);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'merged.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (err) {
            console.error('Error merging PDFs:', err);
            setError('An error occurred during the merge process.');
        }

        setProgress(null);
        setIsLoading(false);
    };

    return (
        <>
            <h1>Merge PDFs</h1>
            <p>Select two or more PDF files to combine them into a single document.</p>
            
            <div className="file-dropzone">
                <label htmlFor="pdf-upload" className="file-dropzone-label">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{pdfFiles.length > 0 ? `${pdfFiles.length} PDFs Selected` : 'Click to select or drop PDF files here'}</span>
                </label>
                <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} multiple />
                 {pdfFiles.length > 0 && (
                    <div className="file-preview-list">
                        {pdfFiles.map(file => <div className="file-preview-item" key={file.name}>{file.name}</div>)}
                    </div>
                )}
            </div>

            {error && <p style={{ color: '#ff8a8a', textAlign: 'center' }}>{error}</p>}

            {isLoading && progress && (
                <div className="progress-section">
                    <p>{progress.task}</p>
                     <div className="progress-bar-container">
                         <div className="progress-bar-fill" style={{ width: `${progress.percentage}%` }}></div>
                    </div>
                    <p className="progress-text">Adding: {progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}

            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={mergePdfs} disabled={pdfFiles.length < 2 || isLoading} aria-live="polite">{isLoading ? 'Merging...' : 'Merge PDFs'}</button>
            </div>
        </>
    );
};