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

  // A falsy/invalid count means "show everything", capped at the total record count.
  function resolveWindowSize(total, count) {
    if (!Number.isFinite(total) || total <= 0) return 0;
    if (!Number.isFinite(count) || count <= 0) return total;
    return Math.min(count, total);
  }

  function clampViewStart(total, windowSize, desiredStart) {
    const maxStart = Math.max(0, total - windowSize);
    if (!Number.isFinite(desiredStart)) return maxStart;
    return Math.max(0, Math.min(maxStart, Math.round(desiredStart)));
  }

  const api = {
    computeMovingAverage,
    computeMovingAverageSeries,
    resolveWindowSize,
    clampViewStart,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports.computeMovingAverage = computeMovingAverage;
    module.exports.computeMovingAverageSeries = computeMovingAverageSeries;
    module.exports.resolveWindowSize = resolveWindowSize;
    module.exports.clampViewStart = clampViewStart;
  }

  if (root) {
    root.ChartHelpers = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
