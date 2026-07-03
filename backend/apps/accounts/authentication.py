from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        max_age = timedelta(hours=settings.AUTH_TOKEN_TTL_HOURS)
        if timezone.now() - token.created > max_age:
            token.delete()
            raise AuthenticationFailed("Token expired. Please sign in again.")
        return user, token
