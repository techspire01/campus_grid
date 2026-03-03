import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'campus_scheduler.settings')
sys.path.insert(0, '/d/campus_grid/backend')

django.setup()

from django.core.management import call_command
from django.db import connection

# Delete all tables (SQLite compatible)
print("Dropping all tables...")
with connection.cursor() as cursor:
    cursor.execute("DROP TABLE IF EXISTS django_migrations")
    cursor.execute("DROP TABLE IF EXISTS django_content_type")
    connection.commit()

# Run migrations fresh
print("Creating tables from migrations...")
call_command('migrate')

# Create initial data
print("Creating sample data...")
from accounts.models import User
from core.models import College, Department

# Create superadmin
if not User.objects.filter(email='admin@campus.com').exists():
    admin = User.objects.create_superuser(
        username='admin',
        email='admin@campus.com',
        password='admin123',
        first_name='Campus',
        last_name='Admin',
        role='SUPER_ADMIN'
    )
    print(f"✓ Created superadmin: {admin.email}")

# Create college
college, created = College.objects.get_or_create(
    name='Sample College',
    defaults={
        'address': '123 Education Street',
        'working_days': 6,
        'periods_per_day': 5,
        'period_duration': 45
    }
)
if created:
    print(f"✓ Created college: {college.name}")
else:
    print(f"✓ College exists: {college.name}")

# Create departments
departments = [
    ('Computer Science', 'CSE'),
    ('Electronics', 'ECE'),
    ('Mechanical', 'MECH'),
]

for dept_name, dept_code in departments:
    dept, created = Department.objects.get_or_create(
        college=college,
        code=dept_code,
        defaults={'name': dept_name}
    )
    if created:
        print(f"✓ Created department: {dept_name}")

print("\n✓ Database setup complete!")
print("\nLogin credentials:")
print("  Email: admin@campus.com")
print("  Password: admin123")
