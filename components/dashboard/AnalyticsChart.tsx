import React, { useEffect, useState } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';

const ANALYTICS_CHART_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    title: { display: true, text: 'Views vs. Inquiries per Vehicle' },
  },
  scales: {
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      title: { display: true, text: 'Views' },
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      title: { display: true, text: 'Inquiries' },
      grid: { drawOnChartArea: false },
    },
  },
};

interface AnalyticsChartProps {
  data: ChartData<'bar'>;
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data }) => {
  const [BarChart, setBarChart] = useState<React.ComponentType<{
    data: ChartData<'bar'>;
    options: ChartOptions<'bar'>;
  }> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [
          { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, LineController, BarController },
          { Bar },
        ] = await Promise.all([
          import('chart.js'),
          import('react-chartjs-2'),
        ]);
        if (cancelled) return;
        Chart.register(
          CategoryScale,
          LinearScale,
          BarElement,
          Title,
          Tooltip,
          Legend,
          PointElement,
          LineElement,
          LineController,
          BarController,
        );
        setBarChart(() => Bar);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="text-center py-16 px-6">
        <h3 className="mt-2 text-xl font-semibold text-reride-text-dark">Chart Library Not Loaded</h3>
        <p className="mt-1 text-sm text-reride-text-dark">Please refresh the page to load the chart library.</p>
      </div>
    );
  }

  if (!BarChart) {
    return (
      <div className="h-80 sm:h-96 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-reride-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-80 sm:h-96">
      <BarChart data={data} options={ANALYTICS_CHART_OPTIONS} />
    </div>
  );
};

export default AnalyticsChart;
