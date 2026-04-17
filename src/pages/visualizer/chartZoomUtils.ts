import Highcharts from 'highcharts/highstock';

const ZOOM_IN_FACTOR = 0.8;
const ZOOM_OUT_FACTOR = 1.25;

export type ZoomDirection = 'in' | 'out';

function getAxisExtremes(axis: Highcharts.Axis): { min: number; max: number } | null {
  const { min, max, dataMin, dataMax } = axis.getExtremes();
  const effectiveMin = typeof min === 'number' ? min : dataMin;
  const effectiveMax = typeof max === 'number' ? max : dataMax;
  if (typeof effectiveMin !== 'number' || typeof effectiveMax !== 'number') {
    return null;
  }
  return { min: effectiveMin, max: effectiveMax };
}

function zoomAxis(axis: Highcharts.Axis | undefined, factor: number): boolean {
  if (!axis) {
    return false;
  }

  const extremes = getAxisExtremes(axis);
  if (!extremes) {
    return false;
  }

  const currentRange = extremes.max - extremes.min;
  if (currentRange <= 0) {
    return false;
  }

  const nextRange = currentRange * factor;
  const center = (extremes.min + extremes.max) / 2;
  let nextMin = center - nextRange / 2;
  let nextMax = center + nextRange / 2;

  const { dataMin, dataMax } = axis.getExtremes();
  if (typeof dataMin === 'number' && typeof dataMax === 'number') {
    const dataRange = dataMax - dataMin;
    if (nextRange >= dataRange) {
      nextMin = dataMin;
      nextMax = dataMax;
    } else {
      if (nextMin < dataMin) {
        nextMin = dataMin;
        nextMax = dataMin + nextRange;
      }
      if (nextMax > dataMax) {
        nextMax = dataMax;
        nextMin = dataMax - nextRange;
      }
    }
  }

  axis.setExtremes(nextMin, nextMax, false, false);
  return true;
}

export function zoomChart(chart: Highcharts.Chart | undefined, direction: ZoomDirection): void {
  if (!chart) {
    return;
  }

  const factor = direction === 'in' ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
  const didZoomX = zoomAxis(chart.xAxis[0], factor);
  const didZoomY = zoomAxis(chart.yAxis[0], factor);
  if (didZoomX || didZoomY) {
    chart.redraw(false);
  }
}

export function resetChartZoom(chart: Highcharts.Chart | undefined): void {
  if (!chart) {
    return;
  }

  chart.xAxis[0]?.setExtremes(undefined, undefined, false, false);
  chart.yAxis[0]?.setExtremes(undefined, undefined, false, false);
  chart.redraw(false);
}
