import * as React from 'react';

import './Chart.css';

interface ChartItem {
    y: number;
    height: number;
    error1: number;
    error2: number;
    style: string;
}

export function Chart(): React.ReactElement {
    const barWidth = 10;
    const barSpacing = 30;
    const data = createData();
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const handleResize = () => {
        redraw(canvasRef.current!, data, barWidth, barSpacing);
    };
    React.useEffect(() => {
        if (canvasRef && canvasRef.current) {
            redraw(canvasRef.current, data, barWidth, barSpacing);
        }
    });

    React.useEffect(() => {
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="chart w3-theme-l4">
            <canvas ref={canvasRef} />
        </div>
    );
}

function createData(): ChartItem[] {
    const data: ChartItem[] = [];
    let y: number = (Math.random() * 0.3) + 0.3;
    let height: number;
    let delta: number;

    for (let i = 0; i < 100; i++) {
        delta = (Math.random() * 0.2) - 0.1;
        height = (Math.random() * 0.2);
        y = Math.min(Math.max(y + delta, 0), 1);

        data.push({
            y: y - (height / 2),
            height,
            error1: (Math.random() * 0.1),
            error2: (Math.random() * 0.1),
            style: (delta >= 0) ? '#00ff00' : '#ff0000'
        });
    }

    return data;
}

function redraw(chart: HTMLCanvasElement, chartData: ChartItem[], width: number, spacing: number) {
    const ctx: CanvasRenderingContext2D = chart.getContext('2d')!;
    const padding: number = Number.parseInt(window.getComputedStyle(chart.parentElement!).padding!, 10) || 0;

    // Set Dimensions
    const w = window.innerWidth - (padding * 2);
    const h = window.innerHeight - chart.offsetTop - padding;
    chart.width = w;
    chart.height = h;

    // Draw Data
    let x = w - spacing;
    for (let i = 0; i < 100 && x > -width; i++) {
        const data = chartData[i];

        ctx.beginPath();
        ctx.moveTo(x + (width / 2), (data.y - data.error1) * h);
        ctx.lineTo(x + (width / 2), (data.y + data.height + data.error2) * h);
        ctx.stroke();

        ctx.fillStyle = data.style;
        ctx.fillRect(x, data.y * h, width, data.height * h);

        x -= spacing;
    }

    // Draw Axes
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    ctx.lineTo(w, h);
    ctx.stroke();
}
