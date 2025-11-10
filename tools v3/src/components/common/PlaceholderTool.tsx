import React from 'react';

export const PlaceholderTool = ({ title, description, onBack }: { title: string; description: string; onBack: () => void; }) => (
    <>
        <h1>{title}</h1>
        <p>{description}</p>
        <p style={{ fontStyle: 'italic', marginTop: '4rem', opacity: 0.7 }}>This tool is currently under development. Check back soon!</p>
        <div className="action-bar" style={{ marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={onBack}>Back to Dashboard</button>
        </div>
    </>
);
