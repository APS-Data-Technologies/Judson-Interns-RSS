from django.db import migrations, models


def consolidate_operational_statuses(apps, schema_editor):
    Tour = apps.get_model("tours", "Tour")
    Tour.objects.filter(current_status="rescheduled").update(current_status="scheduled")
    for tour in Tour.objects.filter(current_status="cancelled").iterator():
        tour.current_status = "no_show"
        tour.cancelled_at = tour.updated_at
        tour.save(update_fields=["current_status", "cancelled_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("tours", "0003_tour_student_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="tour",
            name="cancellation_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="tour",
            name="cancelled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(consolidate_operational_statuses, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="tour",
            name="current_status",
            field=models.CharField(
                choices=[
                    ("scheduled", "Scheduled"),
                    ("toured", "Toured"),
                    ("enrolled", "Enrolled"),
                    ("churned", "Churned"),
                    ("no_show", "No Show"),
                ],
                default="scheduled",
                max_length=20,
            ),
        ),
    ]
