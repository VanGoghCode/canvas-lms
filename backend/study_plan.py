"""Study-plan rules. The browser supplies current local coursework; nothing is stored here."""
import json
from datetime import datetime, timezone
from pathlib import Path

RESOURCES = json.loads((Path(__file__).resolve().parent.parent / 'src/data/resources.json').read_text(encoding='utf-8'))
DIFFICULTIES = {'struggling': ['remedial', 'core'], 'developing': ['core'], 'thriving': ['advanced', 'enrichment']}
TOPICS = [
    ('foundations', ['foundation', 'checkpoint', 'fundamental']),
    ('practice', ['practice', 'exercise', 'drill']),
    ('project', ['project', 'prototype', 'build']),
    ('analysis', ['analysis', 'analyze', 'reflection', 'evaluate']),
    ('application', ['applied', 'application', 'challenge']),
    ('synthesis', ['synthesis', 'final', 'integrate']),
]


def instant(value):
    date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)


def study_plan(data):
    student_id = data['studentId']
    courses = data['courses']
    enrollments = data['enrollments']
    assignments = data['assignments']
    submissions = data['submissions']
    grades = data['grades']
    as_of = instant(data['asOf'])
    course_ids = list(dict.fromkeys(e['courseId'] for e in enrollments if e['studentId'] == student_id))

    def submission(assignment):
        return next((s for s in submissions if s['assignmentId'] == assignment['id'] and s['studentId'] == student_id), None)

    performances = []
    for course in courses:
        if course['id'] not in course_ids:
            continue
        grade = grades[course['id']]
        own = [a for a in assignments if a['courseId'] == course['id']]
        missing = next((a for a in own if instant(a['dueDate']) <= as_of and not submission(a)), None)
        scored = [a for a in own if submission(a) and submission(a)['score'] is not None]
        scored.sort(key=lambda a: submission(a)['score'] / a['pointsPossible'] if a['pointsPossible'] else float('inf'))
        weakest = missing or (scored[0] if scored else (own[0] if own else None))
        text = (weakest['title'] + ' ' + weakest['description']).lower() if weakest else ''
        topic = next((topic for topic, words in TOPICS if any(word in text for word in words)), 'foundations')
        percentage = grade['rawPercentage'] if grade['rawPercentage'] is not None else 80
        band = 'struggling' if percentage < 70 else 'thriving' if percentage >= 90 else 'developing'
        performances.append({'course': course, 'band': band, 'topic': topic,
                             'missing': grade['missingAssignments'] > 0, 'hasGrade': grade['percentage'] is not None})

    recommendations = []
    if not performances:
        recommendations = [{**r, 'courseCode': 'All courses',
                            'reason': 'Build a useful learning routine while your course activity gets underway.'}
                           for r in RESOURCES if '*' in r['courseIds']][:3]
    else:
        ranked = []
        for resource in RESOURCES:
            matches = []
            for performance in performances:
                course = performance['course']
                if (course['id'] not in resource['courseIds'] and '*' not in resource['courseIds']) or resource['difficulty'] not in DIFFICULTIES[performance['band']]:
                    continue
                score = 8 if course['id'] in resource['courseIds'] else 2
                score += 5 if performance['topic'] in resource['topics'] else 0
                score += 4 if performance['band'] == 'struggling' and 'study-skills' in resource['topics'] else 0
                score += 5 if performance['missing'] and resource['id'] == 'study-plan-reset' else 0
                matches.append((score, course['id'], performance))
            if not matches:
                continue
            matches.sort(key=lambda item: (-item[0], item[1]))
            score, _, performance = matches[0]
            code, topic = performance['course']['code'], performance['topic']
            reasons = {'struggling': f'Build confidence in {topic} for {code}.',
                       'developing': f'Target your weakest area in {code}: {topic}.',
                       'thriving': f'Extend your strong performance in {code}.'}
            reason = reasons[performance['band']] if performance['hasGrade'] else f'Get started with core material for {code}; no current grade is available yet.'
            ranked.append((score, {**resource, 'courseCode': 'All courses' if '*' in resource['courseIds'] else code, 'reason': reason}))
        ranked.sort(key=lambda item: (-item[0], item[1]['id']))
        recommendations = [item[1] for item in ranked[:3]]

    return {'recommendations': recommendations, 'pacing': pacing(student_id, course_ids, assignments, submissions, grades, as_of)}


def pacing(student_id, course_ids, assignments, submissions, grades, as_of):
    if not course_ids:
        return {'status': 'maintain', 'title': 'Register for coursework first',
                'message': 'You have no enrolled courses yet. Browse the course catalog to enroll. Your study plan will update as you submit work.'}
    mine = {a['id']: a for a in assignments if a['courseId'] in course_ids}
    done = sorted((s for s in submissions if s['studentId'] == student_id and s['assignmentId'] in mine and instant(s['submittedAt']) <= as_of), key=lambda s: instant(s['submittedAt']))
    if not done:
        return {'status': 'adjust', 'title': 'Start with a steady weekly rhythm',
                'message': 'No submission pattern is available yet. For the rest of the term, schedule two short work blocks per course each week and begin the next assignment at least three days before it is due.'}
    overdue = sum(1 for a in mine.values() if instant(a['dueDate']) < as_of and not any(s['assignmentId'] == a['id'] for s in done))
    late_rate = sum(1 for s in done if instant(s['submittedAt']) > instant(mine[s['assignmentId']]['dueDate'])) / len(done)
    available_grades = [grades[c]['rawPercentage'] for c in course_ids if grades[c]['rawPercentage'] is not None]
    average = sum(available_grades) / len(available_grades) if available_grades else None
    gap = (instant(done[-1]['submittedAt']) - instant(done[0]['submittedAt'])).total_seconds() / max(1, len(done) - 1) / 86400
    if overdue or late_rate >= 0.3 or (average is not None and average < 70):
        reason = (f'{overdue} overdue {"assignment needs" if overdue == 1 else "assignments need"} attention' if overdue
                  else 'recent work is often arriving after the deadline' if late_rate >= 0.3 else 'your current grades are below 70%')
        return {'status': 'adjust', 'title': 'Lighten the weekly crunch',
                'message': f'Adjust your workload because {reason}. For the rest of the term, move one study block earlier in the week and focus on one high-impact task at a time before adding extra work.'}
    if len(done) >= 3 and gap < 2:
        return {'status': 'adjust', 'title': 'Spread work more evenly',
                'message': 'Your submissions are clustered close together. For the rest of the term, distribute work across the week and leave a separate review block before each deadline.'}
    if average is not None and average >= 90 and late_rate < 0.1:
        return {'status': 'stretch', 'title': 'Keep your pace and add one stretch block',
                'message': 'Your current grades are strong and most submissions are on time. If your workload feels manageable, consider one optional weekly block for advanced material.'}
    return {'status': 'maintain', 'title': 'Maintain a consistent pace',
            'message': 'Most of your work has arrived on time. For the rest of the term, keep your current weekly cadence and use one short review session to target the weakest topic highlighted in your recommendations.'}
