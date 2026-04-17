import Highcharts from 'highcharts/highstock';

const PAN_RATIO = 0.2;

export type PanDirection = 'left' | 'right' | 'up' | 'down';

function getAxisExtremes(axis: Highcharts.Axis): { min: number; max: number } | null {
  const { min, max, dataMin, dataMax } = axis.getExtremes();
  const effectiveMin = typeof min === 'number' ? min : dataMin;
  const effectiveMax = typeof max === 'number' ? max : dataMax;
  if (typeof effectiveMin !== 'number' || typeof effectiveMax !== 'number') {
    return null;
  }
  return { min: effectiveMin, max: effectiveMax };
}

function panAxis(axis: Highcharts.Axis | undefined, direction: -1 | 1): boolean {
  if (!axis) {
    return false;
  }

  const extremes = getAxisExtremes(axis);
  if (!extremes) {
    return false;
  }

  const range = extremes.max - extremes.min;
  if (range <= 0) {
    return false;
  }

  const shift = range * PAN_RATIO * direction;
  let nextMin = extremes.min + shift;
  let nextMax = extremes.max + shift;

  const { dataMin, dataMax } = axis.getExtremes();
  if (typeof dataMin === 'number' && typeof dataMax === 'number') {
    const dataRange = dataMax - dataMin;
    if (range >= dataRange) {
      nextMin = dataMin;
      nextMax = dataMax;
    } else {
      if (nextMin < dataMin) {
        nextMin = dataMin;
        nextMax = dataMin + range;
      }

      if (nextMax > dataMax) {
        nextMax = dataMax;
        nextMin = dataMax - range;
      }
    }
  }

  axis.setExtremes(nextMin, nextMax, false, false);
  return true;
}

export function panChart(chart: Highcharts.Chart | undefined, direction: PanDirection): void {
  if (!chart) {
    return;
  }

  let didPan = false;
  if (direction === 'left') {
    didPan = panAxis(chart.xAxis[0], -1);
  }
  if (direction === 'right') {
    didPan = panAxis(chart.xAxis[0], 1);
  }
  if (direction === 'up') {
    didPan = panAxis(chart.yAxis[0], 1);
  }
  if (direction === 'down') {
    didPan = panAxis(chart.yAxis[0], -1);
  }

  if (didPan) {
    chart.redraw(false);
  }
}
