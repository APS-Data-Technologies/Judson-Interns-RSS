from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("reports", "0002_costbasis_external_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="costbasis",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="costbasis",
            name="cost_type",
            field=models.CharField(
                choices=[("Expenditure", "Expenditure"), ("Revenue", "Revenue")],
                max_length=100,
            ),
        ),
    ]
