import { describe, expect, it } from 'vitest';
import { chartGeometry, niceTicks } from '../../src/components/chartGeometry';

const BOX = { width: 300, height: 100, left: 0, right: 0, top: 0, bottom: 0 };

describe('chart geometry', () => {
  it('breaks the line at a null value instead of joining across it', () => {
    const g = chartGeometry(
      [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-13', value: 2 },
        { date: '2026-01-25', value: null },
        { date: '2026-02-06', value: 3 },
        { date: '2026-02-18', value: 4 },
      ],
      BOX,
    );
    expect(g.paths).toHaveLength(2);
    expect(g.dots).toHaveLength(4);
  });

  it('places dates by real time, so uneven gaps stay uneven', () => {
    const g = chartGeometry(
      [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-13', value: 2 },
        { date: '2026-03-14', value: 3 },
      ],
      BOX,
    );
    const xs = g.dots.map((d) => d.x);
    expect(xs[1]! - xs[0]!).toBeCloseTo(300 * (12 / 72));
  });

  it('keeps the clipped flag on a dot, so the chart can draw it as a bound', () => {
    const g = chartGeometry(
      [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-13', value: 5, clipped: 'above' },
      ],
      BOX,
    );
    expect(g.dots.map((d) => d.clipped)).toEqual([undefined, 'above']);
  });

  it('reports no data when every value is null', () => {
    expect(chartGeometry([{ date: '2026-01-01', value: null }], BOX).hasData).toBe(false);
  });

  it('makes round ticks', () => {
    expect(niceTicks(-24.3, -10.1)).toEqual([-20, -15]);
  });
});
