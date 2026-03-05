from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_class_tutors'),
        ('timetable', '0004_remove_subject_staff_subject_staff'),
    ]

    operations = [
        migrations.AddField(
            model_name='timeslot',
            name='end_time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='timeslot',
            name='start_time',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='CollegeTiming',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('college', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='timing_config', to='core.college')),
            ],
            options={
                'db_table': 'timetable_college_timing',
            },
        ),
    ]
