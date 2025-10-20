import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// Add pdfjsLib, JSZip, PDFLib, and imageCompression to the Window interface to fix TypeScript errors.
declare global {
    interface Window {
        pdfjsLib: any;
        JSZip: any;
        PDFLib: any;
        imageCompression: any;
    }
}

// Set workerSrc for pdf.js
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
}

// ===== Helper Functions =====
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


// ===== PDF to JPG Converter Component =====
interface ConversionResult {
    fileName: string;
    jpgUrls: { pageNum: number; url: string }[];
}

interface Progress {
    total: number;
    current: number;
    fileName: string;
    percentage: number;
    task: string;
}

const PdfToJpgConverter = ({ onBack }: { onBack: () => void }) => {
    const [pdfFiles, setPdfFiles] = useState<File[]>([]);
    const [results, setResults] = useState<ConversionResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const validPDFFiles = Array.from(files).filter(file => file.type === 'application/pdf');
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
            <div className="upload-section">
                <label htmlFor="pdf-upload" className="file-label" role="button" tabIndex={0} aria-label="Upload PDF files">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{pdfFiles.length > 0 ? `${pdfFiles.length} PDF(s) Selected` : 'Choose PDF files'}</span>
                </label>
                <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} multiple aria-hidden="true" />
                {pdfFiles.length > 0 && (<div className="file-name-list">{pdfFiles.map(file => <div className="file-name" key={file.name}>{file.name}</div>)}</div>)}
            </div>
            {error && <p style={{ color: '#ff8a8a' }}>{error}</p>}
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={convertPdfsToJpg} disabled={pdfFiles.length === 0 || isLoading} aria-live="polite">{isLoading ? 'Converting...' : 'Convert to JPG'}</button>
            </div>
            {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <progress value={progress.percentage} max="100"></progress>
                    <p style={{marginTop: '16px', fontSize: '16px', opacity: 0.8}}>{progress.fileName} ({progress.percentage}%)</p>
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
                                    <div key={page.pageNum} className="image-container">
                                        <img src={page.url} alt={`Page ${page.pageNum} of ${result.fileName}`} />
                                        <a href={page.url} download={`${result.fileName.replace(/\.pdf$/i, '')}-page-${page.pageNum}.jpg`} className="download-link">Download Page {page.pageNum}</a>
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

// ===== Images to PDF Converter Component =====
const ImagesToPdfConverter = ({ onBack }: { onBack: () => void }) => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const validImageFiles = Array.from(files).filter(file => file.type === 'image/jpeg' || file.type === 'image/png');
            if (validImageFiles.length > 0) {
                setImageFiles(validImageFiles);
                setError('');
            } else {
                setImageFiles([]);
                setError('Please select valid JPG or PNG files.');
            }
        }
    };

    const convertImagesToPdf = async () => {
        if (imageFiles.length === 0 || !window.PDFLib) {
            setError('PDF library not loaded or no image files selected.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { PDFDocument } = window.PDFLib;
            const pdfDoc = await PDFDocument.create();

            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                 setProgress({
                    total: imageFiles.length,
                    current: i + 1,
                    fileName: file.name,
                    percentage: Math.round(((i + 1) / imageFiles.length) * 100),
                    task: 'Adding images to PDF...'
                });

                const arrayBuffer = await file.arrayBuffer();
                let image;
                if (file.type === 'image/png') {
                    image = await pdfDoc.embedPng(arrayBuffer);
                } else {
                    image = await pdfDoc.embedJpg(arrayBuffer);
                }

                const page = pdfDoc.addPage();
                const { width, height } = image.scale(1);
                const { width: pageWidth, height: pageHeight } = page.getSize();
                
                const widthRatio = pageWidth / width;
                const heightRatio = pageHeight / height;
                const ratio = Math.min(widthRatio, heightRatio);
                const scaledWidth = width * ratio;
                const scaledHeight = height * ratio;

                page.drawImage(image, {
                    x: (pageWidth - scaledWidth) / 2,
                    y: (pageHeight - scaledHeight) / 2,
                    width: scaledWidth,
                    height: scaledHeight,
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'converted-images.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (err) {
            console.error('Error converting images to PDF:', err);
            setError('An error occurred during the conversion process.');
        }
        
        setProgress(null);
        setIsLoading(false);
    };

    return (
        <>
            <h1>Images to PDF Converter</h1>
            <p>Select multiple JPG or PNG images to combine them into a single PDF file.</p>
            <div className="upload-section">
                <label htmlFor="image-upload" className="file-label" role="button" tabIndex={0} aria-label="Upload image files">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{imageFiles.length > 0 ? `${imageFiles.length} Image(s) Selected` : 'Choose JPG or PNG files'}</span>
                </label>
                <input id="image-upload" type="file" accept="image/jpeg,image/png" onChange={handleFileChange} multiple aria-hidden="true" />
                {imageFiles.length > 0 && (<div className="file-name-list">{imageFiles.map(file => <div className="file-name" key={file.name}>{file.name}</div>)}</div>)}
            </div>
            {error && <p style={{ color: '#ff8a8a' }}>{error}</p>}
             {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <progress value={progress.percentage} max="100"></progress>
                    <p style={{marginTop: '16px', fontSize: '16px', opacity: 0.8}}>{progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={convertImagesToPdf} disabled={imageFiles.length === 0 || isLoading} aria-live="polite">{isLoading ? 'Converting...' : 'Convert to PDF'}</button>
            </div>
        </>
    );
};


// ===== Merge PDF Component =====
const MergePdfConverter = ({ onBack }: { onBack: () => void }) => {
    const [pdfFiles, setPdfFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const validPDFFiles = Array.from(files).filter(file => file.type === 'application/pdf');
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
            <div className="upload-section">
                <label htmlFor="pdf-upload" className="file-label" role="button" tabIndex={0} aria-label="Upload PDF files">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{pdfFiles.length > 0 ? `${pdfFiles.length} PDFs Selected` : 'Choose PDF files'}</span>
                </label>
                <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} multiple aria-hidden="true" />
                {pdfFiles.length > 0 && (<div className="file-name-list">{pdfFiles.map(file => <div className="file-name" key={file.name}>{file.name}</div>)}</div>)}
            </div>
            {error && <p style={{ color: '#ff8a8a' }}>{error}</p>}
            {isLoading && progress && (
                <div className="progress-section">
                    <p>{progress.task}</p>
                    <progress value={progress.percentage} max="100"></progress>
                    <p style={{ marginTop: '16px', fontSize: '16px', opacity: 0.8 }}>Adding: {progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={mergePdfs} disabled={pdfFiles.length < 2 || isLoading} aria-live="polite">{isLoading ? 'Merging...' : 'Merge PDFs'}</button>
            </div>
        </>
    );
};

// ===== Split PDF Component =====
const SplitPdfConverter = ({ onBack }: { onBack: () => void }) => {
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
            <div className="upload-section">
                <label htmlFor="pdf-upload" className="file-label" role="button" tabIndex={0} aria-label="Upload PDF file">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{pdfFile ? pdfFile.name : 'Choose a PDF file'}</span>
                </label>
                <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} aria-hidden="true" />
            </div>
            {error && <p style={{ color: '#ff8a8a' }}>{error}</p>}
            {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <progress value={progress.percentage} max="100"></progress>
                    <p style={{marginTop: '16px', fontSize: '16px', opacity: 0.8}}>Creating: {progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={splitPdf} disabled={!pdfFile || isLoading} aria-live="polite">{isLoading ? 'Splitting...' : 'Split PDF'}</button>
            </div>
        </>
    );
};


// ===== Compress Image Component =====
interface CompressionResult {
    originalFile: File;
    compressedFile: File;
    originalSize: number;
    compressedSize: number;
}
const CompressImageConverter = ({ onBack }: { onBack: () => void }) => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [results, setResults] = useState<CompressionResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const validImageFiles = Array.from(files).filter(file => file.type === 'image/jpeg' || file.type === 'image/png');
            if (validImageFiles.length > 0) {
                setImageFiles(validImageFiles);
                setResults([]);
                setError('');
            } else {
                setImageFiles([]);
                setError('Please select valid JPG or PNG files.');
            }
        }
    };

    const compressImages = async () => {
        if (imageFiles.length === 0 || !window.imageCompression) {
            setError('Compression library not loaded or no files selected.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResults([]);

        const compressionResults: CompressionResult[] = [];
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
        };

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            setProgress({
                total: imageFiles.length,
                current: i + 1,
                fileName: file.name,
                percentage: Math.round(((i + 1) / imageFiles.length) * 100),
                task: 'Compressing images...'
            });
            try {
                const compressedFile = await window.imageCompression(file, options);
                compressionResults.push({
                    originalFile: file,
                    compressedFile,
                    originalSize: file.size,
                    compressedSize: compressedFile.size
                });
            } catch (err) {
                console.error(`Error compressing ${file.name}:`, err);
                setError(`Failed to compress ${file.name}.`);
            }
        }
        
        setResults(compressionResults);
        setProgress(null);
        setIsLoading(false);
    };
    
    const handleDownloadAllZip = async () => {
        if (!window.JSZip || results.length === 0) return;
        const zip = new window.JSZip();
        results.forEach(result => {
            zip.file(result.compressedFile.name, result.compressedFile);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'compressed-images.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <>
            <h1>Compress Images</h1>
            <p>Reduce the file size of your JPG and PNG images without losing significant quality.</p>
            <div className="upload-section">
                <label htmlFor="image-upload" className="file-label" role="button" tabIndex={0} aria-label="Upload image files">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{imageFiles.length > 0 ? `${imageFiles.length} Image(s) Selected` : 'Choose JPG or PNG files'}</span>
                </label>
                <input id="image-upload" type="file" accept="image/jpeg,image/png" onChange={handleFileChange} multiple aria-hidden="true" />
                {imageFiles.length > 0 && (<div className="file-name-list">{imageFiles.map(file => <div className="file-name" key={file.name}>{file.name}</div>)}</div>)}
            </div>
            {error && <p style={{ color: '#ff8a8a' }}>{error}</p>}
            {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <progress value={progress.percentage} max="100"></progress>
                    <p style={{marginTop: '16px', fontSize: '16px', opacity: 0.8}}>{progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}
             <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={compressImages} disabled={imageFiles.length === 0 || isLoading} aria-live="polite">{isLoading ? 'Compressing...' : 'Compress Images'}</button>
            </div>
             {results.length > 0 && !isLoading && (
                <div className="result-section">
                    <h2>Compression Results</h2>
                    <div className="download-actions">
                        <button className="btn btn-primary" onClick={handleDownloadAllZip}>Download All (.zip)</button>
                    </div>
                     <table className="result-table">
                        <thead>
                            <tr>
                                <th>Original File Name</th>
                                <th>Original Size</th>
                                <th>Compressed Size</th>
                                <th>Reduction</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(result => {
                                const reduction = 100 - (result.compressedSize / result.originalSize * 100);
                                return (
                                <tr key={result.originalFile.name}>
                                    <td>{result.originalFile.name}</td>
                                    <td>{formatBytes(result.originalSize)}</td>
                                    <td>{formatBytes(result.compressedSize)}</td>
                                    <td className="size-reduction">{reduction.toFixed(1)}%</td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
};

// ===== Resize & Crop Image Component =====
const RESIZE_PRESETS: { [key: string]: { width: number, height: number, name: string } } = {
    'instagram_post': { width: 1080, height: 1080, name: 'Instagram Post (1:1)' },
    'instagram_story': { width: 1080, height: 1920, name: 'Instagram Story (9:16)' },
    'facebook_post': { width: 1200, height: 630, name: 'Facebook Post (1.91:1)' },
    'linkedin_banner': { width: 1584, height: 396, name: 'LinkedIn Banner (4:1)' },
};

interface ResizeResult {
    originalFileName: string;
    url: string;
    blob: Blob;
}

const ImageResizerCropper = ({ onBack }: { onBack: () => void }) => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [results, setResults] = useState<ResizeResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);
    const [resizeOption, setResizeOption] = useState('custom');
    const [customWidth, setCustomWidth] = useState(1080);
    const [customHeight, setCustomHeight] = useState(1080);
    
    useEffect(() => {
        if (resizeOption !== 'custom' && RESIZE_PRESETS[resizeOption]) {
            setCustomWidth(RESIZE_PRESETS[resizeOption].width);
            setCustomHeight(RESIZE_PRESETS[resizeOption].height);
        }
    }, [resizeOption]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const validImageFiles = Array.from(files).filter(file => file.type === 'image/jpeg' || file.type === 'image/png');
            if (validImageFiles.length > 0) {
                setImageFiles(validImageFiles);
                setResults([]);
                setError('');
            } else {
                setImageFiles([]);
                setError('Please select valid JPG or PNG files.');
            }
        }
    };

    const handleResizeImages = async () => {
        if (imageFiles.length === 0) {
            setError('No image files selected.');
            return;
        }
        if (!customWidth || !customHeight || customWidth <= 0 || customHeight <= 0) {
            setError('Please enter valid positive dimensions.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResults([]);
        
        const newResults: ResizeResult[] = [];

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            setProgress({
                total: imageFiles.length,
                current: i + 1,
                fileName: file.name,
                percentage: Math.round(((i + 1) / imageFiles.length) * 100),
                task: 'Resizing images...'
            });
            try {
                const resultBlob = await processImage(file, customWidth, customHeight);
                newResults.push({
                    originalFileName: file.name,
                    blob: resultBlob,
                    url: URL.createObjectURL(resultBlob)
                });
            } catch (err) {
                 console.error(`Error resizing ${file.name}:`, err);
                 setError(`Failed to resize ${file.name}.`);
            }
        }
        
        setResults(newResults);
        setProgress(null);
        setIsLoading(false);
    };

    const processImage = (file: File, targetWidth: number, targetHeight: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const objectUrl = URL.createObjectURL(file);

            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                const imageRatio = image.width / image.height;
                const targetRatio = targetWidth / targetHeight;
                let srcX = 0, srcY = 0, srcWidth = image.width, srcHeight = image.height;

                if (imageRatio > targetRatio) { // Image is wider than target, crop width
                    srcWidth = image.height * targetRatio;
                    srcX = (image.width - srcWidth) / 2;
                } else if (imageRatio < targetRatio) { // Image is taller than target, crop height
                    srcHeight = image.width / targetRatio;
                    srcY = (image.height - srcHeight) / 2;
                }

                ctx.drawImage(image, srcX, srcY, srcWidth, srcHeight, 0, 0, targetWidth, targetHeight);
                canvas.toBlob(blob => {
                    URL.revokeObjectURL(objectUrl);
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Canvas toBlob failed"));
                    }
                }, file.type, 0.9); // Use original file type, 0.9 quality for jpeg
            };
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Failed to load image"));
            };
            image.src = objectUrl;
        });
    };
    
    const handleDownloadAllZip = async () => {
        if (!window.JSZip || results.length === 0) return;
        const zip = new window.JSZip();
        results.forEach(result => {
            zip.file(result.originalFileName, result.blob);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'resized-images.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <>
            <h1>Resize & Crop Images</h1>
            <p>Resize and crop JPG or PNG images to fit specific dimensions for social media, blogs, and more.</p>
             <div className="upload-section">
                <label htmlFor="image-upload" className="file-label" role="button" tabIndex={0} aria-label="Upload image files">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{imageFiles.length > 0 ? `${imageFiles.length} Image(s) Selected` : 'Choose JPG or PNG files'}</span>
                </label>
                <input id="image-upload" type="file" accept="image/jpeg,image/png" onChange={handleFileChange} multiple aria-hidden="true" />
                {imageFiles.length > 0 && (<div className="file-name-list">{imageFiles.map(file => <div className="file-name" key={file.name}>{file.name}</div>)}</div>)}
            </div>
            
            <div className="options-panel">
                <div className="form-group">
                    <label htmlFor="preset-select">Preset</label>
                    <select id="preset-select" value={resizeOption} onChange={(e) => setResizeOption(e.target.value)}>
                        <option value="custom">Custom Dimensions</option>
                        {Object.entries(RESIZE_PRESETS).map(([key, { name }]) => (
                            <option key={key} value={key}>{name}</option>
                        ))}
                    </select>
                </div>
                 <div className="custom-dimensions">
                    <div className="form-group">
                        <label htmlFor="width-input">Width (px)</label>
                        <input id="width-input" type="number" value={customWidth} onChange={e => { setResizeOption('custom'); setCustomWidth(parseInt(e.target.value, 10)); }} />
                    </div>
                     <div className="form-group">
                        <label htmlFor="height-input">Height (px)</label>
                        <input id="height-input" type="number" value={customHeight} onChange={e => { setResizeOption('custom'); setCustomHeight(parseInt(e.target.value, 10)); }}/>
                    </div>
                </div>
            </div>

            {error && <p style={{ color: '#ff8a8a' }}>{error}</p>}
            
            {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <progress value={progress.percentage} max="100"></progress>
                    <p style={{marginTop: '16px', fontSize: '16px', opacity: 0.8}}>{progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}
            
             <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleResizeImages} disabled={imageFiles.length === 0 || isLoading} aria-live="polite">{isLoading ? 'Resizing...' : 'Resize Images'}</button>
            </div>
             
             {results.length > 0 && !isLoading && (
                <div className="result-section">
                    <h2>Resized Images</h2>
                     <div className="download-actions">
                        <button className="btn btn-primary" onClick={handleDownloadAllZip}>Download All (.zip)</button>
                    </div>
                    <div className="image-grid">
                        {results.map(result => (
                            <div key={result.originalFileName} className="image-container">
                                <img src={result.url} alt={`Resized version of ${result.originalFileName}`} />
                                <a href={result.url} download={result.originalFileName} className="download-link">Download {result.originalFileName}</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

// ===== SERP Preview Tool Component =====
const SERP_CONSTANTS = {
    DESKTOP: {
        TITLE_PIXELS: 600,
        TITLE_CHARS: 60,
        DESC_PIXELS: 960,
        DESC_CHARS: 160,
        TITLE_FONT: '20px Roboto, sans-serif',
        DESC_FONT: '14px Roboto, sans-serif',
    },
};

const getTextWidth = (text: string, font: string): number => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.font = font;
    return context.measureText(text).width;
};

const truncateByWidth = (text: string, font: string, maxWidth: number): string => {
    const ellipsis = '...';
    const ellipsisWidth = getTextWidth(ellipsis, font);
    if (getTextWidth(text, font) <= maxWidth) {
        return text;
    }

    let truncatedText = '';
    for (let i = text.length; i > 0; i--) {
        truncatedText = text.substring(0, i);
        if (getTextWidth(truncatedText, font) + ellipsisWidth <= maxWidth) {
            return truncatedText + ellipsis;
        }
    }
    return ellipsis;
};

const CounterBar = ({ current, max, unit }: { current: number; max: number; unit: string; }) => {
    const percentage = Math.min((current / max) * 100, 100);
    let colorClass = 'green';
    if (current > max) {
        colorClass = 'red';
    } else if (current / max > 0.9) {
        colorClass = 'orange';
    }

    return (
        <div className="counter-bar">
            <div className={`counter-bar-fill ${colorClass}`} style={{ width: `${percentage}%` }}></div>
            <span className="counter-bar-text">{current} / {max} {unit}</span>
        </div>
    );
};

const SerpPreviewTool = ({ onBack }: { onBack: () => void }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const [titlePixels, setTitlePixels] = useState(0);
    const [descPixels, setDescPixels] = useState(0);

    useEffect(() => {
        setTitlePixels(getTextWidth(title, SERP_CONSTANTS.DESKTOP.TITLE_FONT));
    }, [title]);

    useEffect(() => {
        setDescPixels(getTextWidth(description, SERP_CONSTANTS.DESKTOP.DESC_FONT));
    }, [description]);
    
    const handleFetchMetadata = async () => {
        if (!url) {
            setFetchError('Please enter a URL to fetch.');
            return;
        }

        let fullUrl = url;
        if (!/^https?:\/\//i.test(fullUrl)) {
            fullUrl = `https://${fullUrl}`;
        }
        
        setIsFetching(true);
        setFetchError('');
        
        try {
            // Using a CORS proxy to bypass browser restrictions for this client-side tool.
            const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(fullUrl)}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch URL through proxy. Status: ${response.status}`);
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const fetchedTitle = doc.querySelector('title')?.innerText || '';
            const fetchedDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';

            setTitle(fetchedTitle);
            setDescription(fetchedDescription);
            setUrl(fullUrl);

            if (!fetchedTitle && !fetchedDescription) {
                setFetchError('Could not find title or meta description on the page.');
            }

        } catch (error) {
            console.error('Fetch error:', error);
            setFetchError('Failed to fetch metadata. The URL might be invalid or blocked.');
        } finally {
            setIsFetching(false);
        }
    };

    const formatUrl = (fullUrl: string): [string, string] => {
        try {
            if (!fullUrl) return ['', ''];
            const urlObj = new URL(fullUrl.startsWith('http') ? fullUrl : `https://${fullUrl}`);
            const domain = urlObj.hostname;
            const path = urlObj.pathname.split('/').filter(p => p && p !== '/').join(' › ');
            return [domain, path];
        } catch (e) {
            return [fullUrl, ''];
        }
    };

    const [domain, path] = formatUrl(url);
    const truncatedTitle = truncateByWidth(title, SERP_CONSTANTS.DESKTOP.TITLE_FONT, SERP_CONSTANTS.DESKTOP.TITLE_PIXELS);
    const truncatedDesc = truncateByWidth(description, SERP_CONSTANTS.DESKTOP.DESC_FONT, SERP_CONSTANTS.DESKTOP.DESC_PIXELS);

    return (
        <>
            <h1>SERP Preview Tool</h1>
            <p>See a live preview of how your page will appear on a Google search results page as you type, or fetch live metadata from a URL.</p>
            
            <div className="serp-tool-layout">
                <div className="serp-inputs-panel">
                    <div className="form-group">
                        <label htmlFor="seo-title">SEO Title</label>
                        <input id="seo-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Your Page Title" />
                        <div className="counters-container">
                            <CounterBar current={title.length} max={SERP_CONSTANTS.DESKTOP.TITLE_CHARS} unit="chars" />
                            <CounterBar current={Math.round(titlePixels)} max={SERP_CONSTANTS.DESKTOP.TITLE_PIXELS} unit="px" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="meta-desc">Meta Description</label>
                        <textarea id="meta-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Your meta description goes here." rows={4}></textarea>
                         <div className="counters-container">
                            <CounterBar current={description.length} max={SERP_CONSTANTS.DESKTOP.DESC_CHARS} unit="chars" />
                            <CounterBar current={Math.round(descPixels)} max={SERP_CONSTANTS.DESKTOP.DESC_PIXELS} unit="px" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="url-input">URL</label>
                        <div className="input-with-button">
                            <input
                                id="url-input"
                                type="text"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                placeholder="www.example.com/your-page"
                                onKeyDown={(e) => e.key === 'Enter' && handleFetchMetadata()}
                            />
                            <button onClick={handleFetchMetadata} disabled={isFetching || !url} className="btn btn-secondary">
                                {isFetching ? 'Fetching...' : 'Fetch'}
                            </button>
                        </div>
                        {fetchError && <p className="fetch-error">{fetchError}</p>}
                    </div>
                </div>

                <div className="serp-preview-panel">
                    <h3>Desktop Preview</h3>
                    <div className="serp-preview-box">
                         <div className="serp-result">
                            <div className="serp-url-line">
                                <span className="serp-url-domain">{domain || 'www.example.com'}</span>
                                {path && <span className="serp-url-path"> › {path}</span>}
                            </div>
                            <h3 className="serp-title">{truncatedTitle || 'SEO Title Appears Here'}</h3>
                            <p className="serp-description">{truncatedDesc || 'The meta description will be displayed here. Aim for around 160 characters for the best visibility on search engine results pages.'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="action-bar" style={{ marginTop: 'calc(var(--base-unit) * 4)' }}>
                <button className="btn btn-secondary" onClick={onBack}>Back to Dashboard</button>
            </div>
        </>
    );
};

// ===== Bulk Image Watermarker Component =====
interface WatermarkResult {
    fileName: string;
    url: string;
    blob: Blob;
}

const OBSIDIAN_LOGO_SVG_STRING = `
<svg width="200" height="200" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z" fill="white" />
    <path d="M50 10L86.6 30V70L50 90L13.4 70V30L50 10Z" fill="none" stroke="black" stroke-opacity="0.1" stroke-width="2" />
    <path d="M50 50L93.3 25L50 0L6.7 25L50 50Z" fill="white" fill-opacity="0.3" />
    <path d="M50 50L6.7 75L50 100L93.3 75L50 50Z" fill="white" fill-opacity="0.3" />
</svg>`;

const POSITIONS = [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right'
];

const BulkImageWatermarker = ({ onBack }: { onBack: () => void }) => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [watermarkSource, setWatermarkSource] = useState<'default' | 'custom'>('default');
    const [customWatermark, setCustomWatermark] = useState<File | null>(null);
    const [customWatermarkUrl, setCustomWatermarkUrl] = useState<string | null>(null);

    const [position, setPosition] = useState('bottom-right');
    const [size, setSize] = useState(15);
    const [opacity, setOpacity] = useState(0.7);
    const [padding, setPadding] = useState(5);

    const [results, setResults] = useState<WatermarkResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const defaultLogoImage = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const dataUrl = `data:image/svg+xml;base64,${btoa(OBSIDIAN_LOGO_SVG_STRING)}`;
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => { defaultLogoImage.current = img; };
    }, []);

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const validImageFiles = Array.from(files).filter(file => file.type === 'image/jpeg' || file.type === 'image/png');
            if (validImageFiles.length > 0) {
                setImageFiles(validImageFiles);
                setResults([]);
                setError('');
            } else {
                setImageFiles([]);
                setError('Please select valid JPG or PNG files.');
            }
        }
    };
    
    const handleWatermarkFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/svg+xml')) {
            setCustomWatermark(file);
            const url = URL.createObjectURL(file);
            setCustomWatermarkUrl(url);
            setError('');
        } else {
            setCustomWatermark(null);
            setCustomWatermarkUrl(null);
            setError('Please upload a valid watermark image (JPG, PNG).');
        }
    };

    const handleApplyWatermarks = async () => {
        if (imageFiles.length === 0) {
            setError('Please upload at least one image to apply the watermark to.');
            return;
        }
        const watermarkImageToUse = watermarkSource === 'custom' ? customWatermarkUrl : defaultLogoImage.current;
        if (!watermarkImageToUse) {
            setError(watermarkSource === 'custom' ? 'Please upload a custom watermark image.' : 'Default watermark is not ready.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResults([]);
        
        const newResults: WatermarkResult[] = [];
        const watermarkImg = new Image();
        if (typeof watermarkImageToUse === 'string') {
             watermarkImg.src = watermarkImageToUse;
             await new Promise((resolve, reject) => {
                watermarkImg.onload = resolve;
                watermarkImg.onerror = reject;
            });
        }

        const finalWatermarkImage = watermarkSource === 'default' && defaultLogoImage.current ? defaultLogoImage.current : watermarkImg;
        
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            setProgress({
                total: imageFiles.length, current: i + 1, fileName: file.name,
                percentage: Math.round(((i + 1) / imageFiles.length) * 100),
                task: 'Applying watermarks...'
            });
            try {
                const mainImg = new Image();
                const mainImgUrl = URL.createObjectURL(file);
                mainImg.src = mainImgUrl;
                await new Promise((resolve, reject) => {
                    mainImg.onload = resolve;
                    mainImg.onerror = reject;
                });
                URL.revokeObjectURL(mainImgUrl);
                
                const canvas = document.createElement('canvas');
                canvas.width = mainImg.width;
                canvas.height = mainImg.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;
                
                ctx.drawImage(mainImg, 0, 0);

                const mainImgMinDim = Math.min(mainImg.width, mainImg.height);
                const watermarkScale = (size / 100) * mainImg.width;
                const watermarkAspectRatio = finalWatermarkImage.width / finalWatermarkImage.height;
                const w = watermarkScale;
                const h = w / watermarkAspectRatio;

                const paddingPixels = (padding / 100) * mainImgMinDim;
                
                let x = 0, y = 0;
                const [vAlign, hAlign] = position.split('-');
                
                if (hAlign === 'left') x = paddingPixels;
                else if (hAlign === 'center') x = (mainImg.width - w) / 2;
                else if (hAlign === 'right') x = mainImg.width - w - paddingPixels;
                
                if (vAlign === 'top') y = paddingPixels;
                else if (vAlign === 'middle') y = (mainImg.height - h) / 2;
                else if (vAlign === 'bottom') y = mainImg.height - h - paddingPixels;
                
                ctx.globalAlpha = opacity;
                ctx.drawImage(finalWatermarkImage, x, y, w, h);

                const blob: Blob | null = await new Promise(resolve => canvas.toBlob(b => resolve(b), file.type, 0.95));
                if (blob) {
                    newResults.push({ fileName: file.name, blob, url: URL.createObjectURL(blob) });
                }
            } catch (err) {
                console.error('Error processing image:', file.name, err);
            }
        }
        
        setResults(newResults);
        setProgress(null);
        setIsLoading(false);
    };

     const handleDownloadAllZip = async () => {
        if (!window.JSZip || results.length === 0) return;
        const zip = new window.JSZip();
        results.forEach(result => {
            zip.file(result.fileName, result.blob);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'watermarked-images.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <>
            <h1>Bulk Image Watermarker</h1>
            <p>Apply a logo or custom image as a watermark to multiple images at once.</p>

            <div className="upload-section">
                <label htmlFor="image-upload-watermark" className="file-label" role="button" tabIndex={0} aria-label="Upload image files">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{imageFiles.length > 0 ? `${imageFiles.length} Image(s) Selected` : 'Choose JPG or PNG files'}</span>
                </label>
                <input id="image-upload-watermark" type="file" accept="image/jpeg,image/png" onChange={handleImageFileChange} multiple aria-hidden="true" />
                {imageFiles.length > 0 && (<div className="file-name-list">{imageFiles.map(file => <div className="file-name" key={file.name}>{file.name}</div>)}</div>)}
            </div>

            <div className="watermark-options-panel">
                 <div className="form-group-full">
                     <label>Watermark Source</label>
                     <div className="segmented-control">
                        <button className={watermarkSource === 'default' ? 'active' : ''} onClick={() => setWatermarkSource('default')}>Obsidian Logo</button>
                        <button className={watermarkSource === 'custom' ? 'active' : ''} onClick={() => setWatermarkSource('custom')}>Upload Custom</button>
                    </div>
                 </div>
                 {watermarkSource === 'custom' && (
                     <div className="form-group-full">
                         <label htmlFor="watermark-upload" className="file-label-small">
                             {customWatermark ? customWatermark.name : 'Upload Watermark Image'}
                         </label>
                         <input id="watermark-upload" type="file" accept="image/jpeg,image/png,image/svg+xml" onChange={handleWatermarkFileChange} />
                     </div>
                 )}
                <div className="form-group">
                    <label>Position</label>
                    <div className="position-grid">
                        {POSITIONS.map(p => (
                            <button key={p} className={position === p ? 'active' : ''} onClick={() => setPosition(p)} aria-label={`Set position to ${p.replace('-', ' ')}`}></button>
                        ))}
                    </div>
                </div>
                <div className="slider-controls">
                    <div className="form-group">
                        <label htmlFor="size-slider">Size ({size}%)</label>
                        <input type="range" id="size-slider" min="1" max="50" value={size} onChange={e => setSize(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="opacity-slider">Opacity ({Math.round(opacity * 100)}%)</label>
                        <input type="range" id="opacity-slider" min="0" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} />
                    </div>
                     <div className="form-group">
                        <label htmlFor="padding-slider">Padding ({padding}%)</label>
                        <input type="range" id="padding-slider" min="0" max="25" value={padding} onChange={e => setPadding(Number(e.target.value))} />
                    </div>
                </div>
            </div>

            {error && <p style={{ color: '#ff8a8a' }}>{error}</p>}
            {isLoading && progress && (
                 <div className="progress-section">
                    <p>{progress.task}</p>
                    <progress value={progress.percentage} max="100"></progress>
                    <p style={{marginTop: '16px', fontSize: '16px', opacity: 0.8}}>{progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}
            
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleApplyWatermarks} disabled={imageFiles.length === 0 || isLoading} aria-live="polite">{isLoading ? 'Applying...' : 'Apply Watermarks'}</button>
            </div>

             {results.length > 0 && !isLoading && (
                <div className="result-section">
                    <h2>Watermarked Images</h2>
                    <div className="download-actions">
                        <button className="btn btn-primary" onClick={handleDownloadAllZip}>Download All (.zip)</button>
                    </div>
                    <div className="image-grid">
                        {results.map(result => (
                            <div key={result.fileName} className="image-container">
                                <img src={result.url} alt={`Watermarked version of ${result.fileName}`} />
                                <a href={result.url} download={result.fileName} className="download-link">Download {result.fileName}</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};


// ===== New Tool Placeholders =====
const PlaceholderTool = ({ title, description, onBack }: { title: string; description: string; onBack: () => void; }) => (
    <>
        <h1>{title}</h1>
        <p>{description}</p>
        <p style={{ fontStyle: 'italic', marginTop: '4rem', opacity: 0.7 }}>This tool is currently under development. Check back soon!</p>
        <div className="action-bar" style={{ marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={onBack}>Back to Dashboard</button>
        </div>
    </>
);

// Core Utilities
const VideoToGifConverter = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Video to GIF Converter" description="A simple tool to trim a video file and convert it into an optimized GIF for social media or emails." onBack={onBack} />;
const TextTools = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Text Tools" description="A simple dashboard with a word counter, character counter, and text case converter (UPPERCASE, lowercase, Title Case)." onBack={onBack} />;

// SEO & Content Hub
const KeywordDensityChecker = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Keyword Density Checker" description="Paste in text from a URL or document to get a report on the frequency of specific keywords and phrases." onBack={onBack} />;
const BulkPageAnalyzer = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Bulk Page Analyzer" description="Input a list of URLs to quickly pull key on-page elements like title tags, meta descriptions, H1 tags, and word count into a downloadable CSV." onBack={onBack} />;
const BlogIdeaGenerator = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Blog Idea Generator" description="Input a primary keyword or topic, and the tool suggests a list of potential blog titles and angles." onBack={onBack} />;
const ContentReadabilityScore = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Content Readability Score" description="Paste in text to analyze its reading level and get suggestions for simplifying complex sentences." onBack={onBack} />;
const SimpleSitemapGenerator = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Simple Sitemap Generator" description="Paste a list of URLs to generate a basic sitemap.xml file." onBack={onBack} />;
const RobotsTxtGenerator = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Robots.txt Generator" description="A user-friendly interface to create a robots.txt file by specifying user agents and allowing or disallowing paths." onBack={onBack} />;

// Paid Media (PPC) Toolkit
const AdCopyPermutationGenerator = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Ad Copy Permutation Generator" description="Input multiple headlines and descriptions for Google Ads (RSAs) to generate all possible combinations." onBack={onBack} />;
const HeadlineIdeaGenerator = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Headline Idea Generator" description="Input a product/service and keywords to get compelling ad headlines." onBack={onBack} />;
const CharacterComplianceChecker = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Character & Compliance Checker" description="A text editor that counts characters for ads across different platforms and flags potential compliance issues." onBack={onBack} />;
const KeywordWrapper = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Keyword Wrapper" description="Paste a list of keywords to automatically generate broad, phrase, and exact match versions." onBack={onBack} />;
const UtmLinkBuilder = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="UTM Link Builder" description="A simple form to generate consistent, error-free UTM-tagged URLs for tracking campaigns." onBack={onBack} />;
const NegativeKeywordCleaner = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Negative Keyword Cleaner" description="Paste in a search terms report to quickly identify and format potential negative keywords." onBack={onBack} />;

// Analytics & Reporting Dashboard
const CsvToChartGenerator = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="CSV to Chart Generator" description="Upload a simple CSV file to instantly generate clean, presentation-ready charts." onBack={onBack} />;
const ReportCommentaryAssistant = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Report Commentary Assistant" description="Input key performance indicators (KPIs) and their changes to generate a boilerplate paragraph of analysis." onBack={onBack} />;
const PitchDeckSlideBuilder = ({ onBack }: { onBack: () => void }) => <PlaceholderTool title="Pitch Deck Slide Builder" description="A template-based tool to quickly generate key slides for a new client pitch." onBack={onBack} />;

// ===== Icons =====
const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
);
const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
);
const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
);
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
);
const ArrowRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
);
const FileConverterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m11.5 15.5 3-3-3-3"></path><path d="m8.5 12.5-3 3 3 3"></path></svg>
);
const SeoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><circle cx="10.5" cy="13.5" r="2.5"></circle><path d="m12.5 15.5 2 2"></path></svg>
);
const PpcIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12a5 5 0 0 0 5 5"></path><path d="M12 12H2.4a7.5 7.5 0 0 1 15.08 3.55"></path><path d="m16 12-4-4 4-4"></path></svg>
);
const AnalyticsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="M7 12v5"></path><path d="M12 7v10"></path><path d="M17 4v13"></path></svg>
);


// ===== Header Component =====
const Header = ({ onHomeClick, theme, onThemeToggle }: { onHomeClick: () => void; theme: string; onThemeToggle: () => void; }) => {
    return (
        <header className="app-header">
            <button onClick={onHomeClick} className="header-btn">
                <HomeIcon />
                <span>Dashboard</span>
            </button>
            <div className="header-right">
                <button onClick={onThemeToggle} className="header-btn theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
            </div>
        </header>
    );
};

// ===== Tool Data =====
const TOOLS_CONFIG = {
    CORE_UTILS: {
        name: "Core Utilities",
        tools: [
            { id: 'PDF_TO_JPG', title: 'PDF to JPG', description: 'Convert each page of a PDF into a separate JPG image.', Icon: FileConverterIcon },
            { id: 'JPG_TO_PDF', title: 'Images to PDF', description: 'Combine multiple JPG or PNG images into a single PDF file.', Icon: FileConverterIcon },
            { id: 'MERGE_PDF', title: 'Merge PDFs', description: 'Combine multiple separate PDF files into one single document.', Icon: FileConverterIcon },
            { id: 'SPLIT_PDF', title: 'Split PDF', description: 'Extract every page from a PDF into separate PDF files.', Icon: FileConverterIcon },
            { id: 'COMPRESS_IMAGE', title: 'Compress Images', description: 'Reduce the file size of JPG & PNG images for web optimization.', Icon: FileConverterIcon },
            { id: 'RESIZE_CROP_IMAGE', title: 'Resize & Crop Images', description: 'Adjust image dimensions with presets for social media and web.', Icon: FileConverterIcon },
            { id: 'BULK_IMAGE_WATERMARKER', title: 'Bulk Image Watermarker', description: 'Apply a logo watermark to a batch of images in a chosen position.', Icon: FileConverterIcon },
            { id: 'VIDEO_TO_GIF_CONVERTER', title: 'Video to GIF Converter', description: 'Trim a video file and convert it into an optimized GIF for social media.', Icon: FileConverterIcon },
            { id: 'TEXT_TOOLS', title: 'Text Tools', description: 'Utilities for word count, character count, and changing text case.', Icon: FileConverterIcon },
        ]
    },
    SEO_CONTENT: {
        name: "SEO & Content Hub",
        tools: [
            { id: 'SERP_PREVIEW_TOOL', title: 'SERP Preview Tool', description: 'Preview how a title tag, meta description, and URL will appear on Google.', Icon: SeoIcon },
            { id: 'KEYWORD_DENSITY_CHECKER', title: 'Keyword Density Checker', description: 'Analyze text to report the frequency of specific keywords and phrases.', Icon: SeoIcon },
            { id: 'BULK_PAGE_ANALYZER', title: 'Bulk Page Analyzer', description: 'Pull on-page SEO elements from a list of URLs into a downloadable CSV.', Icon: SeoIcon },
            { id: 'BLOG_IDEA_GENERATOR', title: 'Blog Idea Generator', description: 'Enter a keyword or topic to get a list of potential blog titles and angles.', Icon: SeoIcon },
            { id: 'CONTENT_READABILITY_SCORE', title: 'Content Readability Score', description: 'Analyze text for its reading level and get suggestions for simplification.', Icon: SeoIcon },
            { id: 'SIMPLE_SITEMAP_GENERATOR', title: 'Simple Sitemap Generator', description: 'Paste a list of URLs to generate a basic sitemap.xml file.', Icon: SeoIcon },
            { id: 'ROBOTS_TXT_GENERATOR', title: 'Robots.txt Generator', description: 'User-friendly interface to create a robots.txt file for search engines.', Icon: SeoIcon },
        ]
    },
    PPC_TOOLKIT: {
        name: "Paid Media (PPC) Toolkit",
        tools: [
            { id: 'AD_COPY_PERMUTATION_GENERATOR', title: 'Ad Copy Permutation Generator', description: 'Input multiple headlines/descriptions to see all possible ad combinations.', Icon: PpcIcon },
            { id: 'HEADLINE_IDEA_GENERATOR', title: 'Headline Idea Generator', description: 'Enter a product/service to get compelling ad headline ideas.', Icon: PpcIcon },
            { id: 'CHARACTER_COMPLIANCE_CHECKER', title: 'Character & Compliance Checker', description: 'A text editor that counts characters for ads and flags compliance issues.', Icon: PpcIcon },
            { id: 'KEYWORD_WRAPPER', title: 'Keyword Wrapper', description: 'Generate broad, phrase, and exact match versions of a keyword list.', Icon: PpcIcon },
            { id: 'UTM_LINK_BUILDER', title: 'UTM Link Builder', description: 'Generate consistent, error-free UTM-tagged URLs for campaign tracking.', Icon: PpcIcon },
            { id: 'NEGATIVE_KEYWORD_CLEANER', title: 'Negative Keyword Cleaner', description: 'Process search term reports to quickly identify negative keywords.', Icon: PpcIcon },
        ]
    },
    ANALYTICS_REPORTING: {
        name: "Analytics & Reporting Dashboard",
        tools: [
            { id: 'CSV_TO_CHART_GENERATOR', title: 'CSV to Chart Generator', description: 'Upload a CSV to instantly generate clean, presentation-ready charts.', Icon: AnalyticsIcon },
            { id: 'REPORT_COMMENTARY_ASSISTANT', title: 'Report Commentary Assistant', description: 'Input KPIs to generate a boilerplate paragraph of performance analysis.', Icon: AnalyticsIcon },
            { id: 'PITCH_DECK_SLIDE_BUILDER', title: 'Pitch Deck Slide Builder', description: 'A template-based tool to quickly generate key slides for a new client pitch.', Icon: AnalyticsIcon },
        ]
    }
};

// ===== Dashboard Component =====
const Dashboard = ({ onSelectTool }: { onSelectTool: (tool: string) => void; }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCategories = Object.entries(TOOLS_CONFIG).map(([key, category]) => {
        const filteredTools = category.tools.filter(tool =>
            tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tool.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return { ...category, tools: filteredTools, id: key };
    }).filter(category => category.tools.length > 0);

    return (
        <main className="tool-hub">
            <div className="hub-intro">
                <h1>Internal Tools Dashboard</h1>
                <p>A suite of applications designed to streamline workflows and boost productivity.</p>
            </div>
            <div className="search-bar">
                <SearchIcon />
                <input
                    type="text"
                    placeholder="Search for a tool..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search for tools"
                />
            </div>

            {filteredCategories.length > 0 ? filteredCategories.map(category => (
                <section key={category.id} className="tool-category">
                    <h2>{category.name}</h2>
                    <div className="tool-grid">
                        {category.tools.map(tool => (
                            <div key={tool.id} className="tool-card" onClick={() => onSelectTool(tool.id)} onKeyDown={(e) => e.key === 'Enter' && onSelectTool(tool.id)} role="button" tabIndex={0} aria-label={`Open ${tool.title}`}>
                                <div>
                                    <div className="card-header">
                                        <h3>{tool.title}</h3>
                                        <div className="card-icon-container">
                                            <tool.Icon />
                                        </div>
                                    </div>
                                    <p className="card-description">{tool.description}</p>
                                </div>
                                <div className="card-footer">
                                    <span>Open tool</span>
                                    <ArrowRightIcon />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )) : (
                <p style={{textAlign: 'center', marginTop: '4rem'}}>No tools found for "{searchTerm}".</p>
            )}
        </main>
    );
};


// ===== Main App Component =====
const App = () => {
    const [currentTool, setCurrentTool] = useState<string | null>(null);
    const [theme, setTheme] = useState('light');

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    useEffect(() => {
        document.documentElement.className = theme;
    }, [theme]);
    
    const handleBack = () => setCurrentTool(null);

    const renderTool = () => {
        if (!currentTool) return null;

        switch (currentTool) {
            // Core Utilities
            case 'PDF_TO_JPG':
                return <PdfToJpgConverter onBack={handleBack} />;
            case 'JPG_TO_PDF':
                return <ImagesToPdfConverter onBack={handleBack} />;
            case 'MERGE_PDF':
                return <MergePdfConverter onBack={handleBack} />;
            case 'SPLIT_PDF':
                return <SplitPdfConverter onBack={handleBack} />;
            case 'COMPRESS_IMAGE':
                return <CompressImageConverter onBack={handleBack} />;
            case 'RESIZE_CROP_IMAGE':
                return <ImageResizerCropper onBack={handleBack} />;
            case 'BULK_IMAGE_WATERMARKER':
                return <BulkImageWatermarker onBack={handleBack} />;
            case 'VIDEO_TO_GIF_CONVERTER':
                return <VideoToGifConverter onBack={handleBack} />;
            case 'TEXT_TOOLS':
                return <TextTools onBack={handleBack} />;

            // SEO & Content Hub
            case 'SERP_PREVIEW_TOOL':
                return <SerpPreviewTool onBack={handleBack} />;
            case 'KEYWORD_DENSITY_CHECKER':
                return <KeywordDensityChecker onBack={handleBack} />;
            case 'BULK_PAGE_ANALYZER':
                return <BulkPageAnalyzer onBack={handleBack} />;
            case 'BLOG_IDEA_GENERATOR':
                return <BlogIdeaGenerator onBack={handleBack} />;
            case 'CONTENT_READABILITY_SCORE':
                return <ContentReadabilityScore onBack={handleBack} />;
            case 'SIMPLE_SITEMAP_GENERATOR':
                return <SimpleSitemapGenerator onBack={handleBack} />;
            case 'ROBOTS_TXT_GENERATOR':
                return <RobotsTxtGenerator onBack={handleBack} />;

            // Paid Media (PPC) Toolkit
            case 'AD_COPY_PERMUTATION_GENERATOR':
                return <AdCopyPermutationGenerator onBack={handleBack} />;
            case 'HEADLINE_IDEA_GENERATOR':
                return <HeadlineIdeaGenerator onBack={handleBack} />;
            case 'CHARACTER_COMPLIANCE_CHECKER':
                return <CharacterComplianceChecker onBack={handleBack} />;
            case 'KEYWORD_WRAPPER':
                return <KeywordWrapper onBack={handleBack} />;
            case 'UTM_LINK_BUILDER':
                return <UtmLinkBuilder onBack={handleBack} />;
            case 'NEGATIVE_KEYWORD_CLEANER':
                return <NegativeKeywordCleaner onBack={handleBack} />;

            // Analytics & Reporting Dashboard
            case 'CSV_TO_CHART_GENERATOR':
                return <CsvToChartGenerator onBack={handleBack} />;
            case 'REPORT_COMMENTARY_ASSISTANT':
                return <ReportCommentaryAssistant onBack={handleBack} />;
            case 'PITCH_DECK_SLIDE_BUILDER':
                return <PitchDeckSlideBuilder onBack={handleBack} />;

            default:
                return null;
        }
    };
    
    const toolContent = renderTool();

    return (
        <>
            <Header onHomeClick={() => setCurrentTool(null)} theme={theme} onThemeToggle={toggleTheme} />
            {toolContent ? (
                <div className="container">
                    {toolContent}
                </div>
            ) : (
                <Dashboard onSelectTool={setCurrentTool} />
            )}
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);