import { GoogleGenAI, Type } from "@google/genai";
import React, { useState } from 'react';
import { AnalyticsIcon, AhrefsIcon, FileUploadIcon, GscIcon, GoogleIcon } from "../../components/Icons";


type AnalysisMode = 'STRING_ANALYSIS' | 'CONTENT_CRAWLING';
type SeoData = Record<string, any>;
type DataSource = 'gsc' | 'ga' | 'ahrefs' | 'manual';

interface MappingResult {
    old_url: string;
    new_url: string;
    match_type: string;
    confidence_score: number;
    high_priority_review: boolean;
    thinking: string;
}

const MASTER_PROMPT_TEMPLATE = `
# MASTER PROMPT: AI-POWERED URL REDIRECT MAPPING ENGINE

<role_definition>
You are an expert-level Technical SEO Analyst and Data Scientist specializing in large-scale website migrations. Your primary goal is to map old URLs to the most relevant new URLs with maximum accuracy, informed by real-world performance data to minimize SEO risk. You are methodical, precise, and operate with a deep understanding of URL structures, semantic content relevance, and SEO performance metrics. You must follow all instructions, constraints, and logical sequences provided below without deviation.
</role_definition>

<task_definition>
## 1. Task Goal:
For every URL provided in the \`OLD_URL_LIST\`, you must find the single best corresponding URL from the \`NEW_URL_LIST\` and generate a structured redirect map in the specified JSON format.

## 2. Input Data & Mode Selection
* \`OLD_URL_LIST\`: A list of all original URLs that require mapping.
* \`NEW_URL_LIST\`: A comprehensive list of all available destination URLs on the new site.
* \`ENRICHED_SEO_DATA\`: An optional structured file (JSON) containing performance metrics for the old URLs, aggregated from sources like Google Search Console, Google Analytics, Ahrefs, or manual uploads.
* \`ANALYSIS_MODE\`: A mandatory user selection. It is set to: \`{ANALYSIS_MODE}\`.

## 3. Core Constraints (Guardrails):
* You MUST only map to URLs present in the \`NEW_URL_LIST\`.
* You MUST NOT invent or create new URLs.
* Each old URL must be mapped to exactly one new URL.
* If no suitable match is found according to the hierarchical logic, the designated fallback URL is the homepage of the new domain (e.g., the root "/" of the most common domain in NEW_URL_LIST).
* If \`ANALYSIS_MODE\` is \`STRING_ANALYSIS\`, do not use external knowledge or tools.
* If \`ANALYSIS_MODE\` is \`CONTENT_CRAWLING\`, you must use the provided googleSearch tool to understand the content of the pages to determine the best match. This is especially important for semantic matching.
</task_definition>

<logic_framework>
## 4. Hierarchical Mapping Process (Chain-of-Thought):
For each URL in the \`OLD_URL_LIST\`, you will perform a sequence of checks precisely as defined in the Hierarchical Mapping Logic Matrix. You must document your reasoning for each step and the final conclusion for each URL inside a "thinking" block before generating the final JSON object for that URL.

### Hierarchical Mapping Logic Matrix:
| Priority | Match Level | Condition | Match Type (Output) | Confidence Score (Output) |
|:---|:---|:---|:---|:---|
| 1 | Exact Match | The path and query string of the \`old_url\` is identical to a \`new_url\`. | Exact | 1.0 |
| 2 | Slug Match | The final path segment (the "slug") of the \`old_url\` exists as the final path segment of a unique URL in \`NEW_URL_LIST\`. | Slug | 0.95 |
| 3 | High-Confidence Semantic Match | If \`ANALYSIS_MODE\` is 'CONTENT_CRAWLING', page content similarity is extremely high (e.g. products are identical). If \`ANALYSIS_MODE\` is 'STRING_ANALYSIS', URL path token Jaccard similarity is greater than 0.9. | Semantic-High | 0.9 |
| 4 | Medium-Confidence Semantic Match | If \`ANALYSIS_MODE\` is 'CONTENT_CRAWLING', page content is closely related (e.g. similar product categories). If \`ANALYSIS_MODE\` is 'STRING_ANALYSIS', URL path token Jaccard similarity is between 0.7 and 0.9. | Semantic-Medium | 0.7 |
| 5 | Parent Path / Category Match | The \`old_url\` shares one or more parent directory paths with a \`new_url\` (e.g., /cat/subcat/page -> /cat/subcat/). | Category | 0.5 |
| 6 | Fallback | No match was found in Priorities 1-5. | Fallback-Homepage | 0.1 |

## 5. SEO Data Integration and Prioritization Logic:
If \`ENRICHED_SEO_DATA\` is provided, you must apply the following logic. This data is your source of truth for a URL's business and SEO value.

### SEO Data Prioritization Rules:
When evaluating a URL or breaking a tie, prioritize information from the data sources in this order of importance:
1.  **Google Search Console (GSC):** Clicks (last 6 months) > Impressions > Position
2.  **Ahrefs:** Estimated Traffic > Number of Ranking Keywords > Referring Domains > Total Backlinks
3.  **Google Analytics (GA):** Organic Pageviews > Organic Conversions > General Conversions (last 6 months)

### Logic Application:
* **Tie-Breaking:** If, during the semantic matching process (Priority 3 or 4), multiple new URLs are identified as potential candidates with similar confidence scores (within a 0.05 tolerance), you must use the \`ENRICHED_SEO_DATA\` for the \`old_url\` to break the tie. The new URL whose content best aligns with the old URL's top keywords, highest traffic, or conversion metrics (according to the prioritization rules) should be chosen. Document this decision clearly in the "thinking" block.
* **Risk Flagging:** After any match is determined (Priorities 1-5), you must consult the \`ENRICHED_SEO_DATA\` for the corresponding \`old_url\`. If the URL meets ANY of the following high-value criteria, you MUST set a \`high_priority_review\` flag to \`true\`. Otherwise, set it to \`false\`.
    *   GSC Clicks > 500
    *   Ahrefs Referring Domains > 20
    *   GA Organic Conversions > 10
    If no SEO data is present for a URL, the flag should be \`false\`.
</logic_framework>

<input_data>
## 6. Provided Data:

### OLD_URL_LIST:
{OLD_URL_LIST}

### NEW_URL_LIST:
{NEW_URL_LIST}

### ENRICHED_SEO_DATA (JSON format, aggregated from all sources):
{ENRICHED_SEO_DATA}
</input_data>

<output_specification>
## 7. Final Output Format:
You must provide the final output as a single JSON array of objects. Each object represents a single old URL and its mapping. The JSON object must strictly adhere to the provided schema. If using tools, you may still return only the JSON. Do not include any other text, explanations, or apologies outside of this JSON structure.
</output_specification>

BEGIN PROCESSING.
`;

const parseCsv = (csvText: string): SeoData[] => {
    try {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const header = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const obj: SeoData = {};
            header.forEach((h, i) => {
                const value = values[i] ? values[i].trim() : '';
                if (!isNaN(Number(value)) && value !== '') {
                    obj[h] = Number(value);
                } else {
                    obj[h] = value;
                }
            });
            return obj;
        });
    } catch (e) {
        console.error("CSV parsing error:", e);
        return [];
    }
};

const convertJsonToCsv = (jsonData: MappingResult[]): string => {
    if (!jsonData || jsonData.length === 0) return '';
    const headers = ["old_url", "new_url", "match_type", "confidence_score", "high_priority_review", "thinking"];
    const csvRows = [
        headers.join(','), 
        ...jsonData.map(row => 
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

export const RedirectMapper = ({ onBack }: { onBack: () => void }) => {
    const [apiKey, setApiKey] = useState('');
    const [isKeyValidated, setIsKeyValidated] = useState(false);
    const [isKeyValidating, setIsKeyValidating] = useState(false);
    const [apiKeyError, setApiKeyError] = useState('');

    const [oldUrls, setOldUrls] = useState('');
    const [newUrls, setNewUrls] = useState('');
    const [seoData, setSeoData] = useState<SeoData[] | null>(null);
    const [seoFileName, setSeoFileName] = useState('');
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('STRING_ANALYSIS');
    
    const [results, setResults] = useState<MappingResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progressMessage, setProgressMessage] = useState('');

    const [oldUrlsError, setOldUrlsError] = useState('');
    const [newUrlsError, setNewUrlsError] = useState('');

    // State for new data enrichment UI
    const [dataSources, setDataSources] = useState<Record<DataSource, boolean>>({
        gsc: false, ga: false, ahrefs: false, manual: false
    });
    const [ahrefsApiKey, setAhrefsApiKey] = useState('');
    const [isGscConnected, setIsGscConnected] = useState(false);
    const [isGaConnected, setIsGaConnected] = useState(false);
    
    const handleDataSourceChange = (source: DataSource) => {
        setDataSources(prev => ({...prev, [source]: !prev[source]}));
    };

    const handleSeoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSeoFileName(file.name);
        setDataSources(prev => ({...prev, manual: true}));
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                if (file.name.endsWith('.json')) {
                    setSeoData(JSON.parse(content));
                } else if (file.name.endsWith('.csv')) {
                    setSeoData(parseCsv(content));
                } else {
                    setError('Unsupported file type. Please use JSON or CSV.');
                    setSeoData(null);
                    setSeoFileName('');
                }
            } catch (err) {
                setError('Error parsing SEO data file.');
                setSeoData(null);
                setSeoFileName('');
            }
        };
        reader.readAsText(file);
    };

    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url, 'https://dummy-base.com');
            if (url.includes(' ')) return false;
            return true;
        } catch (_) {
            return false;
        }
    };

    const validateUrlList = (urlList: string): string => {
        if (!urlList.trim()) return 'This field cannot be empty.';
        const urls = urlList.trim().split(/\r?\n/);
        for (const url of urls) {
            const trimmedUrl = url.trim();
            if (trimmedUrl && !isValidUrl(trimmedUrl)) {
                if (trimmedUrl.includes(' ')) return `URLs cannot contain spaces. Found: "${trimmedUrl}"`;
                return `Invalid URL format detected: "${trimmedUrl}"`;
            }
        }
        return '';
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
            // Make a lightweight, low-cost call to validate the key
            await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
            setIsKeyValidated(true);
        } catch (e) {
            console.error("API Key validation failed:", e);
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

    const handleGenerate = async () => {
        setError('');
        setOldUrlsError('');
        setNewUrlsError('');
        let hasErrors = false;

        const oldUrlsValidationError = validateUrlList(oldUrls);
        if (oldUrlsValidationError) {
            setOldUrlsError(oldUrlsValidationError);
            hasErrors = true;
        }
        
        const newUrlsValidationError = validateUrlList(newUrls);
        if (newUrlsValidationError) {
            setNewUrlsError(newUrlsValidationError);
            hasErrors = true;
        }
        
        if (hasErrors || !isKeyValidated) return;
        
        setIsLoading(true);
        setResults([]);
        setProgressMessage('Initializing AI model...');

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            setProgressMessage('Constructing prompt...');
            let prompt = MASTER_PROMPT_TEMPLATE;
            prompt = prompt.replace('{ANALYSIS_MODE}', analysisMode);
            prompt = prompt.replace('{OLD_URL_LIST}', oldUrls);
            prompt = prompt.replace('{NEW_URL_LIST}', newUrls);
            prompt = prompt.replace('{ENRICHED_SEO_DATA}', seoData ? JSON.stringify(seoData, null, 2) : '{}');

            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        old_url: { type: Type.STRING },
                        new_url: { type: Type.STRING },
                        match_type: { type: Type.STRING },
                        confidence_score: { type: Type.NUMBER },
                        high_priority_review: { type: Type.BOOLEAN },
                        thinking: { type: Type.STRING },
                    },
                    required: ["old_url", "new_url", "match_type", "confidence_score", "high_priority_review", "thinking"],
                },
            };
            
            const config: any = {};

            if (analysisMode === 'CONTENT_CRAWLING') {
                config.tools = [{googleSearch: {}}];
            } else { // 'STRING_ANALYSIS'
                config.responseMimeType = "application/json";
                config.responseSchema = responseSchema;
            }

            setProgressMessage('Sending request to Gemini...');
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config,
            });
            
            setProgressMessage('Parsing results...');
            const resultText = response.text.trim();
            let parsedResults;

            try {
                if (analysisMode === 'CONTENT_CRAWLING') {
                    const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (jsonMatch && jsonMatch[1]) {
                        parsedResults = JSON.parse(jsonMatch[1]);
                    } else {
                        parsedResults = JSON.parse(resultText);
                    }
                } else {
                    parsedResults = JSON.parse(resultText);
                }
            } catch (parseError) {
                 console.error("JSON parsing error:", parseError);
                 console.error("Raw response text:", resultText);
                 throw new Error("Failed to parse the JSON response from the AI model.");
            }

            setResults(parsedResults as MappingResult[]);

        } catch (e) {
            console.error("Error during AI mapping:", e);
             if (e instanceof Error && e.message.includes("Failed to parse")) {
                setError(e.message);
            } else {
                setError("An error occurred while generating the mappings. This could be due to a network issue or an invalid response from the model. Please check the console for details.");
            }
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
    
    const getConfidenceClass = (score: number) => {
        if (score >= 0.9) return 'confidence-high';
        if (score >= 0.7) return 'confidence-medium';
        return 'confidence-low';
    };

    return (
        <>
            <h1>AI-Powered Redirect Mapper</h1>
            <p>Automate your redirect mapping by leveraging AI to analyze URL strings and content semantics, based on the provided blueprint.</p>
            
            <div className="panel">
                 <div className="form-group">
                    <label htmlFor="api-key" style={{fontWeight: 700}}>Step 1: Validate Your Gemini API Key</label>
                     <div className="input-with-button">
                        <input
                            id="api-key"
                            type="password"
                            placeholder="Enter your Gemini API Key..."
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            disabled={isKeyValidated || isKeyValidating}
                            className={apiKeyError ? 'input-error' : ''}
                            aria-invalid={!!apiKeyError}
                            aria-describedby="api-key-error"
                        />
                        {!isKeyValidated ? (
                             <button
                                className="btn btn-secondary"
                                onClick={handleValidateKey}
                                disabled={isKeyValidating || !apiKey}
                                style={{minWidth: '140px'}}
                            >
                                {isKeyValidating ? 'Validating...' : 'Validate Key'}
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={handleResetKey} style={{minWidth: '140px'}}>
                                Change Key
                            </button>
                        )}
                    </div>
                    {apiKeyError && <p id="api-key-error" className="form-error-message">{apiKeyError}</p>}
                    {isKeyValidated && <p style={{ color: '#4ade80', fontWeight: 500, marginTop: 'calc(var(--base-unit) * 1)' }}>✓ API Key successfully validated.</p>}
                </div>
            </div>

            <div className="panel" style={{ opacity: isKeyValidated ? 1 : 0.4, transition: 'opacity 0.3s ease' }}>
                <fieldset disabled={!isKeyValidated} style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend style={{ fontWeight: 700, fontSize: '16px', color: 'var(--heading-text)', width: '100%', paddingBottom: 'calc(var(--base-unit) * 2)' }}>Step 2: Provide Data &amp; Options</legend>
                    <div className="redirect-mapper-inputs">
                        <div className="form-group">
                            <label htmlFor="old-urls">Old URL List</label>
                            <textarea 
                                id="old-urls" 
                                placeholder="Paste one URL per line..." 
                                value={oldUrls} 
                                onChange={e => setOldUrls(e.target.value)}
                                className={oldUrlsError ? 'input-error' : ''}
                                aria-invalid={!!oldUrlsError}
                                aria-describedby="old-urls-error"
                            />
                            {oldUrlsError && <p id="old-urls-error" className="form-error-message">{oldUrlsError}</p>}
                        </div>
                         <div className="form-group">
                            <label htmlFor="new-urls">New URL List</label>
                            <textarea 
                                id="new-urls" 
                                placeholder="Paste one URL per line..." 
                                value={newUrls} 
                                onChange={e => setNewUrls(e.target.value)}
                                className={newUrlsError ? 'input-error' : ''}
                                aria-invalid={!!newUrlsError}
                                aria-describedby="new-urls-error"
                            />
                             {newUrlsError && <p id="new-urls-error" className="form-error-message">{newUrlsError}</p>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Analysis Mode</label>
                        <div className="segmented-control">
                            <button className={analysisMode === 'STRING_ANALYSIS' ? 'active' : ''} onClick={() => setAnalysisMode('STRING_ANALYSIS')}>URL String Analysis (Fast)</button>
                            <button className={analysisMode === 'CONTENT_CRAWLING' ? 'active' : ''} onClick={() => setAnalysisMode('CONTENT_CRAWLING')}>Accurate (Data Enriched)</button>
                        </div>
                    </div>
                    
                    {analysisMode === 'CONTENT_CRAWLING' && (
                        <div className="data-enrichment-panel">
                            <p style={{marginTop: 0, fontWeight: 500, color: 'var(--heading-text)'}}>Data Enrichment Sources</p>
                            <p style={{fontSize: 14, marginTop: '-8px', marginBottom: '16px'}}>Connect data sources to help the AI prioritize URLs based on real-world performance.</p>
                            <div className="data-source-options">
                                <div className="data-source-option">
                                    <div className="data-source-header">
                                        <input id="gsc-check" type="checkbox" checked={false} disabled />
                                        <label htmlFor="gsc-check" style={{ opacity: 0.6, cursor: 'not-allowed' }}>Google Search Console</label>
                                        <GscIcon />
                                    </div>
                                    <p className="data-source-description"><em>(Under Development)</em> Use click, impression, and ranking data to find high-value pages.</p>
                                </div>
                                <div className="data-source-option">
                                    <div className="data-source-header">
                                        <input id="ga-check" type="checkbox" checked={false} disabled />
                                        <label htmlFor="ga-check" style={{ opacity: 0.6, cursor: 'not-allowed' }}>Google Analytics</label>
                                        <AnalyticsIcon />
                                    </div>
                                     <p className="data-source-description"><em>(Under Development)</em> Prioritize pages with high organic traffic and conversions.</p>
                                </div>
                                 <div className="data-source-option">
                                    <div className="data-source-header">
                                        <input id="ahrefs-check" type="checkbox" checked={dataSources.ahrefs} onChange={() => handleDataSourceChange('ahrefs')} />
                                        <label htmlFor="ahrefs-check">Ahrefs</label>
                                        <AhrefsIcon />
                                    </div>
                                    <p className="data-source-description">Incorporate backlink, keyword, and traffic value metrics.</p>
                                    {dataSources.ahrefs && (
                                         <div className="data-source-inputs">
                                            <input type="password" placeholder="Ahrefs API Key" value={ahrefsApiKey} onChange={(e) => setAhrefsApiKey(e.target.value)} />
                                         </div>
                                    )}
                                </div>
                                <div className="data-source-option">
                                    <div className="data-source-header">
                                        <input id="manual-check" type="checkbox" checked={dataSources.manual} onChange={() => handleDataSourceChange('manual')} />
                                        <label htmlFor="manual-check">Manual Upload</label>
                                        <FileUploadIcon />
                                    </div>
                                    <p className="data-source-description">Upload your own CSV or JSON file with SEO performance data.</p>
                                    {dataSources.manual && (
                                        <div className="data-source-inputs">
                                            <label htmlFor="seo-data-upload" className="btn btn-secondary btn-connect">
                                                {seoFileName || 'Upload File'}
                                            </label>
                                            <input id="seo-data-upload" type="file" accept=".csv,.json" onChange={handleSeoFileChange} style={{display: 'none'}}/>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </fieldset>
            </div>

            {error && <p style={{ color: '#ff8a8a', textAlign: 'center' }}>{error}</p>}
            
            {isLoading && (
                 <div className="progress-section">
                    <p>{progressMessage || 'Processing...'}</p>
                    <div className="progress-bar-container" style={{overflow: 'hidden'}}>
                         <div className="progress-bar-fill indeterminate" style={{ width: `100%` }}></div>
                    </div>
                </div>
            )}

            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleGenerate} disabled={isLoading || !isKeyValidated}>
                    {isLoading ? 'Generating...' : 'Generate Mappings'}
                </button>
            </div>
            
            {results.length > 0 && !isLoading && (
                <div className="result-section">
                    <h2>Mapping Results</h2>
                    <div className="download-actions">
                        <button className="btn btn-secondary" onClick={() => downloadFile(JSON.stringify(results, null, 2), 'redirect-map.json', 'application/json')}>Download JSON</button>
                        <button className="btn btn-primary" onClick={() => downloadFile(convertJsonToCsv(results), 'redirect-map.csv', 'text/csv')}>Download CSV</button>
                    </div>
                    <div className="panel" style={{padding: 0, overflowX: 'auto'}}>
                        <table className="result-table">
                            <thead>
                                <tr>
                                    <th>Old URL</th>
                                    <th>Mapped New URL</th>
                                    <th>Match Type</th>
                                    <th>Confidence</th>
                                    <th>Review?</th>
                                    <th>Reasoning</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((res, i) => (
                                    <tr key={i}>
                                        <td style={{wordBreak: 'break-all'}}>{res.old_url}</td>
                                        <td style={{wordBreak: 'break-all'}}>{res.new_url}</td>
                                        <td>{res.match_type}</td>
                                        <td>
                                            <span className={`confidence-badge ${getConfidenceClass(res.confidence_score)}`}>
                                                {(res.confidence_score * 100).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td>
                                            {res.high_priority_review && (
                                                <span className="high-priority-flag" title="High Priority Review Recommended">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                                    Yes
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <details className="thinking-details">
                                                <summary>Show</summary>
                                                <pre>{res.thinking}</pre>
                                            </details>
                                        </td>
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