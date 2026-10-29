import unittest

from backend.study_plan import study_plan


class StudyPlanTests(unittest.TestCase):
    def setUp(self):
        self.data = {
            'studentId': 'student', 'asOf': '2026-08-15T12:00:00Z',
            'courses': [{'id': 'c101', 'code': 'CS 210'}],
            'enrollments': [{'studentId': 'student', 'courseId': 'c101'}],
            'assignments': [{'id': 'a1', 'courseId': 'c101', 'title': 'Applied Challenge',
                             'description': 'Practice', 'dueDate': '2026-08-10T23:59', 'pointsPossible': 100}],
            'submissions': [],
            'grades': {'c101': {'rawPercentage': 0, 'percentage': 0, 'missingAssignments': 1}},
        }

    def test_without_enrollment_suggests_getting_started(self):
        self.data.update(courses=[], enrollments=[], assignments=[], grades={})
        result = study_plan(self.data)
        self.assertEqual(result['pacing']['title'], 'Register for coursework first')
        self.assertEqual([r['courseCode'] for r in result['recommendations']], ['All courses'] * 3)

    def test_missing_work_gets_foundation_recommendations(self):
        result = study_plan(self.data)
        self.assertEqual(result['pacing']['title'], 'Start with a steady weekly rhythm')
        self.assertTrue(result['recommendations'])
        self.assertTrue(all(r['difficulty'] in ('remedial', 'core') for r in result['recommendations']))

    def test_late_work_adjusts_pacing(self):
        self.data['submissions'] = [{'studentId': 'student', 'assignmentId': 'a1',
                                     'submittedAt': '2026-08-12T12:00:00Z', 'score': 85}]
        self.data['grades']['c101'] = {'rawPercentage': 85, 'percentage': 85, 'missingAssignments': 0}
        result = study_plan(self.data)
        self.assertEqual(result['pacing']['title'], 'Lighten the weekly crunch')
        self.assertIn('after the deadline', result['pacing']['message'])

    def test_strong_on_time_work_gets_stretch_suggestions(self):
        self.data['submissions'] = [{'studentId': 'student', 'assignmentId': 'a1',
                                     'submittedAt': '2026-08-09T12:00:00Z', 'score': 95}]
        self.data['grades']['c101'] = {'rawPercentage': 95, 'percentage': 95, 'missingAssignments': 0}
        result = study_plan(self.data)
        self.assertEqual(result['pacing']['status'], 'stretch')
        self.assertTrue(all(r['difficulty'] in ('advanced', 'enrichment') for r in result['recommendations']))


if __name__ == '__main__':
    unittest.main()
