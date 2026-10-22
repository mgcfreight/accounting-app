import type { ApexOptions } from "apexcharts";
import { ComponentProps, lazy, Suspense } from "react";

// ApexCharts is large, so it loads in its own chunk on first use rather than
// with the app.
const ApexChart = lazy(() => import("react-apexcharts"));

// Holds the chart's height while ApexCharts loads, so the page doesn't jump.
function ReactApexChart(props: ComponentProps<typeof ApexChart>) {
  return (
    <Suspense fallback={<div style={{ height: props.height }} />}>
      <ApexChart {...props} />
    </Suspense>
  );
}

type Series = { name: string; data: number[] };

// ApexCharts inserts the tooltip as raw HTML, so React's escaping does not
// apply. Series names will come from the API (e.g. shipper names).
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[
        char
      ]!
  );

// The tooltip mokal-app draws on its dashboard charts.
const tooltip = (background: string): ApexOptions["tooltip"] => ({
  custom: ({ series, seriesIndex, dataPointIndex, w }) => {
    const value = series[seriesIndex][dataPointIndex];
    const name = escapeHtml(String(w.globals.seriesNames[seriesIndex]));
    return `
      <div style="padding: 8px; text-align: center; background: ${background}; color: #fff; border-radius: 12px; min-width: 10rem;">
        <div style="font-weight: bold; color: #e5e7eb;">${name}</div>
        <div style="margin-top: 4px;">${Number(value).toLocaleString("en-US")}</div>
      </div>`;
  },
});

// The gradient line chart from mokal-app's ChartWrapper.
export function LineChart({
  title,
  categories,
  series,
}: {
  title: string;
  categories: string[];
  series: Series[];
}) {
  const options: ApexOptions = {
    chart: { toolbar: { show: false } },
    markers: {
      size: 6,
      shape: "circle",
      strokeWidth: 2,
      colors: ["#ffffff"],
      strokeColors: "#008FFB",
      fillOpacity: 1,
      hover: { size: 8 },
    },
    tooltip: tooltip("#030229"),
    title: {
      text: title,
      align: "left",
      style: { fontSize: "12px", fontWeight: "600", color: "#8F9494" },
    },
    xaxis: {
      categories,
      labels: { rotate: 0, hideOverlappingLabels: false },
      axisBorder: { show: true },
      axisTicks: { show: true },
    },
    yaxis: { labels: { formatter: (v) => v.toLocaleString("en-US") } },
    fill: {
      type: "gradient",
      colors: ["#5BC4FF", "#FF5BEF"],
      gradient: {
        shade: "light",
        type: "horizontal",
        gradientToColors: ["#FF5BEF", "#5BC4FF"],
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 100],
      },
    },
  };
  return (
    <ReactApexChart options={options} series={series} type="line" height={320} />
  );
}

// The rounded grouped bars from mokal-app's "Top Shippers" chart.
export function BarChart({
  categories,
  series,
  height = 320,
}: {
  categories: string[];
  series: Series[];
  height?: number;
}) {
  const options: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false } },
    plotOptions: {
      bar: { borderRadius: 6, columnWidth: "45%", distributed: false },
    },
    dataLabels: { enabled: false },
    fill: { opacity: 1 },
    colors: ["#587CCA", "#FFA500"],
    xaxis: { categories },
    yaxis: { labels: { formatter: (v) => v.toLocaleString("en-US") } },
    tooltip: tooltip("#587CCA"),
    legend: { position: "top", horizontalAlign: "left" },
  };
  return (
    <ReactApexChart options={options} series={series} type="bar" height={height} />
  );
}
