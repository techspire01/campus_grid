from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import CollegeViewSet, DepartmentViewSet, ClassViewSet, LabViewSet, UserViewSet, StaffViewSet
from workload.views import WorkloadAssignmentViewSet, WorkloadConfigViewSet

router = DefaultRouter()
router.register(r'colleges', CollegeViewSet, basename='college')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'classes', ClassViewSet, basename='class')
router.register(r'labs', LabViewSet, basename='lab')
router.register(r'users', UserViewSet, basename='user')
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'workload-assignments', WorkloadAssignmentViewSet, basename='workload-assignment')
router.register(r'workload-config', WorkloadConfigViewSet, basename='workload-config')

urlpatterns = [
    path('', include(router.urls)),
]
