import React, { useState } from 'react';

interface SitemapPage {
    loc: string;
    lastmod: string;
    lastmodDate: Date;
}

export const LandingPageFinder = ({ onBack }: { onBack: () => void }) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<SitemapPage[]>([]);
    const [statusText, setStatusText] = useState('');

    const handleFetchSitemap = async () => {
        if (!url) {
            setError('Please enter a URL to start.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResults([]);
        
        try {
            // 1. Normalize URL
            let domain = url.trim();
            if (!/^https?:\/\//i.test(domain)) {
                domain = `https://${domain}`;
            }
            const origin = new URL(domain).origin;
            setStatusText(`Searching for sitemap at ${origin}...`);

            // 2. Find Sitemap Index
            const sitemapIndexUrls = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
            let sitemapIndexXml: string | null = null;
            
            for (const sitemapUrl of sitemapIndexUrls) {
                try {
                    // Using a CORS proxy to bypass browser restrictions
                    const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(sitemapUrl)}`);
                    if (response.ok) {
                        sitemapIndexXml = await response.text();
                        setStatusText(`Found sitemap index at ${sitemapUrl}`);
                        break;
                    }
                } catch (e) {
                    // Ignore fetch error and try next URL
                }
            }
            
            if (!sitemapIndexXml) {
                throw new Error(`Could not find a sitemap at ${sitemapIndexUrls.join(' or ')}. The site might not have one, or it might be located elsewhere.`);
            }

            // 3. Find Page Sitemap URL from Index
            const parser = new DOMParser();
            const indexDoc = parser.parseFromString(sitemapIndexXml, 'text/xml');
            if (indexDoc.querySelector("parsererror")) {
                throw new Error("Failed to parse the sitemap index file. It might be malformed.");
            }

            const sitemapLocs = Array.from(indexDoc.querySelectorAll("sitemap > loc")).map(loc => loc.textContent?.trim()).filter(Boolean);
            const pageSitemapUrl = sitemapLocs.find(loc => loc && /page|pages/i.test(loc));

            if (!pageSitemapUrl) {
                // Fallback: If no sitemap index is found (<sitemap> tags), maybe the first URL was the page sitemap itself.
                const urlTags = indexDoc.querySelectorAll("url");
                if(urlTags.length > 0) {
                     // This is not an index, but a direct sitemap. Process it.
                     setStatusText(`Found direct sitemap. Parsing pages...`);
                     const pages = parsePageSitemap(indexDoc);
                     setResults(pages);
                     setIsLoading(false);
                     return;
                }
                throw new Error("Could not find a specific 'pages' sitemap within the sitemap index.");
            }

            // 4. Fetch and Parse Page Sitemap
            setStatusText(`Found page sitemap. Fetching from ${pageSitemapUrl}...`);
            const pageSitemapResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(pageSitemapUrl)}`);
             if (!pageSitemapResponse.ok) {
                throw new Error(`Failed to fetch the page sitemap at ${pageSitemapUrl}`);
            }
            const pageSitemapXml = await pageSitemapResponse.text();
            const pageDoc = parser.parseFromString(pageSitemapXml, "text/xml");
            if (pageDoc.querySelector("parsererror")) {
                throw new Error("Failed to parse the page sitemap file. It might be malformed.");
            }
            
            const pages = parsePageSitemap(pageDoc);
            if (pages.length === 0) {
                 throw new Error("Found the page sitemap, but it contains no URL entries.");
            }
            setResults(pages);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setStatusText('');
        }
    };
    
    const parsePageSitemap = (doc: Document): SitemapPage[] => {
        const urlNodes = Array.from(doc.querySelectorAll("url"));
        const pages: SitemapPage[] = urlNodes.map(node => {
            const loc = node.querySelector("loc")?.textContent || '';
            const lastmod = node.querySelector("lastmod")?.textContent || new Date(0).toISOString();
            return { loc, lastmod, lastmodDate: new Date(lastmod) };
        }).filter(p => p.loc);

        // Sort by date descending
        return pages.sort((a, b) => b.lastmodDate.getTime() - a.lastmodDate.getTime());
    }

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return 'Invalid Date';
        }
    }

    return (
        <>
            <h1>Landing Page Finder</h1>
            <p>Enter a webshop's domain to discover its landing pages. This tool automatically finds the sitemap, extracts all static pages, and sorts them by the most recently updated.</p>

            <div className="panel">
                <div className="form-group">
                    <label htmlFor="url-input">Website URL</label>
                    <div className="input-with-button">
                        <input
                            id="url-input"
                            type="text"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="example.com"
                            onKeyDown={(e) => e.key === 'Enter' && handleFetchSitemap()}
                            disabled={isLoading}
                        />
                        <button onClick={handleFetchSitemap} disabled={isLoading || !url} className="btn btn-primary">
                            {isLoading ? 'Fetching...' : 'Fetch Pages'}
                        </button>
                    </div>
                </div>
            </div>
            
            {error && <p style={{ color: '#ff8a8a', textAlign: 'center', margin: '1rem 0' }}>{error}</p>}
            
            {isLoading && (
                 <div className="progress-section">
                    <p>{statusText}</p>
                    <div className="progress-bar-container">
                         <div className="progress-bar-fill indeterminate" style={{ width: `100%` }}></div>
                    </div>
                </div>
            )}
            
            <div className="action-bar" style={{ marginTop: isLoading ? '2rem' : 0 }}>
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
            </div>

            {results.length > 0 && !isLoading && (
                <div className="result-section">
                    <h2>Found {results.length} Pages</h2>
                    <div className="panel" style={{padding: 0, overflowX: 'auto'}}>
                        <table className="result-table">
                            <thead>
                                <tr>
                                    <th>Page URL</th>
                                    <th>Last Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((page) => (
                                    <tr key={page.loc}>
                                        <td style={{wordBreak: 'break-all'}}>
                                            <a href={page.loc} target="_blank" rel="noopener noreferrer">{page.loc}</a>
                                        </td>
                                        <td>{formatDate(page.lastmod)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};
