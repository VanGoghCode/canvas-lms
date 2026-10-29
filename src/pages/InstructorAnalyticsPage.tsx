import { InfoButton } from '../components/InfoButton';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MetricChart } from '../components/MetricChart';
import { useCourseAnalytics, type CourseAnalytics } from '../lib/analytics';
import { useLms } from '../lib/LmsContext';
import { supportAssessment } from '../lib/support';

const noFilters = { assignmentId: '', dateFrom: '', dateTo: '' };

/** Filters → one analytics object → insights, KPIs, charts, and cohort table. */
export function InstructorAnalyticsPage() {
  const { session, courses, assignments, submissions, supportSubmissions, enrollments } = useLms();
  const myCourses = courses.filter((c) => c.instructorId === session!.userId);
  const [courseId, setCourseId] = useState(myCourses[0]?.id ?? '');
  const [filters, setFilters] = useState(noFilters);
  const setFilter = (key: keyof typeof noFilters, value: string) =>
    setFilters({ ...filters, [key]: value });

  const course = myCourses.find((c) => c.id === courseId) ?? myCourses[0];
  const { data: results, error } = useCourseAnalytics(
    course ? [{ courseId: course.id, filters }] : [], assignments, submissions, enrollments,
  );
  if (!course) return <Navigate to="/instructor" replace />;
  const courseEnrollments = enrollments.filter((e) => e.courseId === course.id);
  const atRisk = courseEnrollments.filter((e) =>
    supportAssessment(e.studentId, course.id, assignments, supportSubmissions).needsSupport,
  ).length;
  const invalidRange = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
  const data = results?.[0];
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
          {course.code} · {course.title} · as of Aug 15, 2026 (UTC).{' '}
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

      <div className="risk-overview">
        <MetricChart
          title="At-risk students"
          description="Students flagged for a check-in in this course. Assignment and date filters do not apply."
          series={['Students']}
          rows={[
            { label: 'At risk', values: [atRisk] },
            { label: 'Not flagged', values: [courseEnrollments.length - atRisk] },
          ]}
          unit=""
          max={Math.max(1, courseEnrollments.length)}
        />
        <Link className="button" to={`/instructor/students?course=${encodeURIComponent(course.id)}&status=support`}>
          View at-risk students →
        </Link>
      </div>

      {invalidRange ? (
        <p className="note" role="alert">
          Choose an end date on or after the start date, or reset the filters.
        </p>
      ) : error ? (
        <p className="note" role="alert">Course analytics are unavailable. Check that the local application server is running.</p>
      ) : !data ? (
        <p className="note" role="status">Loading course analytics…</p>
      ) : (
        <>
          {!data.assignmentMetrics.length && (
            <p className="note" role="status">
              No assignments match these filters. Adjust the dates or reset the filters to see
              course activity.
            </p>
          )}
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

          {data.history?.courses > 0 && (
            <section className="card history-summary">
              <div className="section-heading">
                <h2>Previous years: flags and final scores</h2>
                <span className="pill neutral">2023–2025</span>
              </div>
              <p className="muted">Selected past courses for enrolled students with bundled history. A final score below 70% is used for this comparison. Assignment and date filters do not apply.</p>
              <div className="history-metrics">
                <div><strong>{data.history.courses}</strong><span>Past course records</span></div>
                <div><strong>{data.history.flagged}</strong><span>Earlier support flags</span></div>
                <div><strong>{data.history.flaggedPassing} / {data.history.passing}</strong><span>Flagged among scores 70% or higher</span></div>
                <div><strong>{data.history.unflaggedBelow70} / {data.history.below70}</strong><span>Not flagged among scores below 70%</span></div>
              </div>
            </section>
          )}

          {data.outcomes?.students > 0 && (
            <section className="card history-summary">
              <div className="section-heading">
                <h2>Earlier cohort outcomes</h2>
                <span className="pill neutral">2022–2026</span>
              </div>
              <p className="muted">Students who started in 2022, with program status in 2025 and a follow-up in 2026. Assignment and date filters do not apply.</p>
              <div className="history-metrics">
                <div><strong>{data.outcomes.students}</strong><span>Students followed</span></div>
                <div><strong>{data.outcomes.completed}</strong><span>Completed by 2025</span></div>
                <div><strong>{data.outcomes.employed}</strong><span>Employed at follow-up</span></div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th scope="col">Group</th><th scope="col">Flagged, then completed</th><th scope="col">Not flagged, then not completed</th></tr></thead>
                  <tbody>
                    {data.outcomes.groups.map((group) => (
                      <tr key={group.group}>
                        <th scope="row">{group.group.replace(/-/g, ' ')}</th>
                        <td>{pct(group.flaggedCompleted)}</td>
                        <td>{pct(group.unflaggedNotCompleted)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>View cohort records</summary>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th scope="col">Student</th><th scope="col">Race</th><th scope="col">Earlier flag</th><th scope="col">Program status</th><th scope="col">Follow-up</th></tr></thead>
                    <tbody>
                      {data.outcomes.records.map((record) => (
                        <tr key={record.id}>
                          <th scope="row">{record.name}</th><td>{record.race.replace(/-/g, ' ')}</td>
                          <td>{record.flagged ? 'Yes' : 'No'}</td><td>{record.completion}</td><td>{record.followUp} · {record.followUpDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}

          <div className="grid analytics-grid">
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
            <h2>Support by student group</h2>
            <p className="muted">Share of students suggested for a check-in.</p>
            {(data.demographicGroups ?? []).length === 0 ? (
              <p className="muted">No group information is available.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th scope="col">Category</th><th scope="col">Group</th><th scope="col">Support rate</th></tr>
                  </thead>
                  <tbody>
                    {data.demographicGroups.map((group) => (
                      <tr key={`${group.category}:${group.group}`}>
                        <td>{group.category === 'genderIdentity' ? 'Gender identity' : group.category === 'ethnicity' ? 'Ethnicity' : 'Race'}</td>
                        <td>{group.group.replace(/-/g, ' ')}</td>
                        <td>{group.supportRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
          <details className="card">
            <summary>More performance insights</summary>
            <Insights data={data} />
          </details>
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
