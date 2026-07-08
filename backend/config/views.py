from django.http import JsonResponse


def root_status(request):
    return JsonResponse({
        "status": "ok",
        "service": "backend",
    })


def health_check(request):
    return JsonResponse({
        "status": "ok",
        "message": "Backend is running"
    })
