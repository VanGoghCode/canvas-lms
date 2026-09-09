import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildCourseAnalytics, type CourseAnalytics } from '../lib/analytics';
import { useLms } from '../lib/LmsContext';

function shortLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 16)}…` : value;
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function InsightsPanel({ analytics }: { analytics: CourseAnalytics }) {
  const scoredAssignments = analytics.assignmentMetrics.filter((item) => item.averageScore != null);
  const strongest = scoredAssignments.reduce<(typeof scoredAssignments)[number] | undefined>(
    (best, item) => !best || (item.averageScore ?? 0) > (best.averageScore ?? 0) ? item : best,
    undefined,
  );
  const mostDifficult = scoredAssignments.reduce<(typeof scoredAssignments)[number] | undefined>(
    (lowest, item) => !lowest || (item.averageScore ?? 0) < (lowest.averageScore ?? 0) ? item : lowest,
    undefined,
  );
  const highEngagement = analytics.cohorts.find((cohort) => cohort.cohort === 'High engagement');
  const comparisonCohort = [...analytics.cohorts]
    .reverse()
    .find((cohort) => cohort.cohort !== 'High engagement' && cohort.averageScore != null);

  return (
    <section className="analytics-insights" aria-labelledby="insights-heading">
      <div>
        <span className="eyebrow">What the data suggests</span>
        <h2 id="insights-heading">Performance insights</h2>
      </div>
      <p>
        This view includes {analytics.totalSubmissions} submissions, with {analytics.gradedSubmissions} graded. Student performance averages {analytics.overallAverage == null ? 'not yet available' : `${analytics.overallAverage}%`}, while assignment completion is {analytics.overallCompletion}%. {analytics.overallCompletion < 90 ? 'Incomplete work is currently the largest visible drag on overall results.' : 'Participation is strong enough that score quality, rather than missing work, is the main performance driver.'}
      </p>
      <p>
        {strongest && mostDifficult
          ? strongest.assignmentId === mostDifficult.assignmentId
            ? `${strongest.assignment} averages ${strongest.averageScore}%. With one assignment in scope, expand the filter to compare where students encounter the most difficulty.`
            : `${strongest.assignment} is the strongest area at ${strongest.averageScore}%, while ${mostDifficult.assignment} is the most difficult at ${mostDifficult.averageScore}%. The gap points to where review materials or targeted instruction may have the greatest impact.`
          : 'There are not enough graded assignments in this filter range to identify a strongest or most difficult topic yet.'}
      </p>
      <p>
        {highEngagement?.averageScore != null && comparisonCohort?.averageScore != null
          ? highEngagement.averageScore >= comparisonCohort.averageScore
            ? `Submission consistency is positively associated with success: the high-engagement cohort averages ${highEngagement.averageScore}%, compared with ${comparisonCohort.averageScore}% for the ${comparisonCohort.cohort.toLowerCase()} cohort.`
            : `Completion alone does not explain the score pattern in this range: the high-engagement cohort averages ${highEngagement.averageScore}%, compared with ${comparisonCohort.averageScore}% for the ${comparisonCohort.cohort.toLowerCase()} cohort.`
          : 'Cohort score differences will become clearer as more students submit and receive grades.'}{' '}
        {analytics.onTimeAverage != null && analytics.lateAverage != null
          ? `On-time work averages ${analytics.onTimeAverage}%, compared with ${analytics.lateAverage}% for late submissions.`
          : 'The current range does not contain enough both on-time and late graded work for a timing comparison.'}
      </p>
    </section>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="card analytics-chart-card">
      <header><h2>{title}</h2><p>{description}</p></header>
      <div className="chart-frame" role="img" aria-label={`${title}. ${description}`}>{children}</div>
    </section>
  );
}

export default function InstructorAnalyticsPage() {
  const { session, courses, assignments, submissions, enrollments } = useLms();
  const ownedCourses = courses.filter((course) => course.instructorId === session?.userId);
  const [courseId, setCourseId] = useState(ownedCourses[0]?.id ?? '');
  const [assignmentId, setAssignmentId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const courseAssignments = assignments.filter((assignment) => assignment.courseId === courseId);
  const analytics = useMemo(
    () => buildCourseAnalytics(courseId, { assignmentId, dateFrom, dateTo }, assignments, submissions, enrollments),
    [assignmentId, assignments, courseId, dateFrom, dateTo, enrollments, submissions],
  );

  if (session?.role !== 'instructor') return <Navigate to="/dashboard" replace />;
  if (ownedCourses.length === 0) return <Navigate to="/instructor" replace />;

  const selectedCourse = ownedCourses.find((course) => course.id === courseId) ?? ownedCourses[0];

  return (
    <div className="page analytics-page">
      <header className="page-header analytics-page-header">
        <span className="eyebrow">Instructor analytics</span>
        <h1>Course performance</h1>
        <p className="muted">Explore grade, completion, and engagement patterns for {selectedCourse.title}.</p>
      </header>

      <section className="card analytics-filters" aria-labelledby="filters-heading">
        <div className="filter-heading">
          <div><h2 id="filters-heading">Filter analytics</h2><p>All charts and insights update together.</p></div>
          <button className="button button-secondary" type="button" onClick={() => { setAssignmentId(''); setDateFrom(''); setDateTo(''); }}>Reset filters</button>
        </div>
        <div className="filter-grid">
          {ownedCourses.length > 1 && (
            <label htmlFor="analytics-course">Course
              <select id="analytics-course" value={courseId} onChange={(event) => { setCourseId(event.target.value); setAssignmentId(''); }}>
                {ownedCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
              </select>
            </label>
          )}
          <label htmlFor="analytics-assignment">Assignment
            <select id="analytics-assignment" value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
              <option value="">All assignments</option>
              {courseAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}
            </select>
          </label>
          <label htmlFor="analytics-date-from">From
            <input id="analytics-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label htmlFor="analytics-date-to">To
            <input id="analytics-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </div>
      </section>

      <InsightsPanel analytics={analytics} />

      <div className="analytics-kpis" aria-label="Analytics summary">
        <div><span>Average grade</span><strong>{analytics.overallAverage == null ? '—' : `${analytics.overallAverage}%`}</strong></div>
        <div><span>Completion</span><strong>{analytics.overallCompletion}%</strong></div>
        <div><span>Submissions</span><strong>{analytics.totalSubmissions}</strong></div>
        <div><span>Graded</span><strong>{analytics.gradedSubmissions}</strong></div>
      </div>

      <div className="analytics-chart-grid">
        <ChartCard title="Grade distribution" description="Students grouped by their points-based grade in the selected scope.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.gradeDistribution} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="grade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="students" name="Students" fill="#1f5f8b" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Assignment completion" description="Share of enrolled students who submitted each assignment.">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics.assignmentMetrics} margin={{ top: 12, right: 18, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="assignment" tickFormatter={shortLabel} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(value) => [`${value}%`, 'Completion']} />
              <Line type="monotone" dataKey="completionRate" name="Completion" stroke="#277c5c" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Engagement over time" description="Daily submission activity and unique active students.">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analytics.engagementTimeline} margin={{ top: 12, right: 18, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="submissionArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1f5f8b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1f5f8b" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatChartDate} />
              <YAxis allowDecimals={false} />
              <Tooltip labelFormatter={(value) => formatChartDate(String(value))} />
              <Legend />
              <Area type="monotone" dataKey="submissions" name="Submissions" stroke="#1f5f8b" strokeWidth={2} fill="url(#submissionArea)" />
              <Line type="monotone" dataKey="activeStudents" name="Active students" stroke="#d27a2c" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Scores by assignment" description="Average score as a percentage of points possible.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.assignmentMetrics} margin={{ top: 12, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="assignment" tickFormatter={shortLabel} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(value) => [`${value}%`, 'Average score']} />
              <Bar dataKey="averageScore" name="Average score" fill="#7656a4" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="card cohort-section" aria-labelledby="cohort-heading">
        <div className="section-heading">
          <div><span className="eyebrow">Cohort comparison</span><h2 id="cohort-heading">Performance by engagement group</h2></div>
          <span>{analytics.cohorts.length} groups present</span>
        </div>
        <p className="cohort-description">Because seeded demographic profiles are intentionally blank, cohorts are based on assignment completion: high engagement is 80–100%, moderate is 50–79.9%, and low is below 50%.</p>
        {analytics.cohorts.length === 0 ? (
          <p className="empty">No cohort data is available for the current filters.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student group</th><th>Students</th><th>Completion</th><th>Average score</th></tr></thead>
              <tbody>{analytics.cohorts.map((cohort) => (
                <tr key={cohort.cohort}>
                  <td><strong>{cohort.cohort}</strong></td>
                  <td>{cohort.students}</td>
                  <td>{cohort.completionRate}%</td>
                  <td>{cohort.averageScore == null ? 'Awaiting grades' : `${cohort.averageScore}%`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
