from django.urls import path

from apps.clients.views_portal import PortalTicketDetailView, PortalTicketListView

urlpatterns = [
    path("tickets/", PortalTicketListView.as_view(), name="portal-ticket-list"),
    path("tickets/<int:pk>/", PortalTicketDetailView.as_view(), name="portal-ticket-detail"),
]
