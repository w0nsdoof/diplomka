from django.utils.translation import gettext_lazy as _
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class OrganizationJWTAuthentication(JWTAuthentication):
    """Custom JWT authentication that checks organization active status.

    Non-superadmin users whose organization is inactive are rejected
    with an AuthenticationFailed error on every request.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, token = result

        if not user.is_superadmin and user.organization_id:
            if not user.organization.is_active:
                raise AuthenticationFailed(_("Organization is inactive."))

        return user, token


class OrganizationJWTScheme(OpenApiAuthenticationExtension):
    target_class = "config.authentication.OrganizationJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
