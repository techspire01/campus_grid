from django.urls import path, include
from rest_framework.routers import DefaultRouter
from timetable.views import (
    SubjectViewSet, TimeSlotViewSet, TimetableEntryViewSet,
    CommonTimetableViewSet, DepartmentTimetableViewSet,
    TimetableMergeViewSet, TimetableExportViewSet
)

router = DefaultRouter()
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'timeslots', TimeSlotViewSet, basename='timeslot')
router.register(r'timetable-entries', TimetableEntryViewSet, basename='timetable-entry')
router.register(r'common-timetable', CommonTimetableViewSet, basename='common-timetable')
router.register(r'department-timetable', DepartmentTimetableViewSet, basename='department-timetable')
router.register(r'timetable/merged', TimetableMergeViewSet, basename='timetable-merged')
router.register(r'timetable/export', TimetableExportViewSet, basename='timetable-export')

urlpatterns = [
    path('', include(router.urls)),
]

