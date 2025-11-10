

import React, { useState } from 'react';
import { Progress } from '../../types/common';

export const ImagesToPdfConverter = ({ onBack }: { onBack: () => void }) => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState<Progress | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            // FIX: Explicitly type 'file' as 'File' to resolve the 'unknown' type error, allowing access to the 'type' property for validation.
            const validImageFiles = Array.from(files).filter((file: File) => file.type === 'image/jpeg' || file.type === 'image/png');
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
            
            <div className="file-dropzone">
                <label htmlFor="image-upload" className="file-dropzone-label">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{imageFiles.length > 0 ? `${imageFiles.length} Image(s) Selected` : 'Click to select or drop JPG/PNG files here'}</span>
                </label>
                <input id="image-upload" type="file" accept="image/jpeg,image/png" onChange={handleFileChange} multiple />
                 {imageFiles.length > 0 && (
                    <div className="file-preview-list">
                        {imageFiles.map(file => <div className="file-preview-item" key={file.name}>{file.name}</div>)}
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
                    <p className="progress-text">{progress.fileName} ({progress.percentage}%)</p>
                </div>
            )}

            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={convertImagesToPdf} disabled={imageFiles.length === 0 || isLoading} aria-live="polite">{isLoading ? 'Converting...' : 'Convert to PDF'}</button>
            </div>
        </>
    );
};