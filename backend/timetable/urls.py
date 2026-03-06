from django.urls import path, include
from rest_framework.routers import DefaultRouter
from timetable.views import (
    SubjectViewSet, SubjectTypeViewSet, TimeSlotViewSet, TimetableEntryViewSet,
    CollegeTimingViewSet,
    CommonTimetableViewSet, DepartmentTimetableViewSet,
    TimetableMergeViewSet, TimetableExportViewSet,
    LabTimetableViewSet
)

router = DefaultRouter()
router.register(r'subject-types', SubjectTypeViewSet, basename='subject-type')
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'timeslots', TimeSlotViewSet, basename='timeslot')
router.register(r'college-timings', CollegeTimingViewSet, basename='college-timing')
router.register(r'timetable-entries', TimetableEntryViewSet, basename='timetable-entry')
router.register(r'common-timetable', CommonTimetableViewSet, basename='common-timetable')
router.register(r'department-timetable', DepartmentTimetableViewSet, basename='department-timetable')
router.register(r'lab-timetable', LabTimetableViewSet, basename='lab-timetable')
router.register(r'timetable/merged', TimetableMergeViewSet, basename='timetable-merged')
router.register(r'timetable/export', TimetableExportViewSet, basename='timetable-export')

urlpatterns = [
    path('', include(router.urls)),
]

