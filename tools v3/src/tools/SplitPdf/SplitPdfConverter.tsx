
import React, { useState } from 'react';
import { Progress } from '../../types/common';

export const SplitPdfConverter = ({ onBack }: { onBack: () => void }) => {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setError('');
        } else {
            setPdfFile(null);
            setError('Please select a single, valid PDF file.');
        }
    };

    const splitPdf = async () => {
        if (!pdfFile || !window.PDFLib || !window.JSZip) {
            setError('Required libraries not loaded or no file selected.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { PDFDocument } = window.PDFLib;
            const zip = new window.JSZip();
            const originalPdfBytes = await pdfFile.arrayBuffer();
            const originalPdf = await PDFDocument.load(originalPdfBytes);
            const numPages = originalPdf.getPageCount();
            const fileName = pdfFile.name.replace(/\.pdf$/i, '');

            for (let i = 0; i < numPages; i++) {
                 setProgress({
                    total: numPages,
                    current: i + 1,
                    fileName: `${fileName}-page-${i + 1}.pdf`,
                    percentage: Math.round(((i + 1) / numPages) * 100),
                    task: 'Splitting PDF...'
                });

                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(originalPdf, [i]);
                newPdf.addPage(copiedPage);
                const newPdfBytes = await newPdf.save();
                zip.file(`${fileName}-page-${i + 1}.pdf`, newPdfBytes);
            }
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `${fileName}-split.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (err) {
            console.error('Error splitting PDF:', err);
            setError('An error occurred during the splitting process.');
        }

        setProgress(null);
        setIsLoading(false);
    };

    return (
        <>
            <h1>Split PDF</h1>
            <p>Select a PDF file to split each page into a separate document.</p>
            
            <div className="file-dropzone">
                <label htmlFor="pdf-upload" className="file-dropzone-label">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{pdfFile ? pdfFile.name : 'Click to select or drop a PDF file here'}</span>
                </label>
                <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} />
            </div>

            {error && <p style={{ color: '#ff8a8a', textAlign: 'center' }}>{error}</p>}
            
            {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <div className="progress-bar-container">
                         <div className="progress-bar-fill" style={{ width: `${progress.percentage}%` }}></div>
                    </div>
                    <p className="progress-text">Creating: {progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}

            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={splitPdf} disabled={!pdfFile || isLoading} aria-live="polite">{isLoading ? 'Splitting...' : 'Split PDF'}</button>
            </div>
        </>
    );
};
