

import React, { useState, useEffect } from 'react';
import { Progress } from '../../types/common';

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

export const ImageResizerCropper = ({ onBack }: { onBack: () => void }) => {
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
            
            <div className="panel resize-options">
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
                            <div key={result.originalFileName} className="image-grid-item">
                                <img src={result.url} alt={`Resized version of ${result.originalFileName}`} />
                                <a href={result.url} download={result.originalFileName} className="download-overlay">Download</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};