class OrganizationQuerySetMixin:
    """Mixin for DRF viewsets that scopes querysets to the requesting user's organization.

    Superadmins get an empty queryset (200 with empty list) — they have no org-scoped data.
    Individual ViewSets MAY override with 403 if superadmin access should be explicitly forbidden.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superadmin:
            return qs.none()
        return qs.filter(organization=user.organization)
