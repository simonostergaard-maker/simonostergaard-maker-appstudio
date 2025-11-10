import React, { useState } from 'react';

type ProcessedResult = {
    headers: string[];
    groups: {
        [key: string]: any[][];
    }
}

const LANG_CODE_MAP: { [key: string]: string } = {
    'sa': 'Saudi Arabia', 'it': 'Italy', 'de': 'Germany', 'fr': 'France',
    'es': 'Spain', 'gb': 'United Kingdom', 'uk': 'United Kingdom', 'us': 'United States',
    'en': 'English', 'dk': 'Denmark', 'se': 'Sweden', 'no': 'Norway',
    'fi': 'Finland', 'nl': 'Netherlands', 'be': 'Belgium', 'at': 'Austria',
    'ch': 'Switzerland', 'pl': 'Poland', 'jp': 'Japan', 'cn': 'China',
    'au': 'Australia', 'ca': 'Canada', 'br': 'Brazil', 'mx': 'Mexico',
};

export const UrlSheetSplitter = ({ onBack }: { onBack: () => void }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<ProcessedResult | null>(null);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            const isValid = selectedFile.name.endsWith('.csv') ||
                            selectedFile.name.endsWith('.xls') ||
                            selectedFile.name.endsWith('.xlsx');
            if (isValid) {
                setFile(selectedFile);
                setError('');
                setResults(null);
            } else {
                setFile(null);
                setError('Please upload a valid CSV or Excel file.');
            }
        }
    };

    const handleProcessFile = async () => {
        if (!file || !window.XLSX) {
            setError('Please select a file to process.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResults(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = window.XLSX.read(data);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData: any[][] = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                throw new Error("The spreadsheet is empty or contains only a header row.");
            }

            const headers = jsonData[0];
            const rows = jsonData.slice(1);

            let urlColumnIndex = -1;
            for (let i = 0; i < headers.length; i++) {
                let urlCount = 0;
                const sampleSize = Math.min(10, rows.length);
                for (let j = 0; j < sampleSize; j++) {
                    const cell = rows[j][i];
                    if (typeof cell === 'string' && (cell.startsWith('http') || (cell.startsWith('/') && cell.length > 1))) {
                        urlCount++;
                    }
                }
                if (sampleSize > 0 && urlCount / sampleSize >= 0.5) {
                    urlColumnIndex = i;
                    break;
                }
            }

            if (urlColumnIndex === -1) {
                throw new Error("No URL's identified. Could not find a column with a majority of URLs.");
            }

            const groups: { [key: string]: any[][] } = {};
            const langCodeRegex = /\/([a-z]{2}(?:-[a-z]{2})?)\//i;

            for (const row of rows) {
                if (row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

                const url = row[urlColumnIndex];
                if (!url || typeof url !== 'string') {
                    continue; 
                }

                const match = url.match(langCodeRegex);
                let groupName = 'Uncategorized';

                if (match && match[1]) {
                    const code = match[1].split('-')[0].toLowerCase();
                    groupName = LANG_CODE_MAP[code] || code.toUpperCase();
                }
                
                if (!groups[groupName]) {
                    groups[groupName] = [];
                }
                groups[groupName].push(row);
            }

            if (Object.keys(groups).length === 0) {
                 throw new Error("Processing finished, but no valid rows with URLs were found to split.");
            }

            setResults({ headers, groups });

        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during processing.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownloadExcel = () => {
        if (!results) return;
        const { headers, groups } = results;
        
        const wb = window.XLSX.utils.book_new();
        for (const groupName in groups) {
            const sheetData = [headers, ...groups[groupName]];
            const ws = window.XLSX.utils.aoa_to_sheet(sheetData);
            const safeSheetName = groupName.replace(/[*?:\\/\[\]]/g, '_').substring(0, 31);
            window.XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        }
        
        const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'split-by-url.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const handleDownloadZip = async () => {
        if (!results || !window.JSZip) return;
        const { headers, groups } = results;

        const zip = new window.JSZip();
        for (const groupName in groups) {
            const sheetData = [headers, ...groups[groupName]];
            const ws = window.XLSX.utils.aoa_to_sheet(sheetData);
            const csvContent = '\uFEFF' + window.XLSX.utils.sheet_to_csv(ws);
            zip.file(`${groupName}.csv`, csvContent);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'split-by-url.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <h1>URL-based Sheet Splitter</h1>
            <p>Split a spreadsheet into multiple files based on language or country codes found in a URL column.</p>

            <div className="file-dropzone">
                <label htmlFor="file-upload-splitter" className="file-dropzone-label">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{file ? file.name : 'Click to select or drop an Excel/CSV file here'}</span>
                </label>
                <input
                    id="file-upload-splitter"
                    type="file"
                    accept=".csv, .xls, .xlsx"
                    onChange={handleFileChange}
                />
            </div>

            {error && <p style={{ color: '#ff8a8a', textAlign: 'center' }}>{error}</p>}
            
            {isLoading && (
                 <div className="progress-section">
                    <p>Analyzing and splitting file...</p>
                    <div className="progress-bar-container">
                         <div className="progress-bar-fill indeterminate" style={{width: '100%'}}></div>
                    </div>
                </div>
            )}
            
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleProcessFile} disabled={!file || isLoading} aria-live="polite">
                    {isLoading ? 'Processing...' : 'Split File'}
                </button>
            </div>
            
            {results && !isLoading && (
                <div className="result-section">
                    <h2>Processing Complete</h2>
                    <div className="download-actions">
                         <button className="btn btn-secondary" onClick={handleDownloadZip}>Download All (.zip)</button>
                         <button className="btn btn-primary" onClick={handleDownloadExcel}>Download Combined Excel</button>
                    </div>
                    <div className="panel">
                        <p style={{textAlign: 'center', margin: 0, fontWeight: 500}}>Found {Object.keys(results.groups).length} groups:</p>
                        <ul style={{textAlign: 'center', listStyle: 'none', padding: 0, margin: '1rem 0 0 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
                            {/* FIX: Explicitly type the destructured 'rows' variable in the map function to 'any[][]' to resolve the 'unknown' type error and allow access to the 'length' property. */}
                            {Object.entries(results.groups).map(([name, rows]: [string, any[][]]) => (
                                <li key={name} style={{background: 'var(--subtle-background)', padding: '0.5rem 1rem', borderRadius: '99px'}}>
                                    <strong>{name}:</strong> {rows.length} rows
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

        </>
    );
};