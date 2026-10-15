import { InfoButton } from '../components/InfoButton';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MetricChart } from '../components/MetricChart';
import { buildCourseAnalytics, type CourseAnalytics } from '../lib/analytics';
import { useLms } from '../lib/LmsContext';

const noFilters = { assignmentId: '', dateFrom: '', dateTo: '' };

/** Filters → one analytics object → insights, KPIs, charts, and cohort table. */
export function InstructorAnalyticsPage() {
  const { session, courses, assignments, submissions, enrollments } = useLms();
  const myCourses = courses.filter((c) => c.instructorId === session!.userId);
  const [courseId, setCourseId] = useState(myCourses[0]?.id ?? '');
  const [filters, setFilters] = useState(noFilters);
  const setFilter = (key: keyof typeof noFilters, value: string) =>
    setFilters({ ...filters, [key]: value });

  if (myCourses.length === 0) return <Navigate to="/instructor" replace />;

  const course = myCourses.find((c) => c.id === courseId) ?? myCourses[0];
  const invalidRange = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
  const data = buildCourseAnalytics(course.id, filters, assignments, submissions, enrollments);
  const chartDate = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  const pct = (value: number | null) => (value == null ? '—' : `${value}%`);

  return (
    <div className="page">
      <header>
        <span className="eyebrow">Instructor analytics</span>
        <h1>Course performance</h1>
        <p className="muted">
          Evidence for your next teaching decision.{' '}
          <InfoButton title="Course analytics">
            <p>
              Grade, completion, and submission patterns for {course.title}. Date filters select
              assignment deadlines in UTC, not submission dates. All received work for those
              assignments remains included. Future missing work is never scored zero; pending grades
              are excluded from current grades.
            </p>
          </InfoButton>
        </p>
      </header>

      <section className="card filters">
        {myCourses.length > 1 && (
          <label>
            Course
            <select
              value={course.id}
              onChange={(e) => {
                setCourseId(e.target.value);
                setFilter('assignmentId', '');
              }}
            >
              {myCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Assignment
          <select
            value={filters.assignmentId}
            onChange={(e) => setFilter('assignmentId', e.target.value)}
          >
            <option value="">All assignments</option>
            {assignments
              .filter((a) => a.courseId === course.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Due from
          <input
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(e) => setFilter('dateFrom', e.target.value)}
          />
        </label>
        <label>
          Due through
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(e) => setFilter('dateTo', e.target.value)}
          />
        </label>
        <button className="button" type="button" onClick={() => setFilters(noFilters)}>
          Reset filters
        </button>
      </section>

      {invalidRange ? (
        <p className="note" role="alert">
          Choose an end date on or after the start date, or reset the filters.
        </p>
      ) : (
        <>
          {!data.assignmentMetrics.length && (
            <p className="note" role="status">
              No assignments match these filters. Adjust the dates or reset the filters to see
              course activity.
            </p>
          )}
          <Insights data={data} />

          <div className="kpis">
            <div>
              <span>Average grade</span>
              <strong>{pct(data.overallAverage)}</strong>
            </div>
            <div>
              <span>Due-work completion</span>
              <strong>{pct(data.overallCompletion)}</strong>
            </div>
            <div>
              <span>Submissions</span>
              <strong>{data.totalSubmissions}</strong>
            </div>
            <div>
              <span>Graded</span>
              <strong>{data.gradedSubmissions}</strong>
            </div>
          </div>

          <div className="grid">
            <MetricChart
              title="Grade distribution"
              description="Students grouped by their points-based grade."
              series={['Students']}
              unit=""
              rows={data.gradeDistribution.map((g) => ({ label: g.grade, values: [g.students] }))}
            />
            <MetricChart
              title="Assignment completion"
              description="Share of enrolled students who submitted each assignment."
              series={['Completion']}
              max={100}
              rows={data.assignmentMetrics.map((a) => ({
                label: a.assignment,
                values: [a.completionRate],
              }))}
            />
            <MetricChart
              title="Submission activity over time"
              description="Daily latest submissions and unique students (UTC); not a full attempt history."
              series={['Submissions', 'Active students']}
              unit=""
              rows={data.engagementTimeline.map((d) => ({
                label: chartDate(d.date),
                values: [d.submissions, d.activeStudents],
              }))}
            />
            <MetricChart
              title="Scores by assignment"
              description="Average score as a percentage of points possible."
              series={['Average score']}
              max={100}
              rows={data.assignmentMetrics.map((a) => ({
                label: a.assignment,
                values: [a.averageScore],
              }))}
            />
          </div>

          <section className="card">
            <h2>
              Performance by engagement group{' '}
              <InfoButton title="Engagement groups">
                <p>
                  Groups use due-work completion: high is at least 80%, moderate at least 50%, and
                  low below 50%. Submission counts are a participation proxy, not evidence of study
                  time. Group differences do not establish causation.
                </p>
              </InfoButton>
            </h2>
            {data.cohorts.length === 0 ? (
              <p className="muted">No cohort data for these filters.</p>
            ) : (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Scrollable data table"
              >
                <table
                  className="data-table cohort-table"
                  aria-label="Performance by engagement group"
                >
                  <colgroup>
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '25%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Student group</th>
                      <th scope="col" className="numeric">
                        Students
                      </th>
                      <th scope="col" className="numeric">
                        Completion
                      </th>
                      <th scope="col" className="numeric">
                        Average score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.map((c) => (
                      <tr key={c.cohort}>
                        <th scope="row">{c.cohort}</th>
                        <td className="numeric">{c.students}</td>
                        <td className="numeric">{c.completionRate}%</td>
                        <td className="numeric">
                          {c.averageScore == null ? 'Awaiting grades' : `${c.averageScore}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Three plain-language sentences generated from the numbers. */
function Insights({ data }: { data: CourseAnalytics }) {
  const scored = data.assignmentMetrics
    .filter((a) => a.averageScore != null)
    .sort((a, b) => a.averageScore! - b.averageScore!);
  const hardest = scored[0];
  const easiest = scored[scored.length - 1];
  const high = data.cohorts.find((c) => c.cohort === 'High engagement');
  const other = [...data.cohorts].reverse().find((c) => c !== high && c.averageScore != null);

  const overview =
    `This view includes ${data.totalSubmissions} submissions, with ${data.gradedSubmissions} graded. ` +
    `Student performance averages ${data.overallAverage == null ? 'not yet available' : `${data.overallAverage}%`}, ` +
    `while due-work completion is ${data.overallCompletion == null ? 'not yet available' : `${data.overallCompletion}%`}. ` +
    'Missing overdue work counts as zero; pending grading does not. These descriptive figures do not establish causes of performance.';

  const assignmentsText = !hardest
    ? 'There are not enough graded assignments in this filter range to identify a strongest or most difficult topic yet.'
    : hardest === easiest
      ? `${easiest.assignment} averages ${easiest.averageScore}%. Widen the filter to compare assignments.`
      : `${easiest.assignment} has the highest average submitted score at ${easiest.averageScore}%, and ${hardest.assignment} the lowest at ${hardest.averageScore}%. Different tasks and sample sizes mean this does not establish topic difficulty.`;

  const cohortText =
    high?.averageScore != null && other?.averageScore != null
      ? `${
          high.averageScore >= other.averageScore
            ? 'This view shows a higher average submitted score in the high-completion group'
            : 'Completion alone does not explain the score pattern in this range'
        }: the high-engagement cohort averages ${high.averageScore}%, compared with ${other.averageScore}% for the ${other.cohort.toLowerCase()} cohort.`
      : 'Cohort score differences will become clearer as more students submit and receive grades.';

  const timingText =
    data.onTimeAverage != null && data.lateAverage != null
      ? `On-time work averages ${data.onTimeAverage}%, compared with ${data.lateAverage}% for late submissions.`
      : 'The current range does not contain both on-time and late graded work for a timing comparison.';

  return (
    <section className="card dark stack">
      <h2>
        Performance insights{' '}
        <InfoButton title="Understanding these insights">
          <p>{overview}</p>
          <p>{assignmentsText}</p>
          <p>
            {cohortText} {timingText}
          </p>
        </InfoButton>
      </h2>
      <div className="insight-grid">
        <div>
          <span>Highest submitted score</span>
          <strong>{easiest ? `${easiest.averageScore}%` : '—'}</strong>
          <small>{easiest?.assignment ?? 'No graded work'}</small>
        </div>
        <div>
          <span>Lowest submitted score</span>
          <strong>{hardest ? `${hardest.averageScore}%` : '—'}</strong>
          <small>{hardest?.assignment ?? 'No graded work'}</small>
        </div>
        <div>
          <span>Awaiting grading</span>
          <strong>{data.totalSubmissions - data.gradedSubmissions}</strong>
          <small>Received responses</small>
        </div>
      </div>
    </section>
  );
}
