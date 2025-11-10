
import React, { useState, useEffect } from 'react';
import { CounterBar } from '../../components/common/CounterBar';

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

export const SerpPreviewTool = ({ onBack }: { onBack: () => void }) => {
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
            
            <div className="serp-layout">
                <div className="serp-inputs-panel panel">
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
