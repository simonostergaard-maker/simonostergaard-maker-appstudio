import React from 'react';

export const CounterBar = ({ current, max, unit }: { current: number; max: number; unit: string; }) => {
    const percentage = Math.min((current / max) * 100, 100);
    let colorClass = 'green';
    if (current > max) {
        colorClass = 'red';
    } else if (current / max > 0.9) {
        colorClass = 'orange';
    }

    return (
        <div className="counter-bar">
            <div className={`counter-bar-fill ${colorClass}`} style={{ width: `${percentage}%` }}></div>
            <span className="counter-bar-text">{current} / {max} {unit}</span>
        </div>
    );
};
