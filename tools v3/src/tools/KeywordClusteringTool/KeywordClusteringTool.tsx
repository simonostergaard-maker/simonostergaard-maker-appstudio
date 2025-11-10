import { GoogleGenAI, Type } from "@google/genai";
import React, { useState } from 'react';
import { FileUploadIcon } from "../../components/Icons";
import { formatBytes } from "../../utils/formatBytes";

const MASTER_PROMPT_TEMPLATE = `
# ROLE & OBJECTIVE
You are an expert AI system designed to replicate the core functionality of a SERP-driven keyword clustering tool, as detailed in a comprehensive technical blueprint. Your primary purpose is to ingest a list of user-provided keywords, simulate an analysis of live Google Search Engine Results Pages (SERPs) for a specified location and device, and utilize an unsupervised hierarchical clustering methodology to group these keywords into topically relevant clusters (pages) and silos (categories). The final output must be an actionable blueprint for creating a topical authority-based content strategy.

# CORE METHODOLOGY (SIMULATED)
1.  **SERP as Truth:** You will operate on the principle that if Google consistently ranks the same set of URLs for different keywords, those keywords share the same user intent and belong on the same page.
2.  **Weighted Similarity:** Your internal logic must prioritize SERP overlaps in higher-ranking positions as stronger signals of shared intent.
3.  **Hierarchical Clustering:** You will perform a "bottom-up" clustering process. First, group keywords with extremely high SERP overlap (conceptually). Then, group those smaller clusters into larger, topically related "silos".

# CONSTRAINTS
- The clustering algorithm must remain "unbiased." You MUST NOT use provided performance metrics (Volume, Difficulty, CPC) to determine the clusters. These metrics are only for context and must be passed through to the final report.
- The final output MUST be a single, valid JSON object that strictly adheres to the schema provided in the OUTPUT SPECIFICATION section.
- You must generate a unique, integer-based Cluster_ID for each final cluster (page).
- You must generate a unique, integer-based Silo_ID for each parent silo (category).
- You must generate a descriptive \`Cluster_Name\` for each cluster. This should be a short, title-like name representing the core topic of the keywords within, often derived from the most representative or highest-volume keyword.
- You must generate a \`Cluster_Confidence\` score (a float between 0.0 and 1.0) for each group, indicating how tightly related the keywords are based on your simulated SERP analysis.

# INPUT DATA
- **KEYWORD_DATA:** A CSV-formatted string. The first column MUST be "Keyword". Additional optional columns like "Volume", "Difficulty", "CPC" may be present.
- **GEOLOCATION:** {GEOLOCATION}
- **DEVICE_TYPE:** {DEVICE_TYPE}

---
## KEYWORD_DATA:
\`\`\`csv
{KEYWORD_DATA}
\`\`\`
---

# OUTPUT SPECIFICATION
Your entire response must be a single JSON object. Do not include any text before or after the JSON object.

## JSON OUTPUT SCHEMA:
{
  "reportData": [
    {
      "Keyword": "string (The original keyword)",
      "Volume": "integer|null (Passed-through, if provided)",
      "Difficulty": "integer|null (Passed-through, if provided)",
      "CPC": "float|null (Passed-through, if provided)",
      "Cluster_ID": "integer",
      "Silo_ID": "integer",
      "Cluster_Name": "string",
      "Cluster_Confidence": "float"
    }
  ],
  "dendrogramData": {
    "name": "All Keywords",
    "children": [
      {
        "name": "string (Silo_Name)",
        "siloId": "integer",
        "children": [
          {
            "name": "string (Cluster_Name)",
            "clusterId": "integer",
            "children": [
              {
                "name": "string (Keyword)",
                "volume": "integer|null"
              }
            ]
          }
        ]
      }
    ]
  }
}

BEGIN.
`;

// Types
interface ReportRow {
    Keyword: string;
    Volume?: number | null;
    Difficulty?: number | null;
    CPC?: number | null;
    Cluster_ID: number;
    Silo_ID: number;
    Cluster_Name: string;
    Cluster_Confidence: number;
}
interface DendrogramNode {
    name: string;
    siloId?: number;
    clusterId?: number;
    volume?: number | null;
    children?: DendrogramNode[];
}
interface ClusteringResults {
    reportData: ReportRow[];
    dendrogramData: DendrogramNode;
}
interface ClusteredTopic {
  clusterId: number;
  clusterName: string;
  siloId: number;
  primaryKeyword: ReportRow;
  otherKeywords: ReportRow[];
  totalVolume: number;
  keywordCount: number;
}


// Recursive component to render the dendrogram
const DendrogramNodeComponent: React.FC<{ node: DendrogramNode }> = ({ node }) => {
    return (
        <li className={node.siloId ? 'silo-node' : (node.clusterId ? 'cluster-node' : 'keyword-node')}>
            <span className="node-name">{node.name}</span>
            {node.volume != null && <span className="node-volume"> (Volume: {node.volume})</span>}
            {node.children && node.children.length > 0 && (
                <ul>
                    {node.children.map((child, index) => (
                        <DendrogramNodeComponent key={index} node={child} />
                    ))}
                </ul>
            )}
        </li>
    );
};

const groupReportData = (reportData: ReportRow[]): ClusteredTopic[] => {
    const clusters = new Map<number, ReportRow[]>();

    // Group keywords by Cluster_ID
    for (const row of reportData) {
        if (!clusters.has(row.Cluster_ID)) {
            clusters.set(row.Cluster_ID, []);
        }
        clusters.get(row.Cluster_ID)!.push(row);
    }

    const groupedResults: ClusteredTopic[] = [];

    // Process each group
    for (const [clusterId, keywordsInCluster] of clusters.entries()) {
        if (keywordsInCluster.length === 0) continue;

        // Find primary keyword (highest volume), handling null/undefined volumes
        const sortedByVolume = [...keywordsInCluster].sort((a, b) => (b.Volume ?? 0) - (a.Volume ?? 0));
        const primaryKeyword = sortedByVolume[0];
        const otherKeywords = sortedByVolume.slice(1);

        const totalVolume = keywordsInCluster.reduce((sum, kw) => sum + (kw.Volume ?? 0), 0);

        groupedResults.push({
            clusterId,
            clusterName: primaryKeyword.Cluster_Name, // Name is consistent across the cluster
            siloId: primaryKeyword.Silo_ID, // Silo is consistent across the cluster
            primaryKeyword,
            otherKeywords,
            totalVolume,
            keywordCount: keywordsInCluster.length,
        });
    }

    // Sort the final grouped topics by total volume descending
    return groupedResults.sort((a, b) => b.totalVolume - a.totalVolume);
};


// Main Tool Component
export const KeywordClusteringTool = ({ onBack }: { onBack: () => void }) => {
    // API Key State
    const [apiKey, setApiKey] = useState('');
    const [isKeyValidated, setIsKeyValidated] = useState(false);
    const [isKeyValidating, setIsKeyValidating] = useState(false);
    const [apiKeyError, setApiKeyError] = useState('');

    // Input State
    const [keywords, setKeywords] = useState('');
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [geolocation, setGeolocation] = useState('United States');
    const [device, setDevice] = useState('Desktop');
    const [activeTab, setActiveTab] = useState<'report' | 'map'>('report');

    // Processing State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progressMessage, setProgressMessage] = useState('');
    const [results, setResults] = useState<ClusteringResults | null>(null);
    const [groupedResults, setGroupedResults] = useState<ClusteredTopic[] | null>(null);

    const handleValidateKey = async () => {
        if (!apiKey.trim()) { setApiKeyError('API Key cannot be empty.'); return; }
        setIsKeyValidating(true);
        setApiKeyError('');
        try {
            const ai = new GoogleGenAI({ apiKey });
            await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
            setIsKeyValidated(true);
        } catch (e) {
            setApiKeyError('Invalid API Key. Please check and try again.');
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
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            setInputFile(file);
            const content = await file.text();
            setKeywords(content);
            setError('');
        } else {
            setInputFile(null);
            setKeywords('');
            setError('Invalid file type. Please upload a CSV file.');
        }
    };

    const handleGenerate = async () => {
        if (!keywords.trim()) {
            setError('Keyword data cannot be empty.');
            return;
        }
        setIsLoading(true);
        setError('');
        setResults(null);
        setGroupedResults(null);
        setProgressMessage('Initializing AI model...');

        try {
            const ai = new GoogleGenAI({ apiKey });
            setProgressMessage('Constructing expert prompt...');
            const prompt = MASTER_PROMPT_TEMPLATE
                .replace('{GEOLOCATION}', geolocation)
                .replace('{DEVICE_TYPE}', device)
                .replace('{KEYWORD_DATA}', keywords);
            
            setProgressMessage('Sending request to Gemini for SERP analysis and clustering...');
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                },
            });

            setProgressMessage('Parsing hierarchical results...');
            const resultText = response.text.trim();
            const parsedResults = JSON.parse(resultText);

            if (!parsedResults.reportData || !parsedResults.dendrogramData) {
                throw new Error("The AI response was missing required 'reportData' or 'dendrogramData' keys.");
            }

            setResults(parsedResults);
            setGroupedResults(groupReportData(parsedResults.reportData));


        } catch (e: any) {
            console.error("Clustering Error:", e);
            setError(`An error occurred: ${e.message}. The model might have returned an invalid structure. Check console for details.`);
        } finally {
            setIsLoading(false);
        }
    };

    const convertGroupedToCsv = (data: ClusteredTopic[]): string => {
        if (!data || data.length === 0) return '';
        const headers = ["Cluster_Name", "Silo_ID", "Primary_Keyword", "Primary_Keyword_Volume", "Other_Keywords", "Total_Cluster_Volume", "Keyword_Count"];
        const csvRows = [
            headers.join(','),
            ...data.map(group => {
                const row = {
                    Cluster_Name: group.clusterName,
                    Silo_ID: group.siloId,
                    Primary_Keyword: group.primaryKeyword.Keyword,
                    Primary_Keyword_Volume: group.primaryKeyword.Volume ?? 0,
                    Other_Keywords: group.otherKeywords.map(kw => kw.Keyword).join('; '), // Semicolon-separated
                    Total_Cluster_Volume: group.totalVolume,
                    Keyword_Count: group.keywordCount,
                };
                return headers.map(header => {
                    const value = row[header as keyof typeof row] ?? '';
                    const stringValue = String(value).replace(/"/g, '""');
                    return /[",\n\r]/.test(stringValue) ? `"${stringValue}"` : stringValue;
                }).join(',');
            })
        ];
        return csvRows.join('\n');
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
            <h1>AI Keyword Clustering Tool</h1>
            <p>Group keywords into topical clusters based on SERP analysis to build a powerful content strategy, inspired by the "Keyword Cupid" methodology.</p>

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
                        <label style={{ fontWeight: 700, fontSize: '16px' }}>Step 2: Provide Keyword Data (CSV Format)</label>
                        <p style={{fontSize: 14, marginTop: '-8px', marginBottom: '16px'}}>Paste CSV content directly or upload a file. The first column must be "Keyword". You can include other columns like "Volume", "Difficulty", "CPC" which will be included in the final report.</p>
                         <label htmlFor="keyword-file-upload" className="file-label-small" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <FileUploadIcon /> {inputFile ? `${inputFile.name} (${formatBytes(inputFile.size)})` : 'Upload CSV File'}
                        </label>
                        <input id="keyword-file-upload" type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
                        <textarea placeholder={`Keyword,Volume,Difficulty\nhow to choose running shoes,5400,65\nbest running shoes for men,8100,78`} value={keywords} onChange={e => setKeywords(e.target.value)} rows={8} />
                    </div>

                     <div className="form-group">
                        <label style={{ fontWeight: 700, fontSize: '16px' }}>Step 3: Configure Report Parameters</label>
                        <div className="resize-options" style={{gap: 'calc(var(--base-unit) * 4)'}}>
                             <div className="form-group">
                                <label>Geolocation</label>
                                <select value={geolocation} onChange={e => setGeolocation(e.target.value)}>
                                    <option>Australia</option>
                                    <option>Canada</option>
                                    <option>Denmark</option>
                                    <option>France</option>
                                    <option>Germany</option>
                                    <option>United Kingdom</option>
                                    <option>United States</option>
                                </select>
                             </div>
                              <div className="form-group">
                                <label>Device Type</label>
                                <div className="segmented-control" style={{height: '49px'}}>
                                    <button className={device === 'Desktop' ? 'active' : ''} onClick={() => setDevice('Desktop')}>Desktop</button>
                                    <button className={device === 'Mobile' ? 'active' : ''} onClick={() => setDevice('Mobile')}>Mobile</button>
                                </div>
                              </div>
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
                <button className="btn btn-primary" onClick={handleGenerate} disabled={isLoading || !isKeyValidated || !keywords.trim()}>
                    {isLoading ? 'Generating...' : 'Generate Clusters'}
                </button>
            </div>
            
            {results && groupedResults && !isLoading && (
                <div className="result-section">
                    <h2>Clustering Results</h2>
                    <div className="download-actions">
                        <button className="btn btn-secondary" onClick={() => downloadFile(JSON.stringify(results, null, 2), 'clustering-results-raw.json', 'application/json')}>Download Raw Data (JSON)</button>
                        <button className="btn btn-primary" onClick={() => downloadFile(convertGroupedToCsv(groupedResults), 'clustering-report.csv', 'text/csv')}>Download Report (CSV)</button>
                    </div>

                    <div className="segmented-control" style={{maxWidth: '400px', margin: '0 auto calc(var(--base-unit) * 3) auto'}}>
                        <button className={activeTab === 'report' ? 'active' : ''} onClick={() => setActiveTab('report')}>Report View</button>
                        <button className={activeTab === 'map' ? 'active' : ''} onClick={() => setActiveTab('map')}>Topical Map View</button>
                    </div>

                    {activeTab === 'report' && (
                        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
                             <style>{`
                                .keyword-list-cell ul {
                                    margin: 0;
                                    padding-left: 18px;
                                    list-style-type: disc;
                                    text-align: left;
                                }
                                .keyword-list-cell li {
                                    padding-bottom: 4px;
                                    white-space: nowrap;
                                }
                                .keyword-list-cell li:last-child {
                                    padding-bottom: 0;
                                }
                                .keyword-list-cell small {
                                    opacity: 0.7;
                                }
                            `}</style>
                            <table className="result-table">
                                <thead>
                                    <tr>
                                        <th>Cluster Name (Silo)</th>
                                        <th>Primary Keyword</th>
                                        <th>Other Keywords</th>
                                        <th>Total Volume</th>
                                        <th># Keywords</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedResults.map((group) => (
                                        <tr key={group.clusterId}>
                                            <td>
                                                <strong>{group.clusterName}</strong>
                                                <br />
                                                <small>Silo: {group.siloId}</small>
                                            </td>
                                            <td>
                                                {group.primaryKeyword.Keyword}
                                                {group.primaryKeyword.Volume != null && <small> (Vol: {group.primaryKeyword.Volume.toLocaleString()})</small>}
                                            </td>
                                            <td className="keyword-list-cell">
                                                {group.otherKeywords.length > 0 ? (
                                                    <ul>
                                                        {group.otherKeywords.map(kw => (
                                                            <li key={kw.Keyword}>
                                                                {kw.Keyword}
                                                                {kw.Volume != null && <small> (Vol: {kw.Volume.toLocaleString()})</small>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : ( <em>-</em> )}
                                            </td>
                                            <td>{group.totalVolume.toLocaleString()}</td>
                                            <td>{group.keywordCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'map' && (
                         <div className="panel dendrogram-container">
                            <style>{`
                                .dendrogram-container ul { list-style-type: none; padding-left: 20px; }
                                .dendrogram-container li { position: relative; padding: 4px 0 4px 20px; }
                                .dendrogram-container li::before { content: ''; position: absolute; top: 0; left: 0; border-left: 1px solid var(--border-color); width: 10px; height: 100%; }
                                .dendrogram-container li::after { content: ''; position: absolute; top: 14px; left: 0; border-top: 1px solid var(--border-color); width: 15px; height: 100%; }
                                .dendrogram-container ul > li:last-child::before { height: 14px; }
                                .node-name { font-weight: 500; color: var(--heading-text); }
                                .silo-node > .node-name { font-size: 1.1em; }
                                .cluster-node > .node-name { color: var(--accent-color); }
                                .keyword-node > .node-name { font-weight: 400; }
                                .node-volume { font-size: 0.8em; opacity: 0.7; }
                            `}</style>
                            <ul>
                                <DendrogramNodeComponent node={results.dendrogramData} />
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
