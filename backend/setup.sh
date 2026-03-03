#!/bin/bash
# Setup script for development environment

echo "=== Campus Scheduler Development Setup ==="
echo ""

# Activate virtual environment
echo "1. Activating virtual environment..."
source venv/bin/activate

# Remove old database migrations (keeping only initial)
echo "2. Cleaning up database..."
find . -path "*/migrations/*.py" -not -name "__init__.py" -not -name "0001_initial.py" -delete
find . -path "*/migrations/*.pyc" -delete

# Create fresh migrations
echo "3. Creating migrations..."
python manage.py makemigrations

# Apply migrations
echo "4. Applying migrations..."
python manage.py migrate --run-syncdb

# Create superuser if doesn't exist
echo "5. Creating superadmin user..."
python manage.py shell << EOF
from accounts.models import User, Staff
from core.models import College, Department

# Create or get superadmin
admin_email = 'admin@campus.com'
if not User.objects.filter(email=admin_email).exists():
    admin = User.objects.create_superuser(
        username='admin',
        email=admin_email,
        password='admin123',
        first_name='Campus',
        last_name='Admin',
        role='SUPER_ADMIN'
    )
    print(f"✓ Superadmin created: {admin.email}")
else:
    admin = User.objects.get(email=admin_email)
    print(f"✓ Superadmin already exists: {admin.email}")

# Create sample college
college_name = 'Sample College'
if not College.objects.filter(name=college_name).exists():
    college = College.objects.create(
        name=college_name,
        address='123 Education Street',
        working_days=6,
        periods_per_day=5,
        period_duration=45
    )
    print(f"✓ Sample college created: {college.name}")
else:
    college = College.objects.get(name=college_name)
    print(f"✓ Sample college already exists: {college.name}")

# Create sample departments
departments_data = [
    ('Computer Science', 'CSE'),
    ('Electronics', 'ECE'),
    ('Mechanical', 'MECH'),
]

for dept_name, dept_code in departments_data:
    if not Department.objects.filter(code=dept_code).exists():
        Department.objects.create(
            college=college,
            name=dept_name,
            code=dept_code
        )
        print(f"✓ Department created: {dept_name}")

print("\n=== Setup Complete ===")
EOF

echo ""
echo "Setup complete! You can now run the server with:"
echo "  python manage.py runserver"
echo ""
echo "Login with:"
echo "  Email: admin@campus.com"
echo "  Password: admin123"
