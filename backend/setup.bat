@echo off
REM Setup script for development environment

echo.
echo === Campus Scheduler Development Setup ===
echo.

REM Show current state
echo 1. Checking migrations...
D:/campus_grid/backend/venv/Scripts/python.exe manage.py showmigrations --list | findstr "0001_initial"

echo.
echo 2. Running initial migrations...
D:/campus_grid/backend/venv/Scripts/python.exe manage.py migrate 0001 --fake-initial

echo.
echo 3. Running all remaining migrations...
D:/campus_grid/backend/venv/Scripts/python.exe manage.py migrate

echo.
echo 4. Creating sample data...
D:/campus_grid/backend/venv/Scripts/python.exe manage.py shell << 'EOF'
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
    print(f"Created superadmin: {admin.email}")
else:
    admin = User.objects.get(email=admin_email)
    print(f"Superadmin exists: {admin.email}")

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
    print(f"Created college: {college.name}")
else:
    college = College.objects.get(name=college_name)
    print(f"College exists: {college.name}")

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
        print(f"Created department: {dept_name}")

print("")
print("=== Setup Complete ===")
EOF

echo.
echo Login with:
echo   Email: admin@campus.com
echo   Password: admin123
