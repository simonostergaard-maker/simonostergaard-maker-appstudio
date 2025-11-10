import React, { useState } from 'react';
import { TOOLS_CONFIG } from '../../config/toolsConfig';
import { SearchIcon, ArrowRightIcon, ArrowLeftIcon } from '../../components/Icons';

interface Tool {
    id: string;
    title: string;
    description: string;
    Icon: React.FC;
}

interface ToolCategory {
    name: string;
    Icon: React.FC;
    tools: Tool[];
}

interface DashboardProps {
    selectedCategory: string | null;
    onSelectCategory: (categoryId: string) => void;
    onSelectTool: (toolId: string) => void;
    onBack: () => void;
}

export const Dashboard = ({ selectedCategory, onSelectCategory, onSelectTool, onBack }: DashboardProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    if (!selectedCategory) {
        const filteredCategories = Object.entries(TOOLS_CONFIG).map(([key, category]) => {
            const typedCategory = category as ToolCategory;
            
            const hasMatchingTool = typedCategory.tools.some(tool =>
                tool.title.toLowerCase().includes(lowerCaseSearchTerm) ||
                tool.description.toLowerCase().includes(lowerCaseSearchTerm)
            );

            const hasMatchingCategoryName = typedCategory.name.toLowerCase().includes(lowerCaseSearchTerm);
            const isVisible = hasMatchingTool || hasMatchingCategoryName;

            return { ...typedCategory, id: key, isVisible };
        }).filter(c => c.isVisible);
        
        return (
            <main className="tool-hub">
                <div className="hub-intro">
                    <h1>Internal Tools Dashboard</h1>
                    <p>A suite of applications designed to streamline workflows and boost productivity.</p>
                </div>
                <div className="search-bar">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder="Search for a tool or category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Search for tools or categories"
                    />
                </div>
                
                {filteredCategories.length > 0 ? (
                    <div className="category-grid">
                        {filteredCategories.map(category => (
                            <div key={category.id} className="category-card" onClick={() => onSelectCategory(category.id)} role="button" tabIndex={0} aria-label={`View tools in ${category.name}`}>
                                <div className="card-header">
                                    <div className="card-icon-container">
                                        <category.Icon />
                                    </div>
                                    <span className="tool-count">{category.tools.length} tools</span>
                                </div>
                                <h3>{category.name}</h3>
                                <div className="card-footer">
                                    <span>View Tools</span>
                                    <ArrowRightIcon />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{textAlign: 'center', marginTop: '4rem'}}>No categories or tools found for "{searchTerm}".</p>
                )}

            </main>
        );
    }

    const categoryData = TOOLS_CONFIG[selectedCategory as keyof typeof TOOLS_CONFIG] as ToolCategory;
    const filteredTools = categoryData.tools.filter(tool =>
        tool.title.toLowerCase().includes(lowerCaseSearchTerm) ||
        tool.description.toLowerCase().includes(lowerCaseSearchTerm)
    );

    return (
         <main className="tool-hub">
            <div className="category-view-header">
                <button onClick={onBack} className="back-button" aria-label="Back to all categories">
                    <ArrowLeftIcon />
                    <span>All Categories</span>
                </button>
                <h1>{categoryData.name}</h1>
            </div>
             <div className="search-bar">
                <SearchIcon />
                <input
                    type="text"
                    placeholder={`Search in ${categoryData.name}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search for tools"
                />
            </div>
            
            {filteredTools.length > 0 ? (
                 <section className="category-section">
                    <div className="tool-grid">
                        {filteredTools.map(tool => (
                            <div key={tool.id} className="tool-card" onClick={() => onSelectTool(tool.id)} onKeyDown={(e) => e.key === 'Enter' && onSelectTool(tool.id)} role="button" tabIndex={0} aria-label={`Open ${tool.title}`}>
                                <div>
                                    <div className="card-header">
                                        <h3>{tool.title}</h3>
                                        <div className="card-icon-container">
                                            <tool.Icon />
                                        </div>
                                    </div>
                                    <p className="card-description">{tool.description}</p>
                                </div>
                                <div className="card-footer">
                                    <span>Open tool</span>
                                    <ArrowRightIcon />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : (
                <p style={{textAlign: 'center', marginTop: '4rem'}}>No tools found for "{searchTerm}" in this category.</p>
            )}
        </main>
    )
};
