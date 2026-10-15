#!/usr/bin/env python3
"""Weekly admin report: seed JSON → per-student totals → report sections → CSV. No dependencies.

Run: python scripts/weekly_report.py --as-of 2026-08-15
"""

import argparse
import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path

# Thresholds (percent, 0–100).
PASSING_GRADE = 70
INTERVENTION_GRADE = 70
INTERVENTION_COMPLETION = 70
HIGH_ENGAGEMENT = 80
MODERATE_ENGAGEMENT = 50
LOW_ASSIGNMENT_COMPLETION = 75
MEANINGFUL_SCORE_GAP = 5
MEANINGFUL_WEEKLY_CHANGE = 20

COHORTS = ["High engagement", "Moderate engagement", "Low engagement"]
REPORT_COLUMNS = [
    "report_week_start", "report_week_end", "section", "course_code", "course_title",
    "entity_id", "entity_name", "student_id", "student_name", "group_name",
    "student_count", "pass_rate_percent", "average_grade_percent",
    "completion_rate_percent", "missing_submissions", "reason", "suggested_action", "finding",
]


@dataclass
class Report:
    courses: list
    assignments: list
    interventions: list
    cohorts: list
    findings: list
    week_start: datetime
    week_end: datetime
    weekly_submission_count: int = 0


def percent(part, whole):
    return part / whole * 100 if whole else None


def rounded(value):
    return None if value is None else round(value, 1)


def average(values):
    return sum(values) / len(values) if values else None


def load_lms_data(data_dir):
    """Read the five seed files, check required fields, and parse dates and scores."""
    required = {
        "students": {"id", "name", "email"},
        "courses": {"id", "code", "title", "instructorId"},
        "enrollments": {"id", "studentId", "courseId"},
        "assignments": {"id", "courseId", "title", "dueDate", "pointsPossible"},
        "submissions": {"id", "assignmentId", "studentId", "submittedAt", "score"},
    }
    data = {}
    for name, fields in required.items():
        rows = json.loads((data_dir / f"{name}.json").read_text(encoding="utf-8"))
        if not isinstance(rows, list) or any(not isinstance(r, dict) or not fields <= r.keys() for r in rows):
            raise ValueError(f"{name}.json must contain records with: {', '.join(sorted(fields))}")
        data[name] = rows
    for a in data["assignments"]:
        a["dueDate"] = datetime.fromisoformat(a["dueDate"])
    for s in data["submissions"]:
        s["submittedAt"] = datetime.fromisoformat(s["submittedAt"])
        try:
            s["score"] = float(s["score"])
        except (TypeError, ValueError):
            s["score"] = None  # not graded yet
    return data


def summarize(rows):
    """Pass rate, average grade, and completion for a group of student rows."""
    grades = [r["gradePercent"] for r in rows if r["gradePercent"] is not None]
    return {
        "studentCount": len(rows),
        "passRate": rounded(percent(sum(g >= PASSING_GRADE for g in grades), len(grades))),
        "averageGrade": rounded(average(grades)),
        "completionRate": rounded(percent(sum(r["completed"] for r in rows), sum(r["expected"] for r in rows))),
    }


def calculate_report(data, as_of):
    cutoff = datetime.combine(as_of.date(), time.max)
    week_end = datetime.combine(as_of.date(), time.min)
    week_start = week_end - timedelta(days=week_end.weekday())
    students = {r["id"]: r for r in data["students"]}
    courses = {r["id"]: r for r in data["courses"]}
    assignments = {r["id"]: r for r in data["assignments"]}
    instructor_ids = {c["instructorId"] for c in courses.values()}
    enrollments = list(dict.fromkeys((r["studentId"], r["courseId"]) for r in data["enrollments"]
                                    if r["studentId"] not in instructor_ids))

    # Latest submission per (student, assignment), up to the cutoff.
    latest = {}
    for s in sorted(data["submissions"], key=lambda s: s["submittedAt"]):
        a = assignments.get(s["assignmentId"])
        if a and (s["studentId"], a["courseId"]) in enrollments and s["submittedAt"] <= cutoff:
            latest[s["studentId"], s["assignmentId"]] = s

    # One row per enrollment. Overdue missing work scores zero; ungraded work is left out.
    rows = []
    for student_id, course_id in enrollments:
        course = courses[course_id]
        row = {"studentId": student_id, "studentName": students[student_id]["name"], "courseId": course_id,
               "courseCode": course["code"], "courseTitle": course["title"],
               "earned": 0, "possible": 0, "missing": 0, "expected": 0, "completed": 0}
        for a in data["assignments"]:
            if a["courseId"] != course_id:
                continue
            s = latest.get((student_id, a["id"]))
            due = a["dueDate"] <= cutoff
            row["expected"] += due
            row["completed"] += due and s is not None
            row["missing"] += due and s is None
            if (due and s is None) or (s and s["score"] is not None):
                row["possible"] += a["pointsPossible"]
                row["earned"] += max(0, min(s["score"], a["pointsPossible"])) if s else 0
        row["gradePercent"] = percent(row["earned"], row["possible"])
        row["completionRate"] = percent(row["completed"], row["expected"])
        rows.append(row)

    course_summary = [
        {"courseId": cid, "courseCode": c["code"], "courseTitle": c["title"], **summarize(group)}
        for cid, c in sorted(courses.items())
        if (group := [r for r in rows if r["courseId"] == cid])
    ]

    assignment_summary = []
    for a in data["assignments"]:
        enrolled = [sid for sid, cid in enrollments if cid == a["courseId"]]
        if a["dueDate"] > cutoff or not enrolled:
            continue
        done = sum((sid, a["id"]) in latest for sid in enrolled)
        course = courses[a["courseId"]]
        assignment_summary.append({
            "assignmentId": a["id"], "assignmentTitle": a["title"], "courseCode": course["code"],
            "courseTitle": course["title"], "dueDate": a["dueDate"], "studentCount": len(enrolled),
            "completedCount": done, "completionRate": rounded(percent(done, len(enrolled))),
        })
    assignment_summary.sort(key=lambda r: (r["dueDate"], r["courseCode"], r["assignmentTitle"]))

    interventions = [flag for r in rows if (flag := intervention(r))]

    # Cohorts use each student's totals across all of their courses.
    totals = defaultdict(lambda: {"earned": 0, "possible": 0, "expected": 0, "completed": 0})
    for r in rows:
        for key in totals[r["studentId"]]:
            totals[r["studentId"]][key] += r[key]
    groups = defaultdict(list)
    for t in totals.values():
        if t["expected"]:
            t["gradePercent"] = percent(t["earned"], t["possible"])
            completion = percent(t["completed"], t["expected"])
            index = 0 if completion >= HIGH_ENGAGEMENT else 1 if completion >= MODERATE_ENGAGEMENT else 2
            groups[COHORTS[index]].append(t)
    cohorts = [{"groupName": name, **summarize(groups[name])} for name in COHORTS if groups[name]]

    report = Report(course_summary, assignment_summary, interventions, cohorts, [], week_start, week_end)
    report.findings = build_findings(report, list(latest.values()), assignments, cutoff)
    report.weekly_submission_count = sum(week_start <= s["submittedAt"] <= cutoff for s in latest.values())
    return report


def intervention(row):
    """An intervention flag for a low grade or low completion, or None."""
    grade, completion, missing = row["gradePercent"], row["completionRate"], row["missing"]
    low_grade = grade is not None and grade < INTERVENTION_GRADE
    reasons = []
    if low_grade:
        reasons.append(f"grade is {grade:.1f}%, below the {INTERVENTION_GRADE:.0f}% threshold")
    if completion is not None and completion < INTERVENTION_COMPLETION:
        reasons.append(f"completion is {completion:.1f}%, below the {INTERVENTION_COMPLETION:.0f}% threshold")
    if not reasons:
        return None
    if missing:
        reasons.append(f"{missing} overdue {'submission' if missing == 1 else 'submissions'}")
        action = "Contact the student and agree on a dated completion plan; offer office hours."
    elif low_grade:
        action = "Schedule a check-in and connect the student with tutoring or targeted review."
    else:
        action = "Help the student plan smaller weekly work blocks before the next deadline."
    return {**row, "reason": "; ".join(reasons).capitalize() + ".", "suggestedAction": action}


def build_findings(report, submissions, assignments, cutoff):
    """Plain-language alerts for anything that crosses a threshold."""
    findings = []
    scored = [r for r in report.courses if r["averageGrade"] is not None]
    if scored:
        low = min(scored, key=lambda r: r["averageGrade"])
        findings.append(f"{low['courseCode']} has the lowest average current grade at {low['averageGrade']:.1f}% and a {low['passRate']:.1f}% pass rate.")

    incomplete = [r for r in report.assignments if r["completionRate"] < LOW_ASSIGNMENT_COMPLETION]
    if incomplete:
        worst = min(incomplete, key=lambda r: r["completionRate"])
        findings.append(f"{len(incomplete)} due assignment(s) are below the {LOW_ASSIGNMENT_COMPLETION:.0f}% completion alert; the lowest is {worst['courseCode']} — {worst['assignmentTitle']} at {worst['completionRate']:.1f}%.")

    if report.interventions:
        count = len({r["studentId"] for r in report.interventions})
        findings.append(f"{count} student(s) have at least one course-level intervention flag across {len(report.interventions)} enrollment(s).")

    if len(report.cohorts) >= 2:
        high = max(report.cohorts, key=lambda r: r["completionRate"])
        low = min(report.cohorts, key=lambda r: r["completionRate"])
        if high["averageGrade"] is not None and low["averageGrade"] is not None:
            gap = high["averageGrade"] - low["averageGrade"]
            if abs(gap) >= MEANINGFUL_SCORE_GAP:
                findings.append(f"The {high['groupName'].lower()} group averages {high['averageGrade']:.1f}%, {abs(gap):.1f} points {'above' if gap >= 0 else 'below'} the {low['groupName'].lower()} group.")

    timing = {"on_time": [], "late": []}
    for s in submissions:
        a = assignments.get(s["assignmentId"])
        if a and s["score"] is not None and a["pointsPossible"] > 0:
            key = "on_time" if s["submittedAt"] <= a["dueDate"] else "late"
            timing[key].append(max(0, min(100, s["score"] / a["pointsPossible"] * 100)))
    if timing["on_time"] and timing["late"]:
        on_time, late = average(timing["on_time"]), average(timing["late"])
        if abs(on_time - late) >= MEANINGFUL_SCORE_GAP:
            findings.append(f"On-time submissions average {on_time:.1f}% versus {late:.1f}% for late work, a {abs(on_time - late):.1f}-point gap.")

    week = timedelta(days=7)
    current = sum(report.week_start <= s["submittedAt"] <= cutoff for s in submissions)
    previous = sum(report.week_start - week <= s["submittedAt"] <= cutoff - week for s in submissions)
    if previous:
        change = (current - previous) / previous * 100
        if abs(change) >= MEANINGFUL_WEEKLY_CHANGE:
            findings.append(f"Submission volume {'increased' if change > 0 else 'decreased'} {abs(change):.1f}% from the prior week ({previous} to {current}).")
    elif current:
        findings.append(f"{current} submissions were recorded this week; the prior week had none.")
    return findings or ["No material performance or engagement changes crossed the configured alert thresholds."]


def build_csv_rows(report):
    """Flatten every report section into rows that share REPORT_COLUMNS."""
    rows = []

    def add(section, **values):
        row = dict.fromkeys(REPORT_COLUMNS, "")
        row.update(report_week_start=report.week_start.date().isoformat(),
                   report_week_end=report.week_end.date().isoformat(), section=section)
        row.update({k: "" if v is None else v for k, v in values.items()})
        rows.append(row)

    for r in report.courses:
        add("course_summary", course_code=r["courseCode"], course_title=r["courseTitle"],
            entity_id=r["courseId"], entity_name=r["courseTitle"], student_count=r["studentCount"],
            pass_rate_percent=r["passRate"], average_grade_percent=r["averageGrade"], completion_rate_percent=r["completionRate"])
    for r in report.assignments:
        add("assignment_completion", course_code=r["courseCode"], course_title=r["courseTitle"],
            entity_id=r["assignmentId"], entity_name=r["assignmentTitle"], student_count=r["studentCount"],
            completion_rate_percent=r["completionRate"],
            finding=f"Due {r['dueDate']:%Y-%m-%d}; {r['completedCount']} of {r['studentCount']} submitted.")
    for r in report.interventions:
        add("intervention", course_code=r["courseCode"], course_title=r["courseTitle"],
            entity_id=r["studentId"], entity_name=r["studentName"], student_id=r["studentId"], student_name=r["studentName"],
            average_grade_percent=rounded(r["gradePercent"]), completion_rate_percent=rounded(r["completionRate"]),
            missing_submissions=r["missing"], reason=r["reason"], suggested_action=r["suggestedAction"])
    for r in report.cohorts:
        add("cohort_comparison", entity_name=r["groupName"], group_name=r["groupName"], student_count=r["studentCount"],
            pass_rate_percent=r["passRate"], average_grade_percent=r["averageGrade"], completion_rate_percent=r["completionRate"])
    for i, finding in enumerate(report.findings, 1):
        add("administrator_finding", entity_id=f"finding-{i}", entity_name=f"Finding {i}", finding=finding)
    return rows


def write_report_csv(rows, reports_dir):
    reports_dir.mkdir(parents=True, exist_ok=True)
    output = reports_dir / f"weekly_report_{datetime.now():%Y%m%d_%H%M%S_%f}.csv"
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=REPORT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    return output


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", help="Last included date (YYYY-MM-DD); defaults to today.")
    parser.add_argument("--data-dir", type=Path, default=root / "src" / "data")
    parser.add_argument("--reports-dir", type=Path, default=root / "reports")
    args = parser.parse_args()
    try:
        as_of = datetime.strptime(args.as_of or "2026-08-15", "%Y-%m-%d")
        report = calculate_report(load_lms_data(args.data_dir), as_of)
        output = write_report_csv(build_csv_rows(report), args.reports_dir)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Report could not be generated: {error}")
        return 1
    print(f"Weekly report {report.week_start:%b %d} – {report.week_end:%b %d, %Y}: "
          f"{report.weekly_submission_count} submissions this week.")
    for finding in report.findings:
        print(f"  • {finding}")
    print(f"CSV written to: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
