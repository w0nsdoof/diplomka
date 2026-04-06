from apps.common.services import apply_versioned_status_change, update_with_version


def update_project_with_version(project, validated_data, actor):
    return update_with_version(project, validated_data, actor)


def update_epic_with_version(epic, validated_data, actor):
    return update_with_version(epic, validated_data, actor)


def apply_project_status_change(project, new_status, actor):
    return apply_versioned_status_change(project, new_status, actor)


def apply_epic_status_change(epic, new_status, actor):
    return apply_versioned_status_change(epic, new_status, actor)
