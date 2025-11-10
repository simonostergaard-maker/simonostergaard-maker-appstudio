import { GoogleGenAI, Type } from "@google/genai";
import React, { useState } from 'react';
import { CounterBar } from '../../components/common/CounterBar';

// Types
type AnalysisMode = 'CONTENT_ONLY' | 'KEYWORD_ENRICHED';
type ElementsToGenerate = {
    title: boolean;
    meta: boolean;
    h1: boolean;
    h2: boolean;
};
interface OptimizationResult {
    url: string;
    keyword?: string;
    status: 'success' | 'error' | 'pending';
    errorMessage?: string;
    language?: string;
    title_tag?: string | null;
    meta_description?: string | null;
    h1?: string | null;
    h2s?: string | null;
}
interface GeminiResponse {
    language_detected: string;
    title_tag: string | null;
    meta_description: string | null;
    h1: string | null;
    h2s: string | null;
}

const PROMPT_TEMPLATE = `
# ROLE & OBJECTIVE
You are an expert Technical SEO and Content Strategist. Your task is to analyze the provided text content from a webpage and generate specific SEO elements in the same language as the content. You must adhere strictly to all constraints.

# ANALYSIS
1.  **Language Detection:** First, identify the primary language of the provided 'PAGE_CONTENT'. All your generated output MUST be in this detected language.
2.  **Content Synthesis:** Understand the core topic, user intent, and key entities discussed in the 'PAGE_CONTENT'.

# TASK: GENERATE SEO ELEMENTS
Based on your analysis, generate the following elements specified in the 'ELEMENTS_TO_GENERATE' list.

# CONSTRAINTS & RULES
{KEYWORD_CONSTRAINT}
- **Title Tag:** Must be compelling and highly relevant. It MUST NOT exceed 62 characters. Aim for a length between 55-62 characters.
- **Meta Description:** Must be an engaging summary that encourages clicks. It MUST NOT exceed 160 characters. Aim for a length between 140-160 characters.
- **H1:** Must be a clear and concise main heading for the page.
- **H2s:** Generate 2-3 relevant subheadings that could be used on the page. They should cover sub-topics present in the content. Output them as a single, comma-separated string.
- **Language:** The language of all generated elements MUST match the detected language of the 'PAGE_CONTENT'.

# INPUT DATA
---
## PAGE_CONTENT:
{PAGE_CONTENT}
---
## PRIMARY_KEYWORD:
{PRIMARY_KEYWORD}
---
## ELEMENTS_TO_GENERATE:
{ELEMENTS_LIST}
---

# OUTPUT SPECIFICATION
Your entire response must be a single, valid JSON object. Do not include any other text before or after the JSON.
`;

const extractMainContent = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, nav, footer, header, aside').forEach(el => el.remove());
    let text = doc.body?.textContent || '';
    text = text.replace(/\s\s+/g, ' ').trim();
    return text.substring(0, 15000); // Limit content size for API
};

const convertResultsToCsv = (results: OptimizationResult[], elements: ElementsToGenerate): string => {
    const headers = ['URL', 'Keyword', 'Status', 'Error'];
    if (elements.title) headers.push('Generated Title');
    if (elements.meta) headers.push('Generated Meta Description');
    if (elements.h1) headers.push('Generated H1');
    if (elements.h2) headers.push('Generated H2s');

    const rows = results.map(res => {
        const row: (string | undefined)[] = [
            res.url,
            res.keyword || '',
            res.status,
            res.errorMessage || ''
        ];
        if (elements.title) row.push(res.title_tag || '');
        if (elements.meta) row.push(res.meta_description || '');
        if (elements.h1) row.push(res.h1 || '');
        if (elements.h2) row.push(res.h2s || '');
        
        return row.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};


export const AiOnPageOptimizer = ({ onBack }: { onBack: () => void; }) => {
    const [apiKey, setApiKey] = useState('');
    const [isKeyValidated, setIsKeyValidated] = useState(false);
    const [isKeyValidating, setIsKeyValidating] = useState(false);
    const [apiKeyError, setApiKeyError] = useState('');

    const [urls, setUrls] = useState('');
    const [keywords, setKeywords] = useState('');
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('CONTENT_ONLY');
    const [elementsToGenerate, setElementsToGenerate] = useState<ElementsToGenerate>({
        title: true, meta: true, h1: false, h2: false
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progressMessage, setProgressMessage] = useState('');
    const [results, setResults] = useState<OptimizationResult[]>([]);

    const handleValidateKey = async () => {
        if (!apiKey.trim()) { setApiKeyError('API Key cannot be empty.'); return; }
        setIsKeyValidating(true); setApiKeyError('');
        try {
            const ai = new GoogleGenAI({ apiKey });
            await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
            setIsKeyValidated(true);
        } catch (e) {
            setApiKeyError('Invalid API Key. Please check it and try again.');
            setIsKeyValidated(false);
        } finally {
            setIsKeyValidating(false);
        }
    };

    const handleResetKey = () => {
        setIsKeyValidated(false); setApiKey(''); setApiKeyError('');
    };
    
    const handleGenerate = async () => {
        setError('');
        const urlList = urls.trim().split(/\r?\n/).filter(Boolean);
        const keywordList = keywords.trim().split(/\r?\n/).filter(Boolean);

        if (urlList.length === 0) {
            setError('Please enter at least one URL.');
            return;
        }

        if (analysisMode === 'KEYWORD_ENRICHED' && keywordList.length > 0 && urlList.length !== keywordList.length) {
            setError('The number of keywords must match the number of URLs.');
            return;
        }

        if (!Object.values(elementsToGenerate).some(v => v)) {
            setError('Please select at least one element to generate.');
            return;
        }

        setIsLoading(true);
        const initialResults: OptimizationResult[] = urlList.map((url, i) => ({
            url,
            keyword: analysisMode === 'KEYWORD_ENRICHED' ? keywordList[i] || '' : undefined,
            status: 'pending'
        }));
        setResults(initialResults);

        const ai = new GoogleGenAI({ apiKey });
        const finalResults: OptimizationResult[] = [];

        for (let i = 0; i < urlList.length; i++) {
            const url = urlList[i];
            const keyword = analysisMode === 'KEYWORD_ENRICHED' ? keywordList[i] : undefined;
            setProgressMessage(`Processing URL ${i + 1} of ${urlList.length}: ${url}`);

            try {
                // 1. Fetch content
                setProgressMessage(`Fetching content for URL ${i + 1}...`);
                const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
                if (!response.ok) throw new Error(`Failed to fetch content. Status: ${response.status}`);
                const html = await response.text();
                const content = extractMainContent(html);
                if (!content) throw new Error("Could not extract any meaningful content from the page.");

                // 2. Prepare and call Gemini
                setProgressMessage(`Analyzing with AI for URL ${i + 1}...`);
                let keywordConstraint = '';
                if (analysisMode === 'KEYWORD_ENRICHED' && keyword) {
                    keywordConstraint = `- **Primary Keyword Integration:** The provided 'PRIMARY_KEYWORD' is critical. It MUST be included naturally in the 'Title Tag' and the 'H1'. It should ideally be included in the 'Meta Description' if it fits naturally.`;
                }

                const elementsList = Object.entries(elementsToGenerate)
                    .filter(([, value]) => value)
                    .map(([key]) => {
                        if (key === 'title') return 'title_tag';
                        if (key === 'meta') return 'meta_description';
                        return key;
                    });
                
                const schemaProperties: any = { language_detected: { type: Type.STRING } };
                if (elementsToGenerate.title) schemaProperties.title_tag = { type: Type.STRING, nullable: true };
                if (elementsToGenerate.meta) schemaProperties.meta_description = { type: Type.STRING, nullable: true };
                if (elementsToGenerate.h1) schemaProperties.h1 = { type: Type.STRING, nullable: true };
                if (elementsToGenerate.h2) schemaProperties.h2s = { type: Type.STRING, nullable: true };

                const prompt = PROMPT_TEMPLATE
                    .replace('{KEYWORD_CONSTRAINT}', keywordConstraint)
                    .replace('{PAGE_CONTENT}', content)
                    .replace('{PRIMARY_KEYWORD}', keyword || 'N/A')
                    .replace('{ELEMENTS_LIST}', JSON.stringify(elementsList));

                const genAIResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: schemaProperties
                        }
                    }
                });

                const geminiResult = JSON.parse(genAIResponse.text) as GeminiResponse;

                finalResults.push({
                    url, keyword, status: 'success', ...geminiResult
                });

            } catch (e: any) {
                finalResults.push({
                    url, keyword, status: 'error', errorMessage: e.message
                });
            }
             setResults([...finalResults, ...initialResults.slice(finalResults.length)]);
        }

        setIsLoading(false);
        setProgressMessage('');
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


    return (
        <>
            <h1>AI On-Page Content Optimizer</h1>
            <p>Generate SEO-friendly titles, descriptions, and headings for a list of URLs based on their content.</p>

            <div className="panel">
                <div className="form-group">
                    <label style={{ fontWeight: 700 }}>Step 1: Validate Your Gemini API Key</label>
                    <div className="input-with-button">
                        <input type="password" placeholder="Enter Gemini API Key..." value={apiKey} onChange={e => setApiKey(e.target.value)} disabled={isKeyValidated || isKeyValidating} className={apiKeyError ? 'input-error' : ''} />
                        {!isKeyValidated ? (
                            <button className="btn btn-secondary" onClick={handleValidateKey} disabled={isKeyValidating || !apiKey}>{isKeyValidating ? 'Validating...' : 'Validate Key'}</button>
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
                    <div className="form-group">
                        <label style={{ fontWeight: 700, fontSize: '16px' }}>Step 2: Provide URLs & Options</label>
                        <div className="redirect-mapper-inputs">
                            <div className="form-group">
                                <label htmlFor="urls">URLs (one per line)</label>
                                <textarea id="urls" placeholder="https://example.com/page-1&#10;https://example.com/page-2" value={urls} onChange={e => setUrls(e.target.value)} rows={8} />
                            </div>
                            <div className="form-group" style={{ opacity: analysisMode === 'KEYWORD_ENRICHED' ? 1 : 0.4 }}>
                                <label htmlFor="keywords">Primary Keywords (optional, one per line)</label>
                                <textarea id="keywords" placeholder="keyword for page 1&#10;keyword for page 2" value={keywords} onChange={e => setKeywords(e.target.value)} rows={8} disabled={analysisMode !== 'KEYWORD_ENRICHED'} />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                         <label>Analysis Mode</label>
                         <div className="segmented-control">
                            <button className={analysisMode === 'CONTENT_ONLY' ? 'active' : ''} onClick={() => setAnalysisMode('CONTENT_ONLY')}>Content Only</button>
                            <button className={analysisMode === 'KEYWORD_ENRICHED' ? 'active' : ''} onClick={() => setAnalysisMode('KEYWORD_ENRICHED')}>Enrich with Keywords</button>
                        </div>
                    </div>
                     <div className="form-group">
                        <label>Elements to Generate</label>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            {Object.keys(elementsToGenerate).map(key => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 400 }}>
                                    <input type="checkbox" checked={elementsToGenerate[key as keyof ElementsToGenerate]} onChange={e => setElementsToGenerate(prev => ({...prev, [key]: e.target.checked}))} style={{width: '18px', height: '18px'}} />
                                    {key === 'title' && 'Title Tag'}
                                    {key === 'meta' && 'Meta Description'}
                                    {key === 'h1' && 'H1'}
                                    {key === 'h2' && 'H2s'}
                                </label>
                            ))}
                        </div>
                    </div>
                </fieldset>
            </div>

             {error && <p style={{ color: '#ff8a8a', textAlign: 'center', fontWeight: 500 }}>{error}</p>}

             {isLoading && (
                <div className="progress-section">
                    <p>{progressMessage}</p>
                    <div className="progress-bar-container"><div className="progress-bar-fill indeterminate"></div></div>
                </div>
            )}

            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleGenerate} disabled={isLoading || !isKeyValidated || !urls.trim()}>
                    {isLoading ? 'Generating...' : 'Generate Content'}
                </button>
            </div>
            
            {results.length > 0 && !isLoading && (
                 <div className="result-section">
                    <h2>Generated Content</h2>
                     <div className="download-actions">
                        <button className="btn btn-primary" onClick={() => downloadFile(convertResultsToCsv(results, elementsToGenerate), 'on-page-optimizations.csv', 'text/csv')}>Download CSV</button>
                    </div>
                     <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
                        <table className="result-table">
                            <thead>
                                <tr>
                                    <th>URL</th>
                                    {elementsToGenerate.title && <th>Title Tag</th>}
                                    {elementsToGenerate.meta && <th>Meta Description</th>}
                                    {elementsToGenerate.h1 && <th>H1</th>}
                                    {elementsToGenerate.h2 && <th>H2s</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((res, i) => (
                                    <tr key={i}>
                                        <td style={{wordBreak: 'break-all'}}>
                                            <a href={res.url} target="_blank" rel="noopener noreferrer">{res.url}</a>
                                            {res.status === 'error' && <p className="fetch-error" style={{marginTop: '4px'}}>{res.errorMessage}</p>}
                                        </td>
                                        {elementsToGenerate.title && <td>
                                            {res.title_tag}
                                            {res.title_tag && <CounterBar current={res.title_tag.length} max={62} unit="chars" />}
                                        </td>}
                                        {elementsToGenerate.meta && <td>
                                            {res.meta_description}
                                            {res.meta_description && <CounterBar current={res.meta_description.length} max={160} unit="chars" />}
                                        </td>}
                                        {elementsToGenerate.h1 && <td style={{whiteSpace: 'nowrap'}}>{res.h1}</td>}
                                        {elementsToGenerate.h2 && <td>{res.h2s}</td>}
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
