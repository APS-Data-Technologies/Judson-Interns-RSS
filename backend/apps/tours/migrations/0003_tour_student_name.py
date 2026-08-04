from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tours", "0002_tour_external_id_tourevent_external_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="tour",
            name="student_name",
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
