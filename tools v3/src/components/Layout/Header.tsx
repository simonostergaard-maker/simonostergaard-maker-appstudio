import React from 'react';
import { HomeIcon, MoonIcon, SunIcon } from '../Icons';

export const Header = ({ onHomeClick, theme, onThemeToggle }: { onHomeClick: () => void; theme: string; onThemeToggle: () => void; }) => {
    return (
        <header className="app-header">
            <button onClick={onHomeClick} className="header-btn">
                <HomeIcon />
                <span>Dashboard</span>
            </button>
            <div className="header-right">
                <button onClick={onThemeToggle} className="header-btn theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
            </div>
        </header>
    );
};
