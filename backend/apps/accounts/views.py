import hashlib
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.sites.models import Location
from .models import PasswordResetRequest, User
from .permissions import IsSuperAdmin
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserLocationSerializer,
    UserSerializer,
    UserWriteSerializer,
)


logger = logging.getLogger(__name__)
PASSWORD_RESET_RESPONSE = {
    "detail": "If an active account exists for that email address, a password-reset link has been sent."
}


def _token_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _client_ip(request):
    # Railway terminates TLS at its proxy. Trust the first forwarded address
    # only when it is present, and retain it solely for security auditing.
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (forwarded_for.split(",")[0].strip() if forwarded_for else request.META.get("REMOTE_ADDR")) or None


class LoginView(generics.GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        update_last_login(None, user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        Token.objects.filter(user=request.user).delete()
        token = Token.objects.create(user=request.user)
        return Response({"token": token.key})


class PasswordResetRequestView(generics.GenericAPIView):
    """Issue a reset email without disclosing whether the address exists."""

    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True).first()
        if user is None:
            return Response(PASSWORD_RESET_RESPONSE, status=status.HTTP_202_ACCEPTED)

        raw_token = secrets.token_urlsafe(32)
        now = timezone.now()
        with transaction.atomic():
            # A new request immediately supersedes all earlier links.
            PasswordResetRequest.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
            PasswordResetRequest.objects.create(
                user=user,
                token_digest=_token_digest(raw_token),
                expires_at=now + timedelta(seconds=settings.PASSWORD_RESET_TOKEN_TTL_SECONDS),
                requested_ip=_client_ip(request),
                requested_user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
            )

        reset_url = (
            f"{settings.PASSWORD_RESET_FRONTEND_URL.rstrip('/')}/reset-password?"
            f"{urlencode({'token': raw_token})}"
        )
        try:
            sent = send_mail(
                subject="Reset your Ready Set STEM password",
                message=(
                    "We received a request to reset your Ready Set STEM password.\n\n"
                    f"Reset your password: {reset_url}\n\n"
                    f"This link expires in {settings.PASSWORD_RESET_TOKEN_TTL_SECONDS // 60} minutes and can be used once. "
                    "If you did not request this, you can safely ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            if sent != 1:
                logger.error("Password-reset email was not accepted for delivery (user_id=%s).", user.id)
        except Exception:
            # The public response intentionally remains generic. Operations get
            # the error through application logging without exposing account data.
            logger.exception("Password-reset email delivery failed (user_id=%s).", user.id)

        return Response(PASSWORD_RESET_RESPONSE, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(generics.GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        now = timezone.now()

        with transaction.atomic():
            reset_request = (
                PasswordResetRequest.objects.select_for_update()
                .select_related("user")
                .filter(
                    token_digest=_token_digest(serializer.validated_data["token"]),
                    used_at__isnull=True,
                    expires_at__gt=now,
                    user__is_active=True,
                )
                .first()
            )
            if reset_request is None:
                return Response(
                    {"token": ["This password-reset link is invalid or has expired."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                validate_password(serializer.validated_data["new_password"], reset_request.user)
            except DjangoValidationError as error:
                return Response({"new_password": error.messages}, status=status.HTTP_400_BAD_REQUEST)

            reset_request.user.set_password(serializer.validated_data["new_password"])
            reset_request.user.save(update_fields=["password"])
            Token.objects.filter(user=reset_request.user).delete()
            PasswordResetRequest.objects.filter(user=reset_request.user, used_at__isnull=True).update(used_at=now)

        return Response({"detail": "Your password has been reset. Please sign in with your new password."})


class UserLocationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    serializer_class = UserLocationSerializer
    pagination_class = None

    def get_queryset(self):
        return Location.objects.filter(is_active=True).order_by("location_name")


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("location").all()
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])
        Token.objects.filter(user=user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
