from django.urls import path
from accounts.views import AuthViewSet

urlpatterns = [
    path('auth/login/', AuthViewSet.as_view({'post': 'login'}), name='auth-login'),
    path('auth/logout/', AuthViewSet.as_view({'post': 'logout'}), name='auth-logout'),
    path('auth/change-password/', AuthViewSet.as_view({'post': 'change_password'}), name='auth-change-password'),
]
