from django.conf import settings
from django.urls import path
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenVerifyView

from apps.accounts.serializers import CustomTokenObtainPairSerializer


class AuthRateThrottle(AnonRateThrottle):
    scope = "auth"

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_MAX_AGE = int(
    getattr(settings, "SIMPLE_JWT", {})
    .get("REFRESH_TOKEN_LIFETIME", __import__("datetime").timedelta(days=7))
    .total_seconds()
)


def _set_refresh_cookie(response, refresh_token):
    secure = not settings.DEBUG
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path="/api/auth/",
    )


def _delete_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth/")


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        tags=["Auth"],
        summary="Login (obtain JWT tokens)",
        description=(
            "Authenticate with email and password. Returns access token in response body "
            "and sets refresh token as httpOnly cookie (path=/api/auth/). "
            "Access token contains custom claims: email, first_name, last_name, role, organization_id."
        ),
        request=inline_serializer("LoginRequest", fields={
            "email": serializers.EmailField(help_text="User email address"),
            "password": serializers.CharField(help_text="User password"),
        }),
        responses={
            200: inline_serializer("LoginResponse", fields={
                "access": serializers.CharField(help_text="JWT access token"),
            }),
            401: OpenApiResponse(description="Invalid email or password"),
        },
        auth=[],
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        response = Response({"access": data["access"]}, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, data["refresh"])
        return response


class CookieTokenRefreshView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        tags=["Auth"],
        summary="Refresh access token",
        description=(
            "Reads refresh token from httpOnly cookie and returns a new access token. "
            "No request body needed. If refresh token is rotated, the cookie is updated."
        ),
        request=None,
        responses={
            200: inline_serializer("RefreshResponse", fields={
                "access": serializers.CharField(help_text="New JWT access token"),
            }),
            401: OpenApiResponse(description="Missing or expired refresh token cookie"),
        },
        auth=[],
    )
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)
        if not refresh_token:
            return Response(
                {"detail": "No refresh token cookie."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError) as e:
            response = Response(
                {"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED
            )
            _delete_refresh_cookie(response)
            return response
        data = serializer.validated_data
        response = Response({"access": data["access"]}, status=status.HTTP_200_OK)
        if "refresh" in data:
            _set_refresh_cookie(response, data["refresh"])
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Logout (clear refresh cookie)",
        request=None,
        responses={204: None},
        auth=[],
    )
    def post(self, request, *args, **kwargs):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _delete_refresh_cookie(response)
        return response


@extend_schema(tags=["Auth"], summary="Verify access token", auth=[])
class DecoratedTokenVerifyView(TokenVerifyView):
    pass


urlpatterns = [
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", DecoratedTokenVerifyView.as_view(), name="token_verify"),
    path("logout/", LogoutView.as_view(), name="auth_logout"),
]
