import { GoogleGenAI } from "@google/genai";
import React, { useState } from 'react';

const B2B_EXAMPLE = `# PR Electronics – LLMS Knowledge File

## Company & Core Focus
- Designs and manufactures signal conditioning devices for industrial automation and process control.
- Main products: temperature transmitters, intrinsically safe (I.S.) interfaces, multifunctional devices, communication interfaces, isolators, panel displays.
- Focus on reliability, smart connectivity, integrated solutions for measurement and control.

## Product Overview
### Popular Device Series & Individual Products
- **4100 Series (Multifunctional):** [Universal Transmitter 4116](https://www.prelectronics.com/products/multifunctional-devices/4100/universal-transmitter-4116/)
- **5300 Series (Temperature Measurement):** [2-wire Programmable Transmitter 5333A](https://www.prelectronics.com/products/temperature-transmitters/5300/2-wire-programmable-transmitter-5333a/)

## Technical Documentation & Support
- [Knowledge Library: Signal Processing](https://www.prelectronics.com/support/pr-knowledge-library/)
- [Downloads for Manuals & Datasheets](https://www.prelectronics.com/downloads/)`;

const B2C_EXAMPLE = `# Intersport Danmark
## Overview
Intersport Danmark is a leading sports retailer offering a wide range of sportswear, footwear, and equipment for men, women, and children. We stock top brands like Nike, Adidas, and PUMA and provide expert advice in our nationwide stores.

## Core Brand & Navigation Pages
- [Home](https://www.intersport.dk/): Our homepage featuring current offers and news.
- [All Brands](https://www.intersport.dk/pages/brands): An overview of all the brands we carry.
- [FAQ](https://www.intersport.dk/pages/ofte-stillede-sporgsmal): Answers to frequently asked questions.

## Key Sports Categories
- [Running](https://www.intersport.dk/collections/lob): All equipment for runners, including shoes, apparel, and accessories.
- [Football](https://www.intersport.dk/collections/fodbold): Football boots, balls, and player kits.
- [Training](https://www.intersport.dk/collections/traening): Apparel and equipment for fitness and training.

## Key Articles
- [Guide to Choosing the Perfect Running Shoes](https://intersport.dk/blogs/artikler/guide-til-det-perfekte-valg-af-lobesko-for-dig): A comprehensive guide to finding the right running shoes for your needs.
`;

const PROMPT_TEMPLATE = `
# ROLE & OBJECTIVE
You are an expert AI system designed to generate a concise, high-density, LLM-ready knowledge file, known as \`llms.txt\`. Your task is to analyze a given website and synthesize its most critical information into a structured Markdown format, similar to a "cheat sheet" that an AI can easily ingest.

# METHODOLOGY
1.  **Analyze the Target:** You will be given a target URL and its business model (B2B or B2C).
2.  **Simulate Focused Crawling:** Based on the input URL, you must intelligently "crawl" the most important pages of the website to gather information. For a B2B site, this includes the homepage, about us, product/service categories, key product datasheets, and support pages. For a B2C site, focus on the homepage, categories, popular products, and about/FAQ pages. If a sitemap is provided, use it to understand the site structure, but still focus on the most important pages.
3.  **Synthesize Knowledge:** Extract and summarize the most critical information. Do not just copy text. Synthesize facts, product ranges, key features, and company information into atomic, easy-to-parse bullet points and sections.
4.  **Format as Markdown:** Structure the entire output in clean, readable Markdown. Use headers (##) for main sections and bullet points (*) for details. Include important links where relevant.

# CONSTRAINTS
- **Be Concise:** The goal is token efficiency. Avoid conversational filler, marketing fluff, and redundant information.
- **Fact-Based:** Extract factual information (product names, technical specs, company details).
- **Adhere to Example Format:** The output format should closely mirror the provided example for the corresponding business model.

# INPUT DATA
- **TARGET_URL:** {URL}
- **INPUT_TYPE:** {INPUT_TYPE}
- **BUSINESS_MODEL:** {BUSINESS_MODEL}
- **EXAMPLE_FORMAT (for a {BUSINESS_MODEL} site):**
\`\`\`markdown
{EXAMPLE}
\`\`\`

# TASK
Generate the \`llms.txt\` file for the TARGET_URL. Your entire response must be the Markdown content for the file. Do not include any other text, explanations, or apologies before or after the markdown content.

BEGIN.
`;


export const LlmsTxtGenerator = ({ onBack }: { onBack: () => void; }) => {
    const [apiKey, setApiKey] = useState('');
    const [isKeyValidated, setIsKeyValidated] = useState(false);
    const [isKeyValidating, setIsKeyValidating] = useState(false);
    const [apiKeyError, setApiKeyError] = useState('');

    const [url, setUrl] = useState('');
    const [inputType, setInputType] = useState<'WEBSITE' | 'SITEMAP'>('WEBSITE');
    const [businessModel, setBusinessModel] = useState<'B2C' | 'B2B'>('B2C');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [progressMessage, setProgressMessage] = useState('');
    const [result, setResult] = useState('');

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

    const handleGenerate = async () => {
        if (!url.trim()) {
            setError('Please provide a URL.');
            return;
        }
        setIsLoading(true);
        setError('');
        setResult('');
        setProgressMessage('Initializing AI model...');

        try {
            const ai = new GoogleGenAI({ apiKey });
            setProgressMessage('Constructing expert prompt...');

            const example = businessModel === 'B2B' ? B2B_EXAMPLE : B2C_EXAMPLE;
            const prompt = PROMPT_TEMPLATE
                .replace(/{URL}/g, url)
                .replace(/{INPUT_TYPE}/g, inputType)
                .replace(/{BUSINESS_MODEL}/g, businessModel)
                .replace('{EXAMPLE}', example);

            setProgressMessage('Sending request to Gemini for analysis...');
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });

            setProgressMessage('Finalizing results...');
            const responseText = response.text;
            
            // Clean up the response to ensure it's just markdown
            const cleanedResult = responseText.replace(/^```(markdown)?|```$/g, "").trim();

            setResult(cleanedResult);
        } catch (e: any) {
            console.error("LLMS.TXT Generation Error:", e);
            setError(`An error occurred: ${e.message}. The model might have returned an invalid response. Please check the console for details.`);
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };
    
    const downloadResult = () => {
        const blob = new Blob([result], { type: 'text/plain' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'llms.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    };

    return (
        <>
            <h1>LLMS.TXT Generator</h1>
            <p>Generate a token-efficient `llms.txt` file from a URL using an AI-driven content analysis, based on the architectural blueprint.</p>
        
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
                        <label style={{ fontWeight: 700, fontSize: '16px' }}>Step 2: Provide Target & Options</label>
                        <div className="segmented-control" style={{marginBottom: '16px'}}>
                            <button className={inputType === 'WEBSITE' ? 'active' : ''} onClick={() => setInputType('WEBSITE')}>Website URL</button>
                            <button className={inputType === 'SITEMAP' ? 'active' : ''} onClick={() => setInputType('SITEMAP')}>Sitemap URL</button>
                        </div>
                        <input type="text" placeholder={inputType === 'WEBSITE' ? "https://www.example.com" : "https://www.example.com/sitemap.xml"} value={url} onChange={e => setUrl(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Business Model</label>
                        <div className="segmented-control">
                            <button className={businessModel === 'B2C' ? 'active' : ''} onClick={() => setBusinessModel('B2C')}>B2C (E-commerce / Retail)</button>
                            <button className={businessModel === 'B2B' ? 'active' : ''} onClick={() => setBusinessModel('B2B')}>B2B (Technical / Corporate)</button>
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
                <button className="btn btn-primary" onClick={handleGenerate} disabled={isLoading || !isKeyValidated || !url.trim()}>
                    {isLoading ? 'Generating...' : 'Generate File'}
                </button>
            </div>

            {result && !isLoading && (
                <div className="result-section">
                    <h2>Generated llms.txt</h2>
                     <div className="download-actions">
                        <button className="btn btn-primary" onClick={downloadResult}>Download llms.txt</button>
                    </div>
                    <div className="panel">
                        <textarea value={result} readOnly rows={20} style={{ fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre', backgroundColor: 'var(--subtle-background)'}} />
                    </div>
                </div>
            )}

        </>
    );
};
