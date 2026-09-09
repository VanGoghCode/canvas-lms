#!/usr/bin/env python3
"""Generate a weekly administrative report from the Canvas Lite JSON data.

The report combines course performance, assignment completion, intervention
needs, engagement-group comparisons, and notable trends in one timestamped CSV.
Run ``python scripts/weekly_report.py --help`` for optional date and path inputs.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd


# ---------------------------------------------------------------------------
# ADMINISTRATOR SETTINGS
# Edit these plain-language values to change how the report classifies results.
# Percentages use a 0-100 scale. No other code changes should be necessary.
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ReportThresholds:
    """Thresholds that control report labels and intervention flags."""

    passing_grade_percent: float = 70.0
    intervention_grade_percent: float = 70.0
    intervention_completion_percent: float = 70.0
    high_engagement_percent: float = 80.0
    moderate_engagement_percent: float = 50.0
    low_assignment_completion_percent: float = 75.0
    meaningful_score_gap_percent: float = 5.0
    meaningful_weekly_change_percent: float = 20.0


THRESHOLDS = ReportThresholds()
REPORT_COLUMNS = [
    "report_week_start",
    "report_week_end",
    "section",
    "course_code",
    "course_title",
    "entity_id",
    "entity_name",
    "student_id",
    "student_name",
    "group_name",
    "student_count",
    "pass_rate_percent",
    "average_grade_percent",
    "completion_rate_percent",
    "missing_submissions",
    "reason",
    "suggested_action",
    "finding",
]


@dataclass
class ReportData:
    """Calculated tables used by both the CSV and console summary."""

    courses: pd.DataFrame
    assignments: pd.DataFrame
    interventions: pd.DataFrame
    cohorts: pd.DataFrame
    findings: list[str]
    week_start: pd.Timestamp
    week_end: pd.Timestamp
    weekly_submission_count: int


def parse_args() -> argparse.Namespace:
    """Parse optional report date and path overrides."""

    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Generate the weekly Canvas Lite administrative report.",
    )
    parser.add_argument(
        "--as-of",
        help="Last date included in the report (YYYY-MM-DD). Defaults to today.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=project_root / "src" / "data",
        help="Directory containing the LMS JSON files.",
    )
    parser.add_argument(
        "--reports-dir",
        type=Path,
        default=project_root / "reports",
        help="Directory where the timestamped CSV will be written.",
    )
    return parser.parse_args()


def load_lms_data(data_dir: Path) -> dict[str, pd.DataFrame]:
    """Read and validate the five LMS JSON datasets with pandas."""

    required_columns = {
        "students": {"id", "name", "email"},
        "courses": {"id", "code", "title", "instructorId"},
        "enrollments": {"id", "studentId", "courseId"},
        "assignments": {"id", "courseId", "title", "dueDate", "pointsPossible"},
        "submissions": {"id", "assignmentId", "studentId", "submittedAt", "score"},
    }
    data: dict[str, pd.DataFrame] = {}

    for name, columns in required_columns.items():
        path = data_dir / f"{name}.json"
        if not path.exists():
            raise FileNotFoundError(f"Required LMS data file not found: {path}")
        frame = pd.read_json(path)
        missing_columns = columns.difference(frame.columns)
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise ValueError(f"{path.name} is missing required columns: {missing}")
        data[name] = frame

    data["assignments"]["dueDate"] = pd.to_datetime(
        data["assignments"]["dueDate"], errors="raise"
    )
    data["submissions"]["submittedAt"] = pd.to_datetime(
        data["submissions"]["submittedAt"], errors="raise"
    )
    data["submissions"]["score"] = pd.to_numeric(
        data["submissions"]["score"], errors="coerce"
    )
    return data


def calculate_report(
    data: dict[str, pd.DataFrame],
    as_of: pd.Timestamp,
    thresholds: ReportThresholds = THRESHOLDS,
) -> ReportData:
    """Calculate all course, assignment, intervention, cohort, and trend results."""

    students = data["students"].rename(columns={"id": "studentId", "name": "studentName"})
    courses = data["courses"].rename(
        columns={"id": "courseId", "code": "courseCode", "title": "courseTitle"}
    )
    assignments = data["assignments"].rename(
        columns={"id": "assignmentId", "title": "assignmentTitle"}
    )
    submissions = data["submissions"].copy()
    report_cutoff = as_of.normalize() + timedelta(days=1) - timedelta(microseconds=1)
    submissions = submissions.loc[submissions["submittedAt"] <= report_cutoff]
    submissions = (
        submissions.sort_values("submittedAt")
        .drop_duplicates(["studentId", "assignmentId"], keep="last")
    )

    student_assignments = (
        data["enrollments"][["studentId", "courseId"]]
        .merge(
            assignments[
                [
                    "assignmentId",
                    "courseId",
                    "assignmentTitle",
                    "dueDate",
                    "pointsPossible",
                ]
            ],
            on="courseId",
            how="inner",
        )
        .merge(
            submissions[["id", "studentId", "assignmentId", "submittedAt", "score"]],
            on=["studentId", "assignmentId"],
            how="left",
            suffixes=("", "_submission"),
        )
    )
    student_assignments["submitted"] = student_assignments["id"].notna()
    student_assignments["due"] = student_assignments["dueDate"] <= report_cutoff
    student_assignments["graded"] = student_assignments["submitted"] & student_assignments["score"].notna()

    grade_rows = student_assignments.loc[
        student_assignments["due"] | student_assignments["submitted"]
    ].copy()
    grade_rows["gradePossible"] = grade_rows["pointsPossible"].where(
        ~grade_rows["submitted"] | grade_rows["graded"], 0
    )
    grade_rows["gradeEarned"] = grade_rows["score"].clip(lower=0)
    grade_rows["gradeEarned"] = grade_rows[["gradeEarned", "pointsPossible"]].min(axis=1)
    grade_rows["gradeEarned"] = grade_rows["gradeEarned"].where(
        grade_rows["graded"], 0
    )
    grade_rows["missing"] = grade_rows["due"] & ~grade_rows["submitted"]

    grade_totals = (
        grade_rows.groupby(["studentId", "courseId"], as_index=False)
        .agg(
            earnedPoints=("gradeEarned", "sum"),
            possiblePoints=("gradePossible", "sum"),
            missingSubmissions=("missing", "sum"),
        )
    )
    grade_totals["gradePercent"] = (
        grade_totals["earnedPoints"] / grade_totals["possiblePoints"] * 100
    ).where(grade_totals["possiblePoints"] > 0)

    due_rows = student_assignments.loc[student_assignments["due"]].copy()
    completion_totals = (
        due_rows.groupby(["studentId", "courseId"], as_index=False)
        .agg(
            expectedAssignments=("assignmentId", "size"),
            completedAssignments=("submitted", "sum"),
        )
    )
    completion_totals["completionRate"] = (
        completion_totals["completedAssignments"]
        / completion_totals["expectedAssignments"]
        * 100
    )

    student_course = (
        data["enrollments"][["studentId", "courseId"]]
        .drop_duplicates()
        .merge(grade_totals, on=["studentId", "courseId"], how="left")
        .merge(completion_totals, on=["studentId", "courseId"], how="left")
        .merge(students[["studentId", "studentName"]], on="studentId", how="left")
        .merge(courses[["courseId", "courseCode", "courseTitle"]], on="courseId", how="left")
    )
    student_course["missingSubmissions"] = student_course["missingSubmissions"].fillna(0).astype(int)
    student_course["expectedAssignments"] = student_course["expectedAssignments"].fillna(0).astype(int)
    student_course["completedAssignments"] = student_course["completedAssignments"].fillna(0).astype(int)

    course_summary = _build_course_summary(student_course, thresholds)
    assignment_summary = _build_assignment_summary(due_rows, courses)
    interventions = _build_interventions(student_course, thresholds)
    cohorts = _build_cohort_summary(student_course, thresholds)

    week_start = report_cutoff.normalize() - timedelta(days=report_cutoff.weekday())
    week_end = report_cutoff.normalize()
    weekly_submissions = submissions.loc[
        (submissions["submittedAt"] >= week_start)
        & (submissions["submittedAt"] <= report_cutoff)
    ]
    findings = _build_findings(
        course_summary,
        assignment_summary,
        interventions,
        cohorts,
        submissions,
        assignments,
        week_start,
        report_cutoff,
        thresholds,
    )
    return ReportData(
        courses=course_summary,
        assignments=assignment_summary,
        interventions=interventions,
        cohorts=cohorts,
        findings=findings,
        week_start=week_start,
        week_end=week_end,
        weekly_submission_count=len(weekly_submissions),
    )


def _build_course_summary(
    student_course: pd.DataFrame, thresholds: ReportThresholds
) -> pd.DataFrame:
    """Summarize average grades, pass rates, and completion by course."""

    rows: list[dict[str, Any]] = []
    for (course_id, code, title), group in student_course.groupby(
        ["courseId", "courseCode", "courseTitle"], sort=True
    ):
        graded = group["gradePercent"].dropna()
        expected = int(group["expectedAssignments"].sum())
        completed = int(group["completedAssignments"].sum())
        rows.append(
            {
                "courseId": course_id,
                "courseCode": code,
                "courseTitle": title,
                "studentCount": int(group["studentId"].nunique()),
                "gradedStudentCount": int(graded.size),
                "passRate": _round_percent((graded >= thresholds.passing_grade_percent).mean() * 100)
                if not graded.empty
                else pd.NA,
                "averageGrade": _round_percent(graded.mean()) if not graded.empty else pd.NA,
                "completionRate": _round_percent(completed / expected * 100) if expected else pd.NA,
            }
        )
    return pd.DataFrame(rows)


def _build_assignment_summary(
    due_rows: pd.DataFrame, courses: pd.DataFrame
) -> pd.DataFrame:
    """Calculate completion rates for assignments due by the report date."""

    if due_rows.empty:
        return pd.DataFrame(
            columns=[
                "assignmentId",
                "assignmentTitle",
                "courseId",
                "courseCode",
                "courseTitle",
                "dueDate",
                "studentCount",
                "completedCount",
                "completionRate",
            ]
        )
    summary = (
        due_rows.groupby(
            ["assignmentId", "assignmentTitle", "courseId", "dueDate"], as_index=False
        )
        .agg(studentCount=("studentId", "nunique"), completedCount=("submitted", "sum"))
        .merge(courses[["courseId", "courseCode", "courseTitle"]], on="courseId", how="left")
    )
    summary["completionRate"] = (
        summary["completedCount"] / summary["studentCount"] * 100
    ).round(1)
    return summary.sort_values(["dueDate", "courseCode", "assignmentTitle"])


def _build_interventions(
    student_course: pd.DataFrame, thresholds: ReportThresholds
) -> pd.DataFrame:
    """Identify student-course records requiring a proactive staff response."""

    rows: list[dict[str, Any]] = []
    for row in student_course.itertuples(index=False):
        low_grade = pd.notna(row.gradePercent) and row.gradePercent < thresholds.intervention_grade_percent
        low_completion = (
            row.expectedAssignments > 0
            and row.completionRate < thresholds.intervention_completion_percent
        )
        has_missing_work = row.missingSubmissions > 0
        if not (low_grade or low_completion):
            continue

        reasons: list[str] = []
        if low_grade:
            reasons.append(
                f"grade is {row.gradePercent:.1f}%, below the "
                f"{thresholds.intervention_grade_percent:.0f}% threshold"
            )
        if low_completion:
            reasons.append(
                f"completion is {row.completionRate:.1f}%, below the "
                f"{thresholds.intervention_completion_percent:.0f}% threshold"
            )
        if has_missing_work:
            reasons.append(
                f"{row.missingSubmissions} overdue "
                f"{'submission' if row.missingSubmissions == 1 else 'submissions'}"
            )

        if has_missing_work:
            action = "Contact the student and agree on a dated completion plan; offer office hours."
        elif low_grade:
            action = "Schedule a check-in and connect the student with tutoring or targeted review."
        else:
            action = "Help the student plan smaller weekly work blocks before the next deadline."
        rows.append(
            {
                "studentId": row.studentId,
                "studentName": row.studentName,
                "courseId": row.courseId,
                "courseCode": row.courseCode,
                "courseTitle": row.courseTitle,
                "gradePercent": _round_percent(row.gradePercent),
                "completionRate": _round_percent(row.completionRate),
                "missingSubmissions": int(row.missingSubmissions),
                "reason": "; ".join(reasons).capitalize() + ".",
                "suggestedAction": action,
            }
        )
    return pd.DataFrame(rows)


def _build_cohort_summary(
    student_course: pd.DataFrame, thresholds: ReportThresholds
) -> pd.DataFrame:
    """Compare performance across completion-based engagement groups."""

    student_totals = (
        student_course.groupby("studentId", as_index=False)
        .agg(
            studentName=("studentName", "first"),
            earnedPoints=("earnedPoints", "sum"),
            possiblePoints=("possiblePoints", "sum"),
            expectedAssignments=("expectedAssignments", "sum"),
            completedAssignments=("completedAssignments", "sum"),
        )
    )
    student_totals = student_totals.loc[student_totals["expectedAssignments"] > 0].copy()
    if student_totals.empty:
        return pd.DataFrame(
            columns=["groupName", "studentCount", "passRate", "averageGrade", "completionRate"]
        )
    student_totals["completionRate"] = (
        student_totals["completedAssignments"] / student_totals["expectedAssignments"] * 100
    )
    student_totals["gradePercent"] = (
        student_totals["earnedPoints"] / student_totals["possiblePoints"] * 100
    ).where(student_totals["possiblePoints"] > 0)
    student_totals["groupName"] = student_totals["completionRate"].map(
        lambda value: _engagement_group(value, thresholds)
    )

    order = ["High engagement", "Moderate engagement", "Low engagement"]
    rows: list[dict[str, Any]] = []
    for group_name in order:
        group = student_totals.loc[student_totals["groupName"] == group_name]
        if group.empty:
            continue
        grades = group["gradePercent"].dropna()
        rows.append(
            {
                "groupName": group_name,
                "studentCount": int(group["studentId"].nunique()),
                "passRate": _round_percent((grades >= thresholds.passing_grade_percent).mean() * 100)
                if not grades.empty
                else pd.NA,
                "averageGrade": _round_percent(grades.mean()) if not grades.empty else pd.NA,
                "completionRate": _round_percent(
                    group["completedAssignments"].sum()
                    / group["expectedAssignments"].sum()
                    * 100
                ),
            }
        )
    return pd.DataFrame(rows)


def _build_findings(
    course_summary: pd.DataFrame,
    assignment_summary: pd.DataFrame,
    interventions: pd.DataFrame,
    cohorts: pd.DataFrame,
    submissions: pd.DataFrame,
    assignments: pd.DataFrame,
    week_start: pd.Timestamp,
    report_cutoff: pd.Timestamp,
    thresholds: ReportThresholds,
) -> list[str]:
    """Turn notable performance and activity patterns into administrator-readable findings."""

    findings: list[str] = []
    scored_courses = course_summary.dropna(subset=["averageGrade"])
    if not scored_courses.empty:
        lowest = scored_courses.sort_values("averageGrade").iloc[0]
        findings.append(
            f"{lowest.courseCode} has the lowest average current grade at "
            f"{lowest.averageGrade:.1f}% and a {lowest.passRate:.1f}% pass rate."
        )

    low_completion = assignment_summary.loc[
        assignment_summary["completionRate"] < thresholds.low_assignment_completion_percent
    ]
    if not low_completion.empty:
        worst = low_completion.sort_values("completionRate").iloc[0]
        findings.append(
            f"{len(low_completion)} due assignment(s) are below the "
            f"{thresholds.low_assignment_completion_percent:.0f}% completion alert; "
            f"the lowest is {worst.courseCode} — {worst.assignmentTitle} at "
            f"{worst.completionRate:.1f}%."
        )

    if not interventions.empty:
        findings.append(
            f"{interventions['studentId'].nunique()} student(s) have at least one "
            f"course-level intervention flag across {len(interventions)} enrollment(s)."
        )

    if len(cohorts) >= 2:
        highest = cohorts.sort_values("completionRate", ascending=False).iloc[0]
        lowest = cohorts.sort_values("completionRate").iloc[0]
        if pd.notna(highest.averageGrade) and pd.notna(lowest.averageGrade):
            gap = highest.averageGrade - lowest.averageGrade
            if abs(gap) >= thresholds.meaningful_score_gap_percent:
                findings.append(
                    f"The {highest.groupName.lower()} group averages {highest.averageGrade:.1f}%, "
                    f"{abs(gap):.1f} points {'above' if gap >= 0 else 'below'} the "
                    f"{lowest.groupName.lower()} group."
                )

    graded = submissions.loc[submissions["score"].notna()].merge(
        assignments[["assignmentId", "dueDate", "pointsPossible"]],
        on="assignmentId",
        how="inner",
    )
    if not graded.empty:
        graded["normalizedScore"] = (
            graded["score"].clip(lower=0) / graded["pointsPossible"] * 100
        ).clip(upper=100)
        graded["timing"] = graded.apply(
            lambda row: "On time" if row.submittedAt <= row.dueDate else "Late", axis=1
        )
        timing_scores = graded.groupby("timing")["normalizedScore"].mean()
        if {"On time", "Late"}.issubset(timing_scores.index):
            gap = timing_scores["On time"] - timing_scores["Late"]
            if abs(gap) >= thresholds.meaningful_score_gap_percent:
                findings.append(
                    f"On-time submissions average {timing_scores['On time']:.1f}% versus "
                    f"{timing_scores['Late']:.1f}% for late work, a {abs(gap):.1f}-point gap."
                )

    previous_start = week_start - timedelta(days=7)
    previous_end = previous_start + (report_cutoff - week_start)
    current_count = len(
        submissions.loc[
            (submissions["submittedAt"] >= week_start)
            & (submissions["submittedAt"] <= report_cutoff)
        ]
    )
    previous_count = len(
        submissions.loc[
            (submissions["submittedAt"] >= previous_start)
            & (submissions["submittedAt"] <= previous_end)
        ]
    )
    if previous_count > 0:
        change = (current_count - previous_count) / previous_count * 100
        if abs(change) >= thresholds.meaningful_weekly_change_percent:
            direction = "increased" if change > 0 else "decreased"
            findings.append(
                f"Submission volume {direction} {abs(change):.1f}% from the prior week "
                f"({previous_count} to {current_count})."
            )
    elif current_count > 0:
        findings.append(f"{current_count} submissions were recorded this week; the prior week had none.")

    return findings or ["No material performance or engagement changes crossed the configured alert thresholds."]


def build_csv_rows(report: ReportData) -> pd.DataFrame:
    """Convert report sections into one consistently structured CSV table."""

    week_start = report.week_start.date().isoformat()
    week_end = report.week_end.date().isoformat()
    rows: list[dict[str, Any]] = []

    def add_row(section: str, **values: Any) -> None:
        row = {column: "" for column in REPORT_COLUMNS}
        row.update(
            {
                "report_week_start": week_start,
                "report_week_end": week_end,
                "section": section,
                **values,
            }
        )
        rows.append(row)

    for row in report.courses.itertuples(index=False):
        add_row(
            "course_summary",
            course_code=row.courseCode,
            course_title=row.courseTitle,
            entity_id=row.courseId,
            entity_name=row.courseTitle,
            student_count=row.studentCount,
            pass_rate_percent=row.passRate,
            average_grade_percent=row.averageGrade,
            completion_rate_percent=row.completionRate,
        )

    for row in report.assignments.itertuples(index=False):
        add_row(
            "assignment_completion",
            course_code=row.courseCode,
            course_title=row.courseTitle,
            entity_id=row.assignmentId,
            entity_name=row.assignmentTitle,
            student_count=row.studentCount,
            completion_rate_percent=row.completionRate,
            finding=f"Due {row.dueDate:%Y-%m-%d}; {row.completedCount} of {row.studentCount} submitted.",
        )

    for row in report.interventions.itertuples(index=False):
        add_row(
            "intervention",
            course_code=row.courseCode,
            course_title=row.courseTitle,
            entity_id=row.studentId,
            entity_name=row.studentName,
            student_id=row.studentId,
            student_name=row.studentName,
            average_grade_percent=row.gradePercent,
            completion_rate_percent=row.completionRate,
            missing_submissions=row.missingSubmissions,
            reason=row.reason,
            suggested_action=row.suggestedAction,
        )

    for row in report.cohorts.itertuples(index=False):
        add_row(
            "cohort_comparison",
            entity_name=row.groupName,
            group_name=row.groupName,
            student_count=row.studentCount,
            pass_rate_percent=row.passRate,
            average_grade_percent=row.averageGrade,
            completion_rate_percent=row.completionRate,
        )

    for index, finding in enumerate(report.findings, start=1):
        add_row(
            "administrator_finding",
            entity_id=f"finding-{index}",
            entity_name=f"Finding {index}",
            finding=finding,
        )

    return pd.DataFrame(rows, columns=REPORT_COLUMNS)


def write_report_csv(report_frame: pd.DataFrame, reports_dir: Path) -> Path:
    """Write the report to a timestamped UTF-8 CSV and return its path."""

    reports_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().astimezone().strftime("%Y%m%d_%H%M%S")
    output_path = reports_dir / f"weekly_report_{timestamp}.csv"
    report_frame.to_csv(output_path, index=False, encoding="utf-8")
    return output_path


def print_summary(report: ReportData, output_path: Path) -> None:
    """Print the week's key findings in a concise, readable format."""

    divider = "=" * 72
    print(divider)
    print("CANVAS LITE — WEEKLY ADMINISTRATIVE REPORT")
    print(f"Reporting week: {report.week_start:%b %d, %Y} – {report.week_end:%b %d, %Y}")
    print(f"Submissions recorded this week: {report.weekly_submission_count}")
    print(divider)
    print("\nKEY FINDINGS")
    for finding in report.findings:
        print(f"  • {finding}")

    print("\nCOURSE PERFORMANCE")
    if report.courses.empty:
        print("  No graded course activity is available through the report date.")
    else:
        for row in report.courses.itertuples(index=False):
            average = _display_percent(row.averageGrade)
            pass_rate = _display_percent(row.passRate)
            completion = _display_percent(row.completionRate)
            print(
                f"  {row.courseCode}: average {average} | pass rate {pass_rate} | "
                f"completion {completion}"
            )

    print("\nINTERVENTION SUMMARY")
    if report.interventions.empty:
        print("  No students currently cross an intervention threshold.")
    else:
        unique_students = report.interventions["studentId"].nunique()
        print(
            f"  {unique_students} student(s) flagged across "
            f"{len(report.interventions)} course enrollment(s)."
        )
        for row in report.interventions.head(8).itertuples(index=False):
            print(f"  • {row.studentName} ({row.courseCode}): {row.reason}")
        if len(report.interventions) > 8:
            print(f"  … and {len(report.interventions) - 8} more row(s) in the CSV.")

    print("\nENGAGEMENT GROUP COMPARISON")
    if report.cohorts.empty:
        print("  No engagement groups can be calculated yet.")
    else:
        for row in report.cohorts.itertuples(index=False):
            print(
                f"  {row.groupName}: {row.studentCount} student(s) | "
                f"average {_display_percent(row.averageGrade)} | "
                f"completion {_display_percent(row.completionRate)}"
            )

    print(f"\nCSV written to: {output_path}")


def _engagement_group(completion_rate: float, thresholds: ReportThresholds) -> str:
    """Return the configured completion-based engagement group label."""

    if completion_rate >= thresholds.high_engagement_percent:
        return "High engagement"
    if completion_rate >= thresholds.moderate_engagement_percent:
        return "Moderate engagement"
    return "Low engagement"


def _round_percent(value: Any) -> Any:
    """Round a numeric percentage while preserving missing pandas values."""

    return round(float(value), 1) if pd.notna(value) else pd.NA


def _display_percent(value: Any) -> str:
    """Format an optional percentage for console output."""

    return f"{float(value):.1f}%" if pd.notna(value) else "not available"


def main() -> int:
    """Load LMS data, generate the report, and print an administrative summary."""

    args = parse_args()
    try:
        as_of = pd.Timestamp(args.as_of).normalize() if args.as_of else pd.Timestamp.now().normalize()
        data = load_lms_data(args.data_dir.resolve())
        report = calculate_report(data, as_of)
        report_frame = build_csv_rows(report)
        output_path = write_report_csv(report_frame, args.reports_dir.resolve())
        print_summary(report, output_path)
    except (FileNotFoundError, ValueError, OSError) as error:
        print(f"Report could not be generated: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
