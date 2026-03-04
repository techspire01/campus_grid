from django.urls import path, include
from rest_framework.routers import DefaultRouter
from approvals.views import ApprovalViewSet, ApprovalLogViewSet

router = DefaultRouter()
router.register(r'approvals', ApprovalViewSet, basename='approval')
router.register(r'approval-logs', ApprovalLogViewSet, basename='approval-log')

urlpatterns = [
    path('', include(router.urls)),
]
