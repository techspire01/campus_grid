import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework import exceptions


User = get_user_model()


class DevelopmentBypassAuthentication(authentication.BaseAuthentication):
    """Bypass authentication and attach a default active user to every request."""

    def authenticate(self, request):
        user = User.objects.filter(is_active=True).order_by('id').first()

        if not user:
            user = User.objects.create_user(
                username='localadmin',
                email='localadmin@campus.local',
                password='localadmin123',
                first_name='Local',
                last_name='Admin',
                role='SUPER_ADMIN',
                is_staff=True,
                is_superuser=True,
                is_active=True,
            )

        return (user, None)


class JWTAuthentication(authentication.BaseAuthentication):
    """Authenticate requests using JWT tokens from Authorization header."""

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).decode('utf-8')
        if not auth_header:
            return None

        token = None
        parts = auth_header.split()

        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]
        elif len(parts) == 1:
            token = parts[0]

        if not token:
            return None

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed('Invalid token')

        user_id = payload.get('user_id')
        if not user_id:
            raise exceptions.AuthenticationFailed('Invalid token payload')

        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User not found or inactive')

        return (user, token)