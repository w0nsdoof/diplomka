from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.attachments.views import AttachmentViewSet
from apps.comments.views import CommentViewSet
from apps.tasks.views import TaskViewSet

router = DefaultRouter()
router.register("", TaskViewSet, basename="task")

attachment_list = AttachmentViewSet.as_view({"get": "list", "post": "create"})
attachment_detail = AttachmentViewSet.as_view({"get": "retrieve", "delete": "destroy"})

comment_list = CommentViewSet.as_view({"get": "list", "post": "create"})

urlpatterns = [
    path("", include(router.urls)),
    path("<int:task_pk>/attachments/", attachment_list, name="task-attachment-list"),
    path("<int:task_pk>/attachments/<int:pk>/", attachment_detail, name="task-attachment-detail"),
    path("<int:task_pk>/comments/", comment_list, name="task-comment-list"),
]
