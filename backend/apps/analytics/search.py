from django.db.models import OuterRef, Q, Subquery

from apps.accounts.models import User
from apps.leads.models import Family, LeadSource
from apps.sites.models import Location

from .core import base_queryset


def global_search(user, raw_query, limit=5):
    query = (raw_query or "").strip()
    if len(query) < 2:
        return {"families": [], "tours": [], "locations": [], "leadSources": [], "staff": []}

    limit = min(max(int(limit or 5), 1), 10)
    accessible_tours = base_queryset(user).prefetch_related(None)
    latest_family_tour = accessible_tours.filter(
        family_id=OuterRef("pk"),
    ).order_by("-scheduled_tour_date").values("id")[:1]
    matching_families = Family.objects.filter(
        tours__in=accessible_tours,
        family_name__icontains=query,
    ).annotate(
        latest_tour_id=Subquery(latest_family_tour),
    ).order_by("family_name").distinct()[:limit]
    matching_tours = accessible_tours.filter(
        Q(family__family_name__icontains=query)
        | Q(family__contact_email__icontains=query)
        | Q(location__location_name__icontains=query)
        | Q(lead_source__source_name__icontains=query)
        | Q(assigned_staff__first_name__icontains=query)
        | Q(assigned_staff__last_name__icontains=query)
    ).order_by("-scheduled_tour_date")

    families = [{
        "id": family.id,
        "title": family.family_name,
        "subtitle": "Family",
        "path": f"/tours/{family.latest_tour_id}",
    } for family in matching_families]

    tours = [{
        "id": tour.id,
        "title": tour.family.family_name,
        "subtitle": f"{tour.scheduled_tour_date:%b %-d, %Y} · {tour.get_current_status_display()} · {tour.location.location_name}",
        "path": f"/tours/{tour.id}",
    } for tour in matching_tours[:limit]]

    accessible_location_ids = accessible_tours.values_list("location_id", flat=True).distinct()
    accessible_source_ids = accessible_tours.values_list("lead_source_id", flat=True).distinct()
    locations = Location.objects.filter(
        id__in=accessible_location_ids,
        is_active=True,
        location_name__icontains=query,
    )[:limit]
    sources = LeadSource.objects.filter(
        id__in=accessible_source_ids,
        is_active=True,
        source_name__icontains=query,
    )[:limit]

    can_view_staff = user.role in {User.Role.ADMIN, User.Role.SUPER_ADMIN}
    accessible_staff_ids = accessible_tours.values_list("assigned_staff_id", flat=True).distinct()
    staff = User.objects.filter(
        id__in=accessible_staff_ids,
        is_active=True,
    ).filter(
        Q(first_name__icontains=query)
        | Q(last_name__icontains=query)
        | Q(email__icontains=query)
    )[:limit] if can_view_staff else []

    return {
        "families": families,
        "tours": tours,
        "locations": [{
            "id": location.id,
            "title": location.location_name,
            "subtitle": f"{location.city}, {location.state}",
            "path": f"/analytics/locations?location={location.id}",
        } for location in locations],
        "leadSources": [{
            "id": source.id,
            "title": source.source_name,
            "subtitle": "Lead source",
            "path": f"/analytics/lead-sources?leadSource={source.id}",
        } for source in sources],
        "staff": [{
            "id": person.id,
            "title": person.get_full_name() or person.email,
            "subtitle": person.email,
            "path": f"/analytics/staff?staff={person.id}",
        } for person in staff],
    }
