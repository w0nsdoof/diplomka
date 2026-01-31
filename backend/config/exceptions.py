from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        data = response.data
        if isinstance(data, dict) and "detail" not in data:
            response.data = {"errors": data}
        elif isinstance(data, list):
            response.data = {"detail": data[0] if data else "An error occurred."}
    return response
