import React, { useState, useEffect } from 'react';

// Layout & Common
import { Header } from './components/Layout/Header';

// Pages
import { Dashboard } from './tools/Dashboard/Dashboard';

// Import all your tools
import { PdfToJpgConverter } from './tools/PdfToJpg/PdfToJpgConverter';
import { ImagesToPdfConverter } from './tools/ImagesToPdf/ImagesToPdfConverter';
import { MergePdfConverter } from './tools/MergePdf/MergePdfConverter';
import { SplitPdfConverter } from './tools/SplitPdf/SplitPdfConverter';
import { CombineExcelCsv } from './tools/CombineExcelCsv/CombineExcelCsv';
import { CompressImageConverter } from './tools/CompressImage/CompressImageConverter';
import { ImageResizerCropper } from './tools/ResizeCropImage/ImageResizerCropper';
import { BulkImageWatermarker } from './tools/BulkImageWatermarker/BulkImageWatermarker';
import { RedirectMapper } from './tools/RedirectMapper/RedirectMapper';
import { KeywordUrlMapper } from './tools/KeywordUrlMapper/KeywordUrlMapper';
import { KeywordClusteringTool } from './tools/KeywordClusteringTool/KeywordClusteringTool';
import { LandingPageFinder } from './tools/LandingPageFinder/LandingPageFinder';
import { LlmsTxtGenerator } from './tools/LlmsTxtGenerator/LlmsTxtGenerator';
import { UrlSheetSplitter } from './tools/UrlSheetSplitter/UrlSheetSplitter';

const App = () => {
    const [currentTool, setCurrentTool] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [theme, setTheme] = useState('light');

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    useEffect(() => {
        document.documentElement.className = theme;
    }, [theme]);

    const handleHomeClick = () => {
        setCurrentTool(null);
        setSelectedCategory(null);
    };

    const handleBackFromTool = () => setCurrentTool(null);

    const renderTool = () => {
        if (!currentTool) return null;

        switch (currentTool) {
            // File management
            case 'PDF_TO_JPG':
                return <PdfToJpgConverter onBack={handleBackFromTool} />;
            case 'JPG_TO_PDF':
                return <ImagesToPdfConverter onBack={handleBackFromTool} />;
            case 'MERGE_PDF':
                return <MergePdfConverter onBack={handleBackFromTool} />;
            case 'SPLIT_PDF':
                return <SplitPdfConverter onBack={handleBackFromTool} />;
            case 'COMBINE_EXCEL_CSV':
                return <CombineExcelCsv onBack={handleBackFromTool} />;
            case 'COMPRESS_IMAGE':
                return <CompressImageConverter onBack={handleBackFromTool} />;
            case 'RESIZE_CROP_IMAGE':
                return <ImageResizerCropper onBack={handleBackFromTool} />;
            case 'BULK_IMAGE_WATERMARKER':
                return <BulkImageWatermarker onBack={handleBackFromTool} />;

            // SEO & Content Hub
            case 'AI_REDIRECT_MAPPER':
                return <RedirectMapper onBack={handleBackFromTool} />;
            case 'KEYWORD_URL_MAPPER':
                return <KeywordUrlMapper onBack={handleBackFromTool} />;
            case 'KEYWORD_CLUSTERING_TOOL':
                return <KeywordClusteringTool onBack={handleBackFromTool} />;
            case 'URL_SHEET_SPLITTER':
                return <UrlSheetSplitter onBack={handleBackFromTool} />;
            case 'LLMS_TXT_GENERATOR':
                return <LlmsTxtGenerator onBack={handleBackFromTool} />;
          
            // Paid Media (PPC) Toolkit - No tools yet

            // Analytics & Reporting Dashboard
            case 'LANDING_PAGE_FINDER':
                return <LandingPageFinder onBack={handleBackFromTool} />;

            default:
                return null;
        }
    };

    const toolContent = renderTool();

    return (
        <>
            <Header onHomeClick={handleHomeClick} theme={theme} onThemeToggle={toggleTheme} />
            {toolContent ? (
                <div className="container">
                    {toolContent}
                </div>
            ) : (
                <Dashboard 
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    onSelectTool={setCurrentTool}
                    onBack={() => setSelectedCategory(null)}
                />
            )}
        </>
    );
};

export default App;