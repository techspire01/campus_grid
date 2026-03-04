from django.urls import path, include
from rest_framework.routers import DefaultRouter
from workload.views import WorkloadAssignmentViewSet, WorkloadConfigViewSet

router = DefaultRouter()
router.register(r'workload-assignments', WorkloadAssignmentViewSet, basename='workload-assignment')
router.register(r'workload-config', WorkloadConfigViewSet, basename='workload-config')

urlpatterns = [
    path('', include(router.urls)),
]
