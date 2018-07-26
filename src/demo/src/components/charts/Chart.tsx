import * as React from 'react';

import './Chart.css';

interface ChartItem {
    y: number;
    height: number;
    error1: number;
    error2: number;
    style: string;
}

export class Chart extends React.Component {
    private static BAR_WIDTH: number = 10;
    private static BAR_SPACING: number = 30;
    
    private data: ChartItem[] = [];

    constructor(props: {}) {
        super(props);

        window.onresize = this.redraw.bind(this);

        let y: number = (Math.random() * 0.3) + 0.3;
        let height: number, delta: number;

        for(var i=0; i<100; i++) {
            delta = (Math.random() * 0.2) - 0.1;
            height = (Math.random() * 0.2);
            y = Math.min(Math.max(y + delta, 0), 1);

            this.data.push({
                y: y - (height / 2),
                height: height,
                error1: (Math.random() * 0.1),
                error2: (Math.random() * 0.1),
                style: (delta >= 0) ? "#00ff00" : "#ff0000"
            });
        }
    }
    public componentDidMount(): void {
        if (document.getElementsByTagName("canvas").length > 0) {
            this.redraw();
        }
    }

    public render(): JSX.Element {
        return (
            <div className="chart w3-theme-l4">
                <canvas />
            </div>
        );
    }

    private redraw(): void {
        //Assumes window only contains a single canvas element
        let chart: HTMLCanvasElement = document.getElementsByTagName("canvas")[0];
        let ctx: CanvasRenderingContext2D = chart.getContext("2d");
        let padding: number = parseInt(window.getComputedStyle(chart.parentElement).padding) || 0;

        //Set Dimensions
        let w = window.innerWidth - (padding * 2);
        let h = window.innerHeight - chart.offsetTop - padding;
        chart.width = w;
        chart.height = h;

        //Draw Data
        let x = w - Chart.BAR_SPACING;
        for(var i=0; i<100 && x > -Chart.BAR_WIDTH; i++) {
            let data = this.data[i];

            ctx.beginPath();
            ctx.moveTo(x + (Chart.BAR_WIDTH / 2), (data.y - data.error1) * h);
            ctx.lineTo(x + (Chart.BAR_WIDTH / 2), (data.y + data.height + data.error2) * h);
            ctx.stroke();

            ctx.fillStyle = data.style;
            ctx.fillRect(x, data.y * h, Chart.BAR_WIDTH, data.height * h);

            x -= Chart.BAR_SPACING;
        }

        //Draw Axes
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, h);
        ctx.lineTo(w, h);
        ctx.stroke();
    }
}