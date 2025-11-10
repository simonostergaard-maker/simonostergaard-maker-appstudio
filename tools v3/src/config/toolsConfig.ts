import {
    FileConverterIcon,
    SeoIcon,
    PpcIcon,
    AnalyticsIcon,
    RedirectIcon,
    SitemapIcon,
    BrainIcon,
    SplitFileIcon,
} from '../components/Icons';

export const TOOLS_CONFIG = {
    CORE_UTILS: {
        name: "File management",
        Icon: FileConverterIcon,
        tools: [
            { id: 'PDF_TO_JPG', title: 'PDF to JPG', description: 'Convert each page of a PDF into a separate JPG image.', Icon: FileConverterIcon },
            { id: 'JPG_TO_PDF', title: 'Images to PDF', description: 'Combine multiple JPG or PNG images into a single PDF file.', Icon: FileConverterIcon },
            { id: 'MERGE_PDF', title: 'Merge PDFs', description: 'Combine multiple separate PDF files into one single document.', Icon: FileConverterIcon },
            { id: 'SPLIT_PDF', title: 'Split PDF', description: 'Extract every page from a PDF into separate PDF files.', Icon: FileConverterIcon },
            { id: 'COMBINE_EXCEL_CSV', title: 'Combine Excel & CSV', description: 'Merge multiple Excel or CSV files into a single Excel file with multiple sheets.', Icon: FileConverterIcon },
            { id: 'COMPRESS_IMAGE', title: 'Compress Images', description: 'Reduce the file size of JPG & PNG images for web optimization.', Icon: FileConverterIcon },
            { id: 'RESIZE_CROP_IMAGE', title: 'Resize & Crop Images', description: 'Adjust image dimensions with presets for social media and web.', Icon: FileConverterIcon },
            { id: 'BULK_IMAGE_WATERMARKER', title: 'Bulk Image Watermarker', description: 'Apply a logo watermark to a batch of images in a chosen position.', Icon: FileConverterIcon },
        ]
    },
    SEO_CONTENT: {
        name: "SEO & Content Hub",
        Icon: SeoIcon,
        tools: [
            { id: 'AI_REDIRECT_MAPPER', title: 'AI Redirect Mapper', description: 'Use AI to map old URLs to new URLs based on semantic similarity.', Icon: RedirectIcon },
            { id: 'KEYWORD_URL_MAPPER', title: 'Keyword to URL Mapper', description: 'Map keywords to pages using AI, enriched with ranking data from Ahrefs or a sitemap.', Icon: SeoIcon },
            { id: 'KEYWORD_CLUSTERING_TOOL', title: 'AI Keyword Clustering Tool', description: 'Group keywords into topical clusters based on SERP analysis to build content authority.', Icon: SitemapIcon },
            { id: 'URL_SHEET_SPLITTER', title: 'URL-based Sheet Splitter', description: 'Split a spreadsheet into multiple files or sheets based on language/country codes in a URL column.', Icon: SplitFileIcon },
            { id: 'LLMS_TXT_GENERATOR', title: 'LLMS.TXT Generator', description: 'Generate a token-efficient llms.txt file from a URL using an AI-driven content analysis.', Icon: BrainIcon },
        ]
    },
    PPC_TOOLKIT: {
        name: "Paid Media (PPC) Toolkit",
        Icon: PpcIcon,
        tools: []
    },
    ANALYTICS_REPORTING: {
        name: "Analytics & Reporting Dashboard",
        Icon: AnalyticsIcon,
        tools: [
            { id: 'LANDING_PAGE_FINDER', title: 'Landing Page Finder', description: "Discover a website's landing pages by automatically finding and parsing its sitemap.", Icon: SitemapIcon },
        ]
    }
};