from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsSuperAdmin

from .models import CostBasis
from .serializers import CostBasisSerializer


class CostBasisViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CostBasisSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    pagination_class = None

    def get_queryset(self):
        return CostBasis.objects.select_related("location").all()
