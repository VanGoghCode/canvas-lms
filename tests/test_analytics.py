import unittest

from backend.analytics import course_analytics


class AnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.data = {
            'courseId': 'c101', 'asOf': '2026-08-15T12:00:00Z',
            'filters': {'assignmentId': '', 'dateFrom': '', 'dateTo': ''},
            'assignments': [
                {'id': 'a', 'courseId': 'c101', 'title': 'Due work', 'dueDate': '2026-08-01T23:59', 'pointsPossible': 100},
                {'id': 'future', 'courseId': 'c101', 'title': 'Future work', 'dueDate': '2026-08-22T23:59', 'pointsPossible': 100},
            ],
            'enrollments': [{'id': 'e', 'studentId': 'new', 'courseId': 'c101'}],
            'submissions': [{'assignmentId': 'a', 'studentId': 'new', 'score': 90, 'submittedAt': '2026-08-02T12:00:00Z'}],
        }

    def test_inclusive_due_dates_keep_late_submissions(self):
        self.data['filters'].update(dateFrom='2026-08-01', dateTo='2026-08-01')
        result = course_analytics(self.data)
        self.assertEqual(result['totalSubmissions'], 1)
        self.assertEqual(result['overallCompletion'], 100)
        self.assertEqual(result['overallAverage'], 90)
        self.assertEqual(result['lateAverage'], 90)
        self.assertEqual(result['assignmentMetrics'][0]['assignmentId'], 'a')

    def test_future_work_without_submissions_has_no_grade_or_cohort(self):
        self.data['filters']['assignmentId'] = 'future'
        self.data['submissions'] = []
        result = course_analytics(self.data)
        self.assertIsNone(result['overallAverage'])
        self.assertIsNone(result['overallCompletion'])
        self.assertEqual(result['cohorts'], [])

    def test_ungraded_and_out_of_course_submissions_do_not_count_as_scores(self):
        self.data['submissions'][0]['score'] = None
        self.data['submissions'].append({'assignmentId': 'a', 'studentId': 'not-enrolled', 'score': 100, 'submittedAt': '2026-08-02T12:00:00Z'})
        result = course_analytics(self.data)
        self.assertEqual(result['totalSubmissions'], 1)
        self.assertEqual(result['gradedSubmissions'], 0)
        self.assertIsNone(result['overallAverage'])
        self.assertEqual(result['overallCompletion'], 100)

    def test_distribution_uses_unrounded_letter_grade(self):
        self.data['submissions'][0]['score'] = 69.99
        result = course_analytics(self.data)
        self.assertEqual(result['overallAverage'], 70)
        self.assertEqual(next(g['students'] for g in result['gradeDistribution'] if g['grade'] == 'D'), 1)


if __name__ == '__main__':
    unittest.main()
