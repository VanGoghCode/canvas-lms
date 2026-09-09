import { Link } from 'react-router-dom';
import { formatDate } from '../lib/data';
import type { Assignment } from '../types';

export function AssignmentList({ assignments }: { assignments: Assignment[] }) {
  if (!assignments.length) return <p className="empty">No assignments.</p>;

  return (
    <div className="list">
      {assignments.map((assignment) => (
        <Link className="list-row" to={`/assignments/${assignment.id}`} key={assignment.id}>
          <div>
            <strong>{assignment.title}</strong>
            <span className="muted">Due {formatDate(assignment.dueDate)}</span>
          </div>
          <span>{assignment.pointsPossible} pts</span>
        </Link>
      ))}
    </div>
  );
}
