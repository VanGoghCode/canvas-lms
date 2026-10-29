import students from '../data/students.json';
import { byId } from '../lib/data';

export function AcademicHistory({ studentId, instructor = false }: { studentId: string; instructor?: boolean }) {
  const history = byId(students, studentId)?.history;
  if (!history?.length) return null;
  return (
    <div className="history">
      <p className="muted">Selected completed courses · Year 4 is in progress in 2026.</p>
      <div className="table-wrap">
        <table className="data-table history-table">
          <colgroup>
            <col style={{ width: instructor ? '24%' : '25%' }} />
            <col style={{ width: instructor ? '38%' : '50%' }} />
            <col style={{ width: instructor ? '19%' : '25%' }} />
            {instructor && <col style={{ width: '19%' }} />}
          </colgroup>
          <thead><tr><th scope="col">Year</th><th scope="col">Course</th><th scope="col">Final score</th>{instructor && <th scope="col">Earlier flag</th>}</tr></thead>
          <tbody>
            {history.map((entry, index) => (
              <tr key={entry.year}>
                <th scope="row">{index + 1} · {entry.year}</th>
                <td>{entry.course}</td>
                <td>{entry.finalScore}%</td>
                {instructor && <td><span aria-hidden="true" className={`support-dot ${entry.supportFlag ? 'alert' : 'clear'}`} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
