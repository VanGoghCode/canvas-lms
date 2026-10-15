import { InfoButton } from './InfoButton';
interface Props {
  title: string;
  description: string;
  series: string[]; // one name per bar in a row
  rows: { label: string; values: (number | null)[] }[];
  unit?: string;
  max?: number; // defaults to the largest value
}

/** A plain-HTML bar chart; every bar also shows its number. */
export function MetricChart({ title, description, series, rows, unit = '%', max }: Props) {
  const scale = max ?? Math.max(1, ...rows.flatMap((row) => row.values.map((v) => v ?? 0)));
  return (
    <section className="card">
      <h2>
        {title}{' '}
        <InfoButton title={title}>
          <p>{description}</p>
        </InfoButton>
      </h2>
      <div className="legend">
        {series.map((name, i) => (
          <span key={name}>
            <i className={`series-${i}`} />
            {name}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted">No activity for these filters.</p>
      ) : (
        <div className="chart" tabIndex={0} role="region" aria-label={title}>
          {rows.map((row, r) => (
            <div className="chart-row" key={r}>
              <span className="muted">{row.label}</span>
              <div>
                {row.values.map((value, i) =>
                  value == null ? (
                    <div key={i} className="muted">
                      No graded work
                    </div>
                  ) : (
                    <div key={i} className="chart-value">
                      <div
                        className="track"
                        role="meter"
                        aria-label={`${row.label}: ${series[i]}`}
                        aria-valuemin={0}
                        aria-valuemax={scale}
                        aria-valuenow={value}
                        aria-valuetext={`${value}${unit}`}
                      >
                        <div
                          className={`series-${i}`}
                          style={{ width: `${Math.min(100, (value / scale) * 100)}%` }}
                        />
                      </div>
                      <strong>
                        {value}
                        {unit}
                      </strong>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
