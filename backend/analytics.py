"""Course analytics for the instructor workspace."""
import math

from .study_plan import instant

COHORTS = ('High engagement', 'Moderate engagement', 'Low engagement')
LETTERS = ('A', 'B', 'C', 'D', 'F')


def rounded(value):
    # JavaScript Math.round for the non-negative values used in these metrics.
    return math.floor(value * 10 + 0.5) / 10


def average(values):
    return rounded(sum(values) / len(values)) if values else None


def percent(part, whole):
    return rounded(part / whole * 100) if whole else 0


def course_analytics(data):
    course_id, filters = data['courseId'], data['filters']
    as_of = instant(data['asOf'])
    start = instant(filters['dateFrom'] + 'T00:00:00') if filters['dateFrom'] else None
    end = instant(filters['dateTo'] + 'T23:59:59.999') if filters['dateTo'] else None
    assignments = sorted((a for a in data['assignments'] if a['courseId'] == course_id
                          and (not filters['assignmentId'] or a['id'] == filters['assignmentId'])
                          and (start is None or instant(a['dueDate']) >= start)
                          and (end is None or instant(a['dueDate']) <= end)),
                         key=lambda a: instant(a['dueDate']))
    assignment_by_id = {a['id']: a for a in assignments}
    student_ids = list(dict.fromkeys(e['studentId'] for e in data['enrollments'] if e['courseId'] == course_id))
    submissions = [s for s in data['submissions'] if s['assignmentId'] in assignment_by_id
                   and s['studentId'] in student_ids and instant(s['submittedAt']) <= as_of]
    due = [a for a in assignments if instant(a['dueDate']) <= as_of]
    due_ids = {a['id'] for a in due}

    def scores(items):
        return [max(0, min(100, s['score'] / assignment_by_id[s['assignmentId']]['pointsPossible'] * 100))
                for s in items if s['score'] is not None and assignment_by_id[s['assignmentId']]['pointsPossible']]

    def is_late(submission):
        return instant(submission['submittedAt']) > instant(assignment_by_id[submission['assignmentId']]['dueDate'])

    students = []
    for student_id in student_ids:
        items = [s for s in submissions if s['studentId'] == student_id]
        completed = len({s['assignmentId'] for s in items if s['assignmentId'] in due_ids})
        earned, possible = 0, 0
        for assignment in assignments:
            submission = next((s for s in items if s['assignmentId'] == assignment['id']), None)
            if not submission and instant(assignment['dueDate']) > as_of:
                continue
            if submission and submission['score'] is None:
                continue
            points = assignment['pointsPossible']
            possible += points
            earned += max(0, min(submission['score'] if submission else 0, points))
        grade = earned / possible * 100 if possible else None
        letter = None if grade is None else ('A' if grade >= 90 else 'B' if grade >= 80 else 'C' if grade >= 70 else 'D' if grade >= 60 else 'F')
        completion = completed / len(due) * 100 if due else 0
        cohort = COHORTS[0 if completion >= 80 else 1 if completion >= 50 else 2] if due else ''
        students.append({'id': student_id, 'completed': completed, 'scores': scores(items), 'grade': grade,
                         'letter': letter, 'cohort': cohort})
    grades = [s['grade'] for s in students if s['grade'] is not None]
    days = sorted({instant(s['submittedAt']).date().isoformat() for s in submissions})

    metrics = []
    for assignment in assignments:
        items = [s for s in submissions if s['assignmentId'] == assignment['id']]
        metrics.append({'assignmentId': assignment['id'], 'assignment': assignment['title'],
                        'completionRate': percent(len({s['studentId'] for s in items}), len(student_ids)),
                        'averageScore': average(scores(items))})
    timeline = []
    for day in days:
        items = [s for s in submissions if instant(s['submittedAt']).date().isoformat() == day]
        timeline.append({'date': day, 'submissions': len(items),
                         'activeStudents': len({s['studentId'] for s in items})})
    cohorts = []
    for cohort in COHORTS:
        members = [s for s in students if s['cohort'] == cohort]
        if members:
            cohorts.append({'cohort': cohort, 'students': len(members),
                            'completionRate': percent(sum(m['completed'] for m in members), len(members) * len(due)),
                            'averageScore': average([score for m in members for score in m['scores']])})
    profiles = {profile['id']: profile for profile in data.get('demographics', [])}
    history = [item for student_id in student_ids for item in profiles.get(student_id, {}).get('history', [])]
    groups = []
    for field in ('genderIdentity', 'ethnicity', 'race'):
        values = {profile.get(field, '') for profile in profiles.values()} - {'', 'prefer-not-to-answer'}
        for value in sorted(values):
            members = [student for student in students
                       if profiles.get(student['id'], {}).get(field) == value]
            if members:
                flagged = sum((student['grade'] is not None and student['grade'] < 70)
                              or (bool(due) and student['completed'] / len(due) < .8)
                              for student in members)
                groups.append({'category': field, 'group': value, 'supportRate': percent(flagged, len(members))})
    alumni = [person for person in data.get('alumni', []) if person.get('outcome') and person.get('history')]
    alumni_profiles = {person['name'].split()[0]: person for person in alumni}
    outcome_groups = []
    for group in sorted({person.get('race', '') for person in alumni} - {''}):
        members = [person for person in alumni if alumni_profiles[person['name'].split()[0]].get('race') == group]
        flagged = [person for person in members if person['history'][0]['supportFlag']]
        not_flagged = [person for person in members if not person['history'][0]['supportFlag']]
        outcome_groups.append({
            'group': group,
            'flaggedCompleted': percent(sum(person['outcome']['completion'] == 'Graduated' for person in flagged), len(flagged)) if flagged else None,
            'unflaggedNotCompleted': percent(sum(person['outcome']['completion'] != 'Graduated' for person in not_flagged), len(not_flagged)) if not_flagged else None,
        })
    return {
        'overallAverage': average(grades),
        'overallCompletion': percent(sum(s['assignmentId'] in due_ids for s in submissions), len(student_ids) * len(due)) if due and student_ids else None,
        'totalSubmissions': len(submissions), 'gradedSubmissions': len(scores(submissions)),
        'onTimeAverage': average(scores([s for s in submissions if not is_late(s)])),
        'lateAverage': average(scores([s for s in submissions if is_late(s)])),
        'gradeDistribution': [{'grade': letter, 'students': sum(s['letter'] == letter for s in students)} for letter in LETTERS],
        'assignmentMetrics': metrics, 'engagementTimeline': timeline, 'cohorts': cohorts,
        'demographicGroups': groups,
        'outcomes': {'students': len(alumni),
                     'completed': sum(person['outcome']['completion'] == 'Graduated' for person in alumni),
                     'employed': sum(person['outcome']['followUp'] == 'Employed' for person in alumni),
                     'groups': outcome_groups,
                     'records': [{'id': person['id'], 'name': person['name'], 'race': person.get('race', ''),
                                  'flagged': person['history'][0]['supportFlag'], **person['outcome']} for person in alumni]},
        'history': {'courses': len(history), 'flagged': sum(item['supportFlag'] for item in history),
                    'passing': sum(item['finalScore'] >= 70 for item in history),
                    'below70': sum(item['finalScore'] < 70 for item in history),
                    'flaggedPassing': sum(item['supportFlag'] and item['finalScore'] >= 70 for item in history),
                    'unflaggedBelow70': sum(not item['supportFlag'] and item['finalScore'] < 70 for item in history)},
    }
