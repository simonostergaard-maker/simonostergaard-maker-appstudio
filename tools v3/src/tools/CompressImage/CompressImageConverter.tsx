

import React, { useState } from 'react';
import { formatBytes } from '../../utils/formatBytes';
import { Progress } from '../../types/common';

interface CompressionResult {
    originalFile: File;
    compressedFile: File;
    originalSize: number;
    compressedSize: number;
}

export const CompressImageConverter = ({ onBack }: { onBack: () => void }) => {
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [results, setResults] = useState<CompressionResult[]>([]);
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