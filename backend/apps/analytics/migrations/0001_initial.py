from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AnalyticsOperation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("operation", models.CharField(choices=[("validation", "Validation"), ("export", "Export")], max_length=20)),
                ("status", models.CharField(default="completed", max_length=20)),
                ("detail", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("initiated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="analytics_operations", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="analyticsoperation",
            index=models.Index(fields=["operation", "created_at"], name="analytics_a_operati_64bb20_idx"),
        ),
    ]
