import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'campus_scheduler.settings')
django.setup()

from timetable.models import SubjectType

# Create default subject types
default_types = [
    {'name': 'Theory', 'code': 'THEORY', 'description': 'Theoretical subjects'},
    {'name': 'Practical', 'code': 'PRACTICAL', 'description': 'Practical subjects'},
    {'name': 'Lab', 'code': 'LAB', 'description': 'Laboratory subjects'},
    {'name': 'Tutorial', 'code': 'TUTORIAL', 'description': 'Tutorial subjects'},
    {'name': 'Project', 'code': 'PROJECT', 'description': 'Project work'},
]

for type_data in default_types:
    subject_type, created = SubjectType.objects.get_or_create(
        code=type_data['code'],
        defaults={
            'name': type_data['name'],
            'description': type_data['description'],
            'is_active': True
        }
    )
    if created:
        print(f"Created subject type: {subject_type.name}")
    else:
        print(f"Subject type already exists: {subject_type.name}")

print("\nSubject types initialization complete!")
