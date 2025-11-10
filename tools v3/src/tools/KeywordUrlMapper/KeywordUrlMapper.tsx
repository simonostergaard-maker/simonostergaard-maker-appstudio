import { GoogleGenAI, Type } from "@google/genai";
import React, { useState } from 'react';
import { AhrefsIcon, FileUploadIcon, SitemapIcon } from '../../components/Icons';

type UrlInputMethod = 'ahrefs' | 'sitemap' | 'manual';

interface MappingResult {
    keyword: string;
    mapped_url: string;
    confidence: 'High' | 'Medium' | 'Low';
    reasoning: string;
}

interface UrlProfile {
    url: string;
    top_keywords: string[];
}

const PROMPT_TEMPLATE = `
# ROLE:
You are an expert-level Technical SEO Analyst specializing in keyword-to-URL mapping.

# TASK:
Your objective is to map each keyword from the provided 'KEYWORD_LIST' to the single most semantically relevant and appropriate URL from the 'URL_KEYWORD_PROFILES'. You must analyze the user's likely intent behind the keyword and match it to the URL that would best satisfy that intent, using the provided keyword profiles as your primary source of truth for a URL's relevance.

# CONSTRAINTS:
1.  **Strict Adherence to List:** You MUST only choose URLs that are present in the 'URL_KEYWORD_PROFILES'.
2.  **No Invention:** Do not, under any circumstances, invent, create, or modify URLs.
3.  **One-to-One Mapping:** Each keyword must be mapped to exactly one URL.
4.  **Prioritize Keyword Profiles:** Your primary matching signal should be the \`top_keywords\` associated with each URL. If a user's keyword is semantically very close to one or more of a URL's \`top_keywords\`, that is a very strong match.
5.  **Semantic Analysis:** For keywords that don't have a close match in any \`top_keywords\` list, use semantic analysis of the URL string and the user keyword's intent. For example, the keyword "buy running sneakers" should map to a product category page like '/collections/mens-running-shoes' which likely ranks for commercial-intent keywords, rather than a blog post.
6.  **Fallback:** If you cannot find a reasonably relevant URL for a specific keyword, you MUST map it to the domain's homepage (e.g., the root URL in the provided list) and assign a 'Low' confidence score.
7.  **Confidence Score:** Assign a confidence level ('High', 'Medium', 'Low').
    *   'High': The user keyword is identical or a very close synonym to a keyword in the URL's \`top_keywords\`.
    *   'Medium': The user keyword is topically related to the URL's \`top_keywords\` and content theme.
    *   'Low': It's a broad or fallback match.

# INPUT DATA:
---
## KEYWORD_LIST (one per line):
{KEYWORDS}
---
## URL_KEYWORD_PROFILES (JSON format):
{URL_PROFILES}
---

# OUTPUT SPECIFICATION:
Your final output MUST be a single, valid JSON array of objects. Each object must strictly adhere to the following schema. Do not include any other text, explanations, or apologies outside of this JSON structure.

[
  {
    "keyword": "string",
    "mapped_url": "string",
    "confidence": "string (High|Medium|Low)",
    "reasoning": "string (A brief explanation for your mapping choice, specifically mentioning which top keywords you matched against, if any.)"
  }
]

BEGIN.
`;

const convertResultsToCsv = (results: MappingResult[]): string => {
    if (!results || results.length === 0) return '';
    const headers = ["keyword", "mapped_url", "confidence", "reasoning"];
    const csvRows = [
        headers.join(','), 
        ...results.map(row => 
            headers.map(header => {
                const value = row[header as keyof MappingResult];
                const stringValue = String(value).replace(/"/g, '""');
                if (/[",\n\r]/.test(stringValue)) {
                    return `"${stringValue}"`;
                }
                return stringValue;
            }).join(',')
        )
    ];
    return csvRows.join('\n');
};

export const KeywordUrlMapper = ({ onBack }: { onBack: () => void }) => {
    // API Key State
    const [apiKey, setApiKey] = useState('');
    const [isKeyValidated, setIsKeyValidated] = useState(false);
    const [isKeyValidating, setIsKeyValidating] = useState(false);
    const [apiKeyError, setApiKeyError] = useState('');

    // Input State
    const [keywords, setKeywords] = useState('');
    const [validUrls, setValidUrls] = useState('');
    const [keywordFile, setKeywordFile] = useState<File | null>(null);
    const [urlProfiles, setUrlProfiles] = useState<UrlProfile[]>([]);
    
    // URL Source State
    const [urlInputMethod, setUrlInputMethod] = useState<UrlInputMethod>('manual');
    const [targetDomain, setTargetDomain] = useState('');
    const [ahrefsApiKey, setAhrefsApiKey] = useState('');
    const [sitemapUrl, setSitemapUrl] = useState('');
    const [isFetchingUrls, setIsFetchingUrls] = useState(false);
    const [fetchUrlsSuccess, setFetchUrlsSuccess] = useState('');
    const [fetchUrlsError, setFetchUrlsError] = useState('');

    // Processing State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<MappingResult[]>([]);
    const [progressMessage, setProgressMessage] = useState('');
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.csv')) {
                setKeywordFile(file);
                const fileContent = await file.text();
                setKeywords(fileContent);
                setError('');
            } else {
                setKeywordFile(null);
                setError('Please upload a valid .txt or .csv file for keywords.');
            }
        }
    };
    
    const handleValidateKey = async () => {
        if (!apiKey.trim()) {
            setApiKeyError('API Key cannot be empty.');
            return;
        }
        setIsKeyValidating(true);
        setApiKeyError('');
        try {
            const ai = new GoogleGenAI({ apiKey });
            await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
            setIsKeyValidated(true);
        } catch (e) {
            setApiKeyError('Invalid API Key. Please check the key and try again.');
            setIsKeyValidated(false);
        } finally {
            setIsKeyValidating(false);
        }
    };

    const handleResetKey = () => {
        setIsKeyValidated(false);
        setApiKey('');
        setApiKeyError('');
    };

    const handleFetchAhrefsUrls = async () => {
        if (!targetDomain || !ahrefsApiKey) {
            setFetchUrlsError('Domain and Ahrefs API Key are required.');
            return;
        }
        setIsFetchingUrls(true);
        setFetchUrlsError('');
        setFetchUrlsSuccess('');
        setUrlProfiles([]);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const domain = targetDomain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

        const simulatedProfiles: UrlProfile[] = [
            { url: `https://${domain}/`, top_keywords: [`${domain} homepage`, `official site ${domain}`] },
            { url: `https://${domain}/running-shoes`, top_keywords: ["men's running shoes", "best running sneakers", "nike running shoes"] },
            { url: `https://${domain}/hiking-boots`, top_keywords: ["waterproof hiking boots", "merrell hiking boots", "best boots for hiking"] },
            { url: `https://${domain}/blog/how-to-choose-shoes`, top_keywords: ["how to choose running shoes", "shoe fitting guide", "what shoes to buy"] },
            { url: `https://${domain}/about-us`, top_keywords: [`about ${domain}`, "company history", "our mission"] },
            { url: `https://${domain}/contact`, top_keywords: ["contact us", "customer service", "support phone number"] },
        ];
        
        setUrlProfiles(simulatedProfiles);
        const displayText = simulatedProfiles.map(p => `URL: ${p.url}\nKeywords: ${p.top_keywords.join(', ')}`).join('\n\n');
        setValidUrls(displayText);
        setFetchUrlsSuccess(`✓ Successfully simulated fetching ${simulatedProfiles.length} URL profiles from Ahrefs for ${domain}.`);
        setIsFetchingUrls(false);
    };

    const handleFetchSitemapUrls = async () => {
        if (!sitemapUrl) {
            setFetchUrlsError('Sitemap URL is required.');
            return;
        }
        setIsFetchingUrls(true);
        setFetchUrlsError('');
        setFetchUrlsSuccess('');
        setUrlProfiles([]);
        
        try {
            const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(sitemapUrl)}`);
            if (!response.ok) throw new Error(`Failed to fetch sitemap. Status: ${response.status}`);

            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            const errorNode = xmlDoc.querySelector("parsererror");
            if (errorNode) throw new Error("Failed to parse sitemap XML.");
            
            const urls = Array.from(xmlDoc.querySelectorAll("loc")).map(loc => loc.textContent?.trim()).filter(Boolean) as string[];
            if (urls.length === 0) throw new Error("No <loc> tags found in the sitemap.");
            
            setValidUrls(urls.join('\n'));
            setFetchUrlsSuccess(`✓ Successfully fetched ${urls.length} URLs from the sitemap.`);

        } catch (err: any) {
            setFetchUrlsError(`✗ Error: ${err.message}`);
        } finally {
            setIsFetchingUrls(false);
        }
    };

    const handleMapKeywords = async () => {
        setError('');
        if (!isKeyValidated || keywords.trim() === '' || validUrls.trim() === '') {
            setError('API Key, keywords, and a list of valid URLs are required.');
            return;
        }

        setIsLoading(true);
        setResults([]);
        setProgressMessage('Initializing AI model and constructing prompt...');

        try {
            const ai = new GoogleGenAI({ apiKey });

            let urlProfilesData: UrlProfile[];
            if (urlInputMethod === 'ahrefs' && urlProfiles.length > 0) {
                urlProfilesData = urlProfiles;
            } else {
                urlProfilesData = validUrls.trim().split(/\r?\n/).map(url => ({
                    url: url.trim(),
                    top_keywords: []
                })).filter(p => p.url);
            }

            if (urlProfilesData.length === 0) {
                throw new Error("The list of valid URLs is empty or could not be parsed.");
            }

            let prompt = PROMPT_TEMPLATE
                .replace('{KEYWORDS}', keywords)
                .replace('{URL_PROFILES}', JSON.stringify(urlProfilesData, null, 2));
            
            setProgressMessage('Sending request to Gemini for analysis...');
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                keyword: { type: Type.STRING },
                                mapped_url: { type: Type.STRING },
                                confidence: { type: Type.STRING },
                                reasoning: { type: Type.STRING },
                            },
                            required: ["keyword", "mapped_url", "confidence", "reasoning"],
                        },
                    },
                },
            });

            setProgressMessage('Parsing results...');
            const parsedResults = JSON.parse(response.text);
            setResults(parsedResults as MappingResult[]);

        } catch (e) {
            console.error("Error during AI mapping:", e);
            setError("An error occurred. The model may have returned an invalid response. Check console for details.");
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };
    
    const downloadFile = (content: string, fileName: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getConfidenceClass = (score: string) => {
        if (score === 'High') return 'confidence-high';
        if (score === 'Medium') return 'confidence-medium';
        return 'confidence-low';
    };

    const isButtonDisabled = isLoading || !isKeyValidated || keywords.trim() === '' || validUrls.trim() === '';

    const renderUrlInput = () => {
        const isReadOnly = (urlInputMethod === 'ahrefs' || urlInputMethod === 'sitemap') && isFetchingUrls;

        switch (urlInputMethod) {
            case 'ahrefs':
                return (
                    <>
                        <div className="data-source-inputs">
                            <input type="text" placeholder="example.com" value={targetDomain} onChange={e => setTargetDomain(e.target.value)} disabled={isFetchingUrls}/>
                            <input type="password" placeholder="Ahrefs API Key" value={ahrefsApiKey} onChange={e => setAhrefsApiKey(e.target.value)} disabled={isFetchingUrls}/>
                            <button className="btn btn-secondary" onClick={handleFetchAhrefsUrls} disabled={isFetchingUrls || !targetDomain || !ahrefsApiKey}>
                                {isFetchingUrls ? 'Fetching...' : 'Fetch URL Profiles'}
                            </button>
                        </div>
                        <textarea placeholder="URL profiles fetched from Ahrefs will appear here..." value={validUrls} onChange={e => setValidUrls(e.target.value)} rows={10} readOnly={true} style={{marginTop: '8px', backgroundColor: 'var(--subtle-background)'}}/>
                    </>
                );
            case 'sitemap':
                 return (
                    <>
                        <div className="data-source-inputs">
                            <input type="text" placeholder="https://example.com/sitemap.xml" value={sitemapUrl} onChange={e => setSitemapUrl(e.target.value)} disabled={isFetchingUrls}/>
                            <button className="btn btn-secondary" onClick={handleFetchSitemapUrls} disabled={isFetchingUrls || !sitemapUrl}>
                               {isFetchingUrls ? 'Fetching...' : 'Fetch URLs from Sitemap'}
                            </button>
                        </div>
                        <textarea placeholder="URLs fetched from the sitemap will appear here..." value={validUrls} onChange={e => setValidUrls(e.target.value)} rows={10} readOnly={isReadOnly} style={{marginTop: '8px', backgroundColor: isReadOnly ? 'var(--subtle-background)' : 'var(--primary-background)'}}/>
                    </>
                );
            case 'manual':
            default:
                return <textarea placeholder="https://example.com/page-1&#10;https://example.com/page-2&#10;..." value={validUrls} onChange={e => setValidUrls(e.target.value)} rows={10} />;
        }
    };

    return (
        <>
            <h1>AI Keyword to URL Mapper</h1>
            <p>Map keywords to their most semantically relevant existing URLs on a target domain using AI analysis.</p>

            <div className="panel">
                <div className="form-group">
                    <label style={{ fontWeight: 700 }}>Step 1: Validate Your Gemini API Key</label>
                    <div className="input-with-button">
                        <input id="api-key" type="password" placeholder="Enter your Gemini API Key..." value={apiKey} onChange={e => setApiKey(e.target.value)} disabled={isKeyValidated || isKeyValidating} className={apiKeyError ? 'input-error' : ''} />
                        {!isKeyValidated ? (
                            <button className="btn btn-secondary" onClick={handleValidateKey} disabled={isKeyValidating || !apiKey}>
                                {isKeyValidating ? 'Validating...' : 'Validate Key'}
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={handleResetKey}>Change Key</button>
                        )}
                    </div>
                    {apiKeyError && <p className="form-error-message">{apiKeyError}</p>}
                    {isKeyValidated && <p style={{ color: '#4ade80', fontWeight: 500, marginTop: '8px' }}>✓ API Key successfully validated.</p>}
                </div>
            </div>
            
            <div className="panel" style={{ opacity: isKeyValidated ? 1 : 0.4 }}>
                <fieldset disabled={!isKeyValidated} style={{ border: 'none', padding: 0, margin: 0 }}>
                    <div className="redirect-mapper-inputs" style={{gridTemplateColumns: '1fr', gap: 'calc(var(--base-unit) * 4)'}}>
                        <div className="form-group">
                            <label style={{ fontWeight: 700, fontSize: '16px' }}>Step 2: Provide Keywords</label>
                            <label htmlFor="keyword-upload" className="file-label-small" style={{display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                                <FileUploadIcon /> {keywordFile ? keywordFile.name : 'Upload .txt or .csv'}
                            </label>
                            <input id="keyword-upload" type="file" accept=".txt,.csv,text/plain,text/csv" onChange={handleFileChange} style={{display: 'none'}} />
                            <textarea id="keywords-input" placeholder="Paste one keyword per line..." value={keywords} onChange={e => setKeywords(e.target.value)} rows={10} />
                        </div>
                        <div className="form-group">
                             <label style={{ fontWeight: 700, fontSize: '16px' }}>Step 3: Provide Valid URLs for Mapping</label>
                            <div className="segmented-control" style={{marginBottom: '16px'}}>
                                <button className={urlInputMethod === 'manual' ? 'active' : ''} onClick={() => setUrlInputMethod('manual')}>Paste Manually</button>
                                <button className={urlInputMethod === 'sitemap' ? 'active' : ''} onClick={() => setUrlInputMethod('sitemap')}>From Sitemap</button>
                                <button className={urlInputMethod === 'ahrefs' ? 'active' : ''} onClick={() => setUrlInputMethod('ahrefs')}>From Ahrefs</button>
                            </div>
                            {renderUrlInput()}
                            {fetchUrlsError && <p className="form-error-message" style={{marginTop: '8px'}}>{fetchUrlsError}</p>}
                            {fetchUrlsSuccess && <p style={{ color: '#4ade80', fontWeight: 500, marginTop: '8px' }}>{fetchUrlsSuccess}</p>}
                        </div>
                    </div>
                </fieldset>
            </div>

            {error && <p style={{ color: '#ff8a8a', textAlign: 'center', fontWeight: 500 }}>{error}</p>}
            
            {isLoading && (
                <div className="progress-section">
                    <p>{progressMessage || 'Processing...'}</p>
                    <div className="progress-bar-container"><div className="progress-bar-fill indeterminate"></div></div>
                </div>
            )}

            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleMapKeywords} disabled={isButtonDisabled}>
                    {isLoading ? 'Mapping...' : 'Map Keywords'}
                </button>
            </div>

            {results.length > 0 && !isLoading && (
                <div className="result-section">
                    <h2>Mapping Results</h2>
                    <div className="download-actions">
                        <button className="btn btn-secondary" onClick={() => downloadFile(JSON.stringify(results, null, 2), 'keyword-map.json', 'application/json')}>Download JSON</button>
                        <button className="btn btn-primary" onClick={() => downloadFile(convertResultsToCsv(results), 'keyword-map.csv', 'text/csv')}>Download CSV</button>
                    </div>
                    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
                        <table className="result-table">
                            <thead>
                                <tr>
                                    <th>Keyword</th>
                                    <th>Mapped URL</th>
                                    <th>Confidence</th>
                                    <th>AI Reasoning</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((res, i) => (
                                    <tr key={i}>
                                        <td>{res.keyword}</td>
                                        <td style={{ wordBreak: 'break-all' }}><a href={res.mapped_url} target="_blank" rel="noopener noreferrer">{res.mapped_url}</a></td>
                                        <td><span className={`confidence-badge ${getConfidenceClass(res.confidence)}`}>{res.confidence}</span></td>
                                        <td>{res.reasoning}</td>
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