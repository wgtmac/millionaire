(function (root) {
  function computeMovingAverage(values, windowSize = 30) {
    const result = new Array(values.length).fill(null);
    if (!Number.isFinite(windowSize) || windowSize <= 0) {
      return result;
    }

    let sum = 0;
    for (let i = 0; i < values.length; i += 1) {
      const current = Number(values[i]);
      sum += current;
      if (i >= windowSize) {
        sum -= Number(values[i - windowSize]);
      }
      if (i >= windowSize - 1) {
        result[i] = Number((sum / windowSize).toFixed(4));
      }
    }
    return result;
  }

  function computeMovingAverageSeries(values, windows) {
    const series = {};
    for (const windowSize of windows) {
      series[windowSize] = computeMovingAverage(values, windowSize);
    }
    return series;
  }

  const api = { computeMovingAverage, computeMovingAverageSeries };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports.computeMovingAverage = computeMovingAverage;
    module.exports.computeMovingAverageSeries = computeMovingAverageSeries;
  }

  if (root) {
    root.ChartHelpers = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
