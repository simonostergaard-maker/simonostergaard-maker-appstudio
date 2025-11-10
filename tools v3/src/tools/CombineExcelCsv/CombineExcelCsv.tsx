import React, { useState } from 'react';

export const CombineExcelCsv = ({ onBack }: { onBack: () => void }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [resultUrl, setResultUrl] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (selectedFiles && selectedFiles.length > 0) {
            // FIX: Explicitly type 'file' as 'File' in the filter callback to resolve the 'unknown' type error when accessing file properties like 'name' and 'type'.
            const validFiles = Array.from(selectedFiles).filter((file: File) =>
                file.name.endsWith('.csv') ||
                file.name.endsWith('.xls') ||
                file.name.endsWith('.xlsx') ||
                file.type === 'text/csv' ||
                file.type === 'application/vnd.ms-excel' ||
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );

            if (validFiles.length < 2) {
                setFiles([]);
                setError('Please select at least two Excel or CSV files to combine.');
            } else {
                setFiles(validFiles);
                setError('');
                setResultUrl(null);
            }
        }
    };
    
    const sanitizeSheetName = (fileName: string): string => {
        // Remove file extension
        let name = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        // Replace invalid characters
        name = name.replace(/[*?:\\/\[\]]/g, '_');
        // Truncate to 31 characters
        return name.substring(0, 31);
    };

    const handleCombineFiles = async () => {
        if (files.length < 2 || !window.XLSX) {
            setError('Please select at least two files. The Excel library may also be missing.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResultUrl(null);

        try {
            const newWorkbook = window.XLSX.utils.book_new();

            for (const file of files) {
                const data = await file.arrayBuffer();
                const workbook = window.XLSX.read(data, { type: 'array' });

                // Use the first sheet of the workbook
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Sanitize file name for the new sheet name
                const newSheetName = sanitizeSheetName(file.name);
                
                window.XLSX.utils.book_append_sheet(newWorkbook, worksheet, newSheetName);
            }

            const workbookOutput = window.XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([workbookOutput], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            setResultUrl(URL.createObjectURL(blob));

        } catch (err) {
            console.error('Error combining files:', err);
            setError('An error occurred while combining the files. One of the files might be corrupted or in an unsupported format.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <>
            <h1>Combine Excel & CSV Files</h1>
            <p>Select multiple Excel or CSV files to merge them into a single Excel workbook, with each file as a separate sheet.</p>

            <div className="file-dropzone">
                <label htmlFor="file-upload-combine" className="file-dropzone-label">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>{files.length > 0 ? `${files.length} file(s) selected` : 'Click to select or drop Excel/CSV files here'}</span>
                </label>
                <input
                    id="file-upload-combine"
                    type="file"
                    accept=".csv, .xls, .xlsx, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                    onChange={handleFileChange}
                    multiple
                />
                {files.length > 0 && (
                    <div className="file-preview-list">
                        {files.map(file => <div className="file-preview-item" key={file.name}>{file.name}</div>)}
                    </div>
                )}
            </div>

            {error && <p style={{ color: '#ff8a8a', textAlign: 'center' }}>{error}</p>}
            
            {isLoading && (
                 <div className="progress-section">
                    <p>Combining files...</p>
                    <div className="progress-bar-container">
                         <div className="progress-bar-fill indeterminate" style={{width: '100%'}}></div>
                    </div>
                </div>
            )}
            
            <div className="action-bar">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleCombineFiles} disabled={files.length < 2 || isLoading} aria-live="polite">
                    {isLoading ? 'Combining...' : 'Combine Files'}
                </button>
            </div>

            {resultUrl && !isLoading && (
                <div className="result-section">
                    <h2>Combination Complete</h2>
                    <div className="download-actions">
                        <a href={resultUrl} download="combined-files.xlsx" className="btn btn-primary">
                            Download Combined File
                        </a>
                    </div>
                </div>
            )}
        </>
    );
};