

import React, { useState, useEffect, useRef } from 'react';
import { Progress } from '../../types/common';

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

export const BulkImageWatermarker = ({ onBack }: { onBack: () => void }) => {
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

            <div className="file-dropzone">
                <label htmlFor="image-upload-watermark" className="file-dropzone-label">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{imageFiles.length > 0 ? `${imageFiles.length} Image(s) Selected` : 'Click to select or drop JPG/PNG files here'}</span>
                </label>
                <input id="image-upload-watermark" type="file" accept="image/jpeg,image/png" onChange={handleImageFileChange} multiple />
                {imageFiles.length > 0 && (
                    <div className="file-preview-list">
                        {imageFiles.map(file => <div className="file-preview-item" key={file.name}>{file.name}</div>)}
                    </div>
                )}
            </div>

            <div className="panel">
                <div className="watermark-options-grid">
                    <div>
                         <div className="form-group">
                            <label>Watermark Source</label>
                            <div className="segmented-control">
                                <button className={watermarkSource === 'default' ? 'active' : ''} onClick={() => setWatermarkSource('default')}>Obsidian Logo</button>
                                <button className={watermarkSource === 'custom' ? 'active' : ''} onClick={() => setWatermarkSource('custom')}>Upload Custom</button>
                            </div>
                         </div>
                         {watermarkSource === 'custom' && (
                             <div className="form-group">
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
                            <div key={result.fileName} className="image-grid-item">
                                <img src={result.url} alt={`Watermarked version of ${result.fileName}`} />
                                <a href={result.url} download={result.fileName} className="download-overlay">Download</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};