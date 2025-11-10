


import React, { useState, useCallback } from 'react';
import { Progress } from '../../types/common';

interface ConversionResult {
    fileName: string;
    jpgUrls: { pageNum: number; url: string }[];
}

export const PdfToJpgConverter = ({ onBack }: { onBack: () => void }) => {
    const [pdfFiles, setPdfFiles] = useState<File[]>([]);
    const [results, setResults] = useState<ConversionResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            // FIX: Explicitly type 'file' as 'File' to resolve the 'unknown' type error, allowing access to the 'type' property for validation.
            const validPDFFiles = Array.from(files).filter((file: File) => file.type === 'application/pdf');
            if (validPDFFiles.length > 0) {
                setPdfFiles(validPDFFiles);
                setResults([]);
                setError('');
            } else {
                setPdfFiles([]);
                setError('Please select valid PDF files.');
            }
        }
    };

    const convertPdfsToJpg = useCallback(async () => {
        if (pdfFiles.length === 0 || !window.pdfjsLib) {
            setError('PDF library not loaded or no files selected.');
            return;
        }

        setIsLoading(true);
        setResults([]);
        setError('');

        let totalPagesProcessed = 0;
        const totalPagesToProcess = await pdfFiles.reduce(async (accPromise, file) => {
            const acc = await accPromise;
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                return acc + pdf.numPages;
            } catch { return acc; }
        }, Promise.resolve(0));


        for (let i = 0; i < pdfFiles.length; i++) {
            const file = pdfFiles[i];
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const numPages = pdf.numPages;
                const pageUrls: { pageNum: number; url: string }[] = [];
                
                for (let j = 1; j <= numPages; j++) {
                    totalPagesProcessed++;
                    setProgress({
                        total: totalPagesToProcess,
                        current: totalPagesProcessed,
                        fileName: `${file.name} (page ${j}/${numPages})`,
                        percentage: Math.round(totalPagesProcessed / totalPagesToProcess * 100),
                        task: 'Converting PDF to JPG...'
                    });
                    const page = await pdf.getPage(j);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport }).promise;
                    pageUrls.push({ pageNum: j, url: canvas.toDataURL('image/jpeg', 0.9) });
                }
                setResults(prevResults => [...prevResults, { fileName: file.name, jpgUrls: pageUrls }]);
            } catch (err) {
                console.error(`Error converting ${file.name}:`, err);
                setError(`Failed to convert ${file.name}. It might be corrupted.`);
            }
        }

        setIsLoading(false);
        setProgress(null);
    // FIX: Removed `totalPagesToProcess` from the dependency array as it is declared within the hook's callback, causing a reference error. The hook correctly depends only on `pdfFiles`.
    }, [pdfFiles]);

    const handleDownloadAllZip = async () => {
        if (!window.JSZip || results.length === 0) return;
        const zip = new window.JSZip();
        results.forEach(result => {
            const folderName = result.fileName.replace(/\.pdf$/i, '');
            const folder = zip.folder(folderName);
            result.jpgUrls.forEach(page => {
                const base64Data = page.url.split(',')[1];
                folder!.file(`page-${page.pageNum}.jpg`, base64Data, { base64: true });
            });
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'converted-pdfs.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <>
            <h1>PDF to JPG Converter</h1>
            <p>Select one or more PDF files to convert all their pages into high-quality JPG images.</p>
            
            <div className="file-dropzone">
                <label htmlFor="pdf-upload" className="file-dropzone-label">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{pdfFiles.length > 0 ? `${pdfFiles.length} PDF(s) Selected` : 'Click to select or drop PDF files here'}</span>
                </label>
                <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} multiple />
                 {pdfFiles.length > 0 && (
                    <div className="file-preview-list">
                        {pdfFiles.map(file => <div className="file-preview-item" key={file.name}>{file.name}</div>)}
                    </div>
                )}
            </div>
            
            {error && <p style={{ color: '#ff8a8a', textAlign: 'center' }}>{error}</p>}
            
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={convertPdfsToJpg} disabled={pdfFiles.length === 0 || isLoading} aria-live="polite">{isLoading ? 'Converting...' : 'Convert to JPG'}</button>
            </div>
            
            {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <div className="progress-bar-container">
                         <div className="progress-bar-fill" style={{ width: `${progress.percentage}%` }}></div>
                    </div>
                    <p className="progress-text">{progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}
            
            {results.length > 0 && !isLoading && (
                <div className="result-section">
                    <h2>Conversion Results</h2>
                    <div className="download-actions">
                        <button className="btn btn-primary" onClick={handleDownloadAllZip}>Download All (.zip)</button>
                    </div>
                    {results.map(result => (
                        <div key={result.fileName} className="result-file-group">
                            <h3>{result.fileName}</h3>
                            <div className="image-grid">
                                {result.jpgUrls.map(page => (
                                    <div key={page.pageNum} className="image-grid-item">
                                        <img src={page.url} alt={`Page ${page.pageNum} of ${result.fileName}`} />
                                        <a href={page.url} download={`${result.fileName.replace(/\.pdf$/i, '')}-page-${page.pageNum}.jpg`} className="download-overlay">Download Page {page.pageNum}</a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};