# Campus Timetable Scheduler - Complete Development Documentation

## 📋 Project Overview
A comprehensive SaaS timetable scheduling system built with **Django 5.0 + React 18 + SQLite/PostgreSQL**.

### Key Features
✅ Multi-level approval workflow (Lab Incharge → Common Subject Heads)
✅ Role-based access control (7 different user roles)
✅ Constraint satisfaction with backtracking algorithm
✅ Workload management (admin-configurable, dept-specific)
✅ Manual override with drag & drop
✅ Real-time validation
✅ Audit trail & change history

---

## 🔧 10-PHASE DEVELOPMENT ROADMAP

### Phase 1: Project Foundation Setup ✅ COMPLETED
**Goal:** Setup Django, DRF, database, and project structure

**Completed Tasks:**
- Django 5.0.1 project initialized with 5 apps (core, accounts, timetable, workload, approvals)
- SQLite database configured (PostgreSQL ready for production)
- Custom User model with roles implemented
- JWT-style authentication setup
- All 8 core models created:
  - `College` - Institution configuration
  - `Department` - Multiple departments per college
  - `Staff` - Staff members with workload tracking
  - `User` - Custom user with roles
  - `Subject` - Core & common subjects
  - `TimeSlot` - Day/period schedule slots
  - `TimetableEntry` - Actual schedule assignments
  - `Lab` - Lab facilities
  
**Database Migrations:** ✅ Applied successfully
**Sample Data:** Created (1 college, 3 departments, admin user)

---

### Phase 2: Institution Structure Modeling API ✅ COMPLETED
**Goal:** Build APIs for college, department, lab, staff, and user management

**ViewSets Created:**
1. **CollegeViewSet** - CRUD colleges (Super Admin only)
   - `GET /api/colleges/` - List all colleges
   - `POST /api/colleges/` - Create college
   - `GET /api/colleges/{id}/statistics/` - Get college stats

2. **DepartmentViewSet** - Manage departments
   - `GET /api/departments/` - List departments
   - `POST /api/departments/` - Create department
   - `GET /api/departments/{id}/staff_members/` - Get dept staff
   - `GET /api/departments/{id}/hod_info/` - Get HOD info

3. **LabViewSet** - Manage labs
   - `GET /api/labs/` - List labs
   - `POST /api/labs/` - Create lab
   - Filter by college, department, availability

4. **UserViewSet** - User management
   - `GET /api/users/` - List users
   - `POST /api/users/` - Create user
   - `GET /api/users/me/` - Current user info
   - `GET /api/users/hods/` - Get all HODs in college
   - Filter by role, college, department

5. **StaffViewSet** - Staff members
   - `GET /api/staff/` - List staff
   - `POST /api/staff/` - Add staff
   - `PATCH /api/staff/{id}/set_workload/` - Set max workload
   - `GET /api/staff/{id}/workload_status/` - Get workload details

6. **AuthViewSet** - Authentication
   - `POST /api/auth/login/` - Generate JWT token
   - `POST /api/auth/logout/` - Logout (client-side)
   - `POST /api/auth/change-password/` - Change password

7. **WorkloadAssignmentViewSet** - Assignment management
   - `GET /api/workload-assignments/` - List assignments
   - `POST /api/workload-assignments/` - Create assignment (HOD only)
   - `GET /api/workload-assignments/by_staff/` - Get staff assignments
   - `GET /api/workload-assignments/by_department/` - Get dept assignments

8. **WorkloadConfigViewSet** - Workload configuration
   - `GET /api/workload-config/` - List configs
   - `POST /api/workload-config/` - Set configuration

**Permissions Implemented:**
- `IsSuperAdmin` - Only super admins
- `IsCollegeAdmin` - College administrators
- `IsHOD` - Head of Department
- `IsLabIncharge` - Lab in-charge
- `IsCommonSubjectHead` - Common subject heads
- `IsSuperAdminOrCollegeAdmin` - Combined permission

**Key Features:**
- Filter by college, department, role
- Search by name, email, code
- Pagination (20 items per page)
- Role-based querysets (users only see their data)

---

### Phase 3: Subject & Lab Configuration
**Goal:** Configure subjects (common & core) and manage labs

#### SubjectViewSet
```
POST /api/subjects/ - Create subject
GET /api/subjects/ - List subjects
  Filters: college, department, is_common, is_lab, year, semester
  Search: name, code

PUT /api/subjects/{id}/ - Update subject
DELETE /api/subjects/{id}/ - Delete subject
```

**Subject Types:**
- **Common Subjects:** Tamil, English, Maths, PT, Library, Activity, EDC, FC
  - `is_common = True`
  - No department assigned
  - Applied to all classes

- **Core Subjects:** Department-specific, year-specific
  - `is_common = False`
  - Department assigned
  - May have lab component

**Lab Management:**
- Track lab availability per time slot
- Ensure continuous slots for lab sessions
- Lab incharge assignment
- Lab capacity validation

#### Key Validation Rules:
- Common subjects cannot be assigned to departments
- Core subjects must belong to a department
- Lab subjects must specify duration & capacity
- Subject code must be unique per college

---

### Phase 4: Common Timetable Generation Engine
**Goal:** Automatic generation of common subject timetables

#### Algorithm Flow:

```python
def generate_common_timetable(college, enabled_addons=False):
    """
    Step 1: Load Constraints
     - Get all timeslots for college
     - Identify available slots
     - Get common subject list
    
    Step 2: Allocate Lab Subjects First (Hardest constraint)
     - PT/Biology/Chem labs need continuous slots
     - Check lab availability
     - Allocate 2-3 continuous slots per class
    
    Step 3: Allocate Theory Subjects
     - Tamil (2h/week)
     - English (2h/week)
     - Maths (2h/week)
     - Library (1h/week)
     - Activity (1h/week)
    
    Step 4: Validate
     - No staff clash (not applicable for common)
     - No lab clash
     - Balanced distribution
    
    Step 5: Return Suggestion
     - Store in CommonTimetable with status='PENDING_APPROVAL'
     - Show grid preview to admin
    
    Step 6: Admin Submits for Approval
     - Status → 'PENDING_APPROVAL'
     - Create approval records for:
       * Lab Incharge (if labs involved)
       * Each common subject department head
    """
```

#### API Endpoint:
```
POST /api/common-timetable/generate/
  Request: {
    "college_id": 1,
    "enable_addons": true,  // Add-on courses
    "avoid_heavy_days": true
  }
  
  Response: {
    "status": "PENDING_APPROVAL",
    "entries": [...],
    "approval_required_for": ["Lab Incharge", "English Dept Head", ...]
  }
```

#### Save Common Timetable
```
POST /api/common-timetable/save/
  - Save suggestion as final (not locked yet)
  - Create TimeSlot entries
  - Status remains PENDING_APPROVAL
```

#### Lock Common Timetable
```
POST /api/common-timetable/lock/
  - Only after all approvals
  - Set is_common_locked=True on timeslots
  - Prevent HOD from editing these slots
  - Staff cannot be moved from locked slots
```

---

### Phase 5: Approval Workflow System
**Goal:** Multi-level approval before common timetable is locked

#### Approval Sequence:

1. **Lab Incharge Approval** (if applicable)
   - Validates lab availability
   - Checks continuous slot allocation
   - Can reject with comments

2. **Common Subject Department Head Approval**
   - One approval per common subject dept
   - Example: Tamil Dept Head, English Dept Head
   - Can suggest changes

3. **Final Lock**
   - Only after ALL approvals = APPROVED
   - Status → LOCKED
   - Prevent editing

#### Approval Model Structure:
```python
Approval(
    common_timetable_id,
    approver_role,  # LAB_INCHARGE, COMMON_SUBJECT_HEAD
    department_id,  # Which common subject dept (if applicable)
    status,  # PENDING, APPROVED, REJECTED
    comment,
    approved_by,
    created_at,
    updated_at
)

ApprovalLog(
    approval_id,
    action,  # SUBMITTED, APPROVED, REJECTED
    changed_by,
    comment,
    created_at
)
```

#### API Endpoints:
```
GET /api/approvals/?status=PENDING
  - Get pending approvals for current user

PATCH /api/approvals/{id}/approve/
  Request: {"comment": "Looks good"}
  - Mark as approved
  - Check if all approvals complete
  - Auto-lock if all approved

PATCH /api/approvals/{id}/reject/
  Request: {"comment": "Labs not available Monday"}
  - Mark asrejected
  - Notify college admin
  - Timetable remains editable
```

#### Audit Trail:
```
GET /api/approvals/{id}/logs/
  - Complete history of approvals
  - Who approved/rejected
  - When and why
  - Changes made
```

---

### Phase 6: Workload Allocation by HOD
**Goal:** HODs assign subjects to staff with workload limits

#### Key Rule:
**Only X Dept HOD can assign workload to X Dept Staff**
- No cross-department assignments
- Admin sets max_workload_hours per staff
- HOD cannot override max

#### Workload Assignment Flow:

1. **Admin Sets Workload Limits**
   ```
   POST /api/staff/{id}/set_workload/
     max_workload_hours: 20
   ```

2. **HOD Assigns Subjects**
   ```
   POST /api/workload-assignments/
     department_id: 1  (must be HOD's dept)
     staff_id: 5
     subject_id: 12
     class_name: "CSE-A"
     hours_assigned: 3.0
   ```

3. **System Validation**
   - Verify HOD owns department
   - Check if staff belongs to department
   - Validate hours don't exceed max
   - Prevent duplicate assignments

4. **Auto-Update Workload**
   ```
   staff.current_workload_hours = sum(workload_assignments)
   ```

#### Workload Status Endpoint:
```
GET /api/staff/{id}/workload_status/
  Response: {
    "max_workload_hours": 20,
    "current_workload_hours": 14.5,
    "remaining_hours": 5.5,
    "utilization_percentage": 72.5
  }
```

#### Department Workload Summary:
```
GET /api/departments/{id}/workload-summary/
  Response: {
    "staff": [
      {
        "name": "Dr. John",
        "max": 20,
        "current": 18,
        "remaining": 2,
        "assignments": [...]
      }
    ],
    "total_available": 120,
    "total_utilization": 98,
    "remaining": 22
  }
```

---

### Phase 7: Department Timetable Generation Engine
**Goal:** Generate department timetable with constraint satisfaction

#### Algorithm (Greedy + Backtracking):

```python
def generate_department_timetable(college, department):
    """
    Input: College, Department
    Output: Suggested timetable (not saved)
    
    Step 1: Load constraints
     - Get locked common timeslots
     - Get workload assignments
     - Get lab requirements
     - Get available timeslots
    
    Step 2: Build data structures
     - Staff availability map
     - Lab availability map
     - Subject requirements map
    
    Step 3: Allocate labs first
     for lab_subject in workload_assignments.labs:
        if can_allocate_continuous_slots(lab_subject):
            allocate(lab_subject)
        else:
            rollback, retry with different slots
    
    Step 4: Allocate theory
     for subject in remaining_subjects:
        for class in subject.classes:
            hours_remaining = subject.hours_per_week
            while hours_remaining > 0:
                slot = find_best_slot(subject, class)
                if slot and is_valid(subject, slot):
                    allocate(subject, class, slot)
                    hours_remaining -= 1
                else:
                    search_next()
    
    Step 5: Validate
     - Check no staff double-booking
     - Check no lab double-booking
     - Check no class double-booking
     - Check workload not exceeded
    
    Step 6: Handle conflicts
     if conflicts exist:
        suggest_manual_override_ui()
        return suggestion
    else:
        return success
    """
```

#### Constraint Objects:

```python
class Constraint:
    HARD_CONSTRAINTS = [
        ('STAFF_UNIQUE', 'Staff cannot teach 2 subjects same time'),
        ('CLASS_UNIQUE', 'Class cannot have 2 subjects same time'),
        ('LAB_UNIQUE', 'Lab cannot be used by 2 classes'),
        ('LAB_CONTINUOUS', 'Lab requires continuous slots'),
        ('WORKLOAD_LIMIT', 'Cannot exceed staff max hours'),
        ('COMMON_LOCKED', 'Cannot edit locked common slots'),
    ]
    
    SOFT_CONSTRAINTS = [
        ('EVEN_DISTRIBUTION', 'Balance subjects across week'),
        ('NO_HEAVY_DAYS', 'Avoid 4+ hours same day'),
        ('TIMING_PREFERENCE', 'Lab in morning, theory afternoon'),
    ]
```

#### API Endpoints:
```
POST /api/department-timetable/generate/
  Request: {"department_id": 5}
  Response: {
    "status": "SUCCESS",
    "entries": [...],
    "conflicts": [],  // If any
    "suggestion_id": "uuid"
  }

GET /api/department-timetable/preview/{suggestion_id}/
  - Show timetable grid before saving

POST /api/department-timetable/save/
  Request: {"suggestion_id": "uuid"}
  - Save as final department timetable
  - Status: DRAFT → APPROVED → PUBLISHED
```

---

### Phase 8: Manual Override System
**Goal:** Drag & drop interface with real-time validation

#### Frontend Components:

1. **Timetable Grid**
   ```jsx
   <TimetableGrid
     entries={entries}
     readOnly={isCommonLocked}
     onDragEnd={handleDragEnd}
   />
   
   Grid dimensions:
   - X-axis: Periods (P1-P5)
   - Y-axis: Days (Mon-Sat)
   - Z-axis: Classes (CSE-A, CSE-B, etc.)
   - Each cell: Subject + Staff + Lab(optional)
   ```

2. **Drag & Drop Logic**
   - Source slot, destination slot
   - Swap or move operations
   - Real-time validation
   - Visual feedback

3. **Validation on Move**
   ```javascript
   on_drag_end(source, destination) {
     validation = backend_validate({
       from_slot: source,
       to_slot: destination,
       entry_id: dragged_entry
     })
     
     if validation.valid:
       save_to_backend()
       show_success()
     else:
       show_error(validation.errors)
       revert_ui()
   }
   ```

#### Validation Rules:
- ❌ Staff clash
- ❌ Lab clash
- ❌ Class clash
- ❌ Workload exceeded
- ❌ Common slot protected
- ❌ Lab not continuous
- ✅ All checks pass

#### API Endpoint:
```
PATCH /api/timetable-entries/{id}/move/
  Request: {
    "from_slot_id": 10,
    "to_slot_id": 15
  }
  
  Returns:
  {
    "valid": true,
    "errors": [],
    "entry": {...updated entry...}
  }

OR

{
    "valid": false,
    "errors": [
      "Staff Dr. John already teaching at this time",
      "Lab CSE-ALB not available on this day"
    ]
  }
```

#### UI Features:
- Color coding by subject type
- Staff workload indicator (visual bar)
- Lab availability status
- Conflict warnings (red borders)
- Drag handles
- Tooltips
- Undo/Redo

---

### Phase 9: Final Merge & Publishing
**Goal:** Combine common + department timetables and publish

#### Merge Process:

1. **Combine Timetables**
   - Place locked common entries
   - Place department-specific entries
   - Check for gaps or overlaps

2. **Generate Views**
   ```
   - Student View (by class)
   - Staff View (by teacher)
   - Department View (by department)
   - College View (all)
   - Lab View (by lab)
   ```

3. **Export Formats**
   - PDF (print-friendly)
   - Excel (.xlsx)
   - CSV (import to other systems)
   - JSON (API export)
   - iCal (.ics for calendar)

4. **Publish**
   ```
   POST /api/timetable/publish/
     - Mark as PUBLISHED
     - Make visible to students
     - Lock editing
     - Archive previous version
   ```

#### API Endpoint:
```
GET /api/timetable/view/?view_type=student&class_id=1
  Response: {
    "class_name": "CSE-A",
    "timetable": [
      {
        "day": "Monday",
        "period": 1,
        "subject": "Data Structures",
        "staff": "Dr. John",
        "room": "CSE-101",
        "type": "THEORY"
      },
      ...
    ]
  }

POST /api/timetable/export/?format=pdf
  Returns: PDF binary

POST /api/timetable/publish/
  - Final status = PUBLISHED
  - Cannot edit
  - Visible to all
```

---

### Phase 10: System Hardening & Optimization
**Goal:** Production-ready, performant, secure system

#### Database Optimization:

1. **Indexes**
   ```sql
   CREATE INDEX idx_staff_timeslot ON timetable_entry(staff_id, timeslot_id);
   CREATE INDEX idx_lab_timeslot ON timetable_entry(lab_id, timeslot_id);
   CREATE INDEX idx_class_timeslot ON timetable_entry(class_name, timeslot_id);
   CREATE INDEX idx_college_dept ON core_department(college_id);
   CREATE INDEX idx_common_locked ON timetable_timeslot(is_common_locked);
   ```

2. **Query Optimization**
   - Use `select_related()` for ForeignKeys
   - Use `prefetch_related()` for ManyToMany
   - Add caching for college config
   - Cache common timetable for locked slots

3. **Constraints at DB Level**
   ```sql
   ALTER TABLE timetable_entry
   ADD CONSTRAINT unique_staff_slot UNIQUE(staff_id, timeslot_id);
   
   ALTER TABLE timetable_entry
   ADD CONSTRAINT unique_lab_slot UNIQUE(lab_id, timeslot_id);
   
   ALTER TABLE timetable_entry
   ADD CONSTRAINT unique_class_slot UNIQUE(class_name, timeslot_id);
   ```

#### Security:

1. **Authentication**
   - JWT token validation
   - Token expiration (1 hour)
   - Refresh tokens (7 days)
   - Secure password hashing (PBKDF2)

2. **Authorization**
   - Role-based access control enforced at view level
   - Object-level permissions (college-based)
   - Department isolation

3. **Data Protection**
   - SQL injection prevention (ORM)
   - CSRF protection (Django middleware)
   - CORS whitelist configured
   - Input validation on all endpoints

4. **Audit Logging**
   ```python
   class AuditLog(models.Model):
       user, action, resource, old_value, new_value, timestamp
       - Who changed what
       - When they changed it
       - What they changed from/to
   ```

#### Performance:

1. **Caching**
   - Redis cache for college config
   - Cache locked timeslots (frequently accessed)
   - Session caching

2. **Pagination**
   - 20 items per page default
   - Cursor pagination for large datasets
   - Search optimization

3. **Load Testing**
   - Test with 10,000+ entries
   - Concurrent user simulation
   - Response time < 200ms target

#### Deployment:

1. **Production Settings**
   ```python
   DEBUG = False
   ALLOWED_HOSTS = ['yourdomain.com']
   SECRET_KEY = os.environ['SECRET_KEY']
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'NAME': os.environ['DB_NAME'],
           ...
       }
   }
   ```

2. **Web Server Setup**
   - Gunicorn (WSGI server)
   - Nginx (reverse proxy)
   - Static files via WhiteNoise or CDN
   - SSL/TLS certificate (Let's Encrypt)

3. **Database**
   - PostgreSQL production instance
   - Automated backups (daily)
   - Connection pooling (pgBouncer)
   - Read replicas for scaling

4. **Monitoring & Logging**
   - Sentry for error tracking
   - ELK stack for logging
   - New Relic for APM
   - Health checks

---

## 🗄️ Complete API Reference

### Authentication
- `POST /api/auth/login/` - Get JWT token
- `POST /api/auth/logout/` - Logout
- `POST /api/auth/change-password/` - Change password

### Core Management
- `GET/POST /api/colleges/` - Manage colleges
- `GET/POST /api/departments/` - Manage departments
- `GET/POST /api/labs/` - Manage labs
- `GET/POST /api/users/` - Manage users
- `GET/POST /api/staff/` - Manage staff

### Timetable
- `POST /api/subjects/` - Create subjects
- `GET /api/subjects/` - List subjects
- `POST /api/common-timetable/generate/` - Generate common timetable
- `POST /api/common-timetable/save/` - Save suggestion
- `POST /api/common-timetable/lock/` - Lock timetable
- `POST /api/department-timetable/generate/` - Generate dept timetable
- `PATCH /api/timetable-entries/{id}/move/` - Move entry (drag & drop)
- `GET /api/timetable/view/` - View finalized timetable
- `POST /api/timetable/export/` - Export as PDF/Excel

### Approvals
- `GET /api/approvals/` - List pending approvals
- `PATCH /api/approvals/{id}/approve/` - Approve
- `PATCH /api/approvals/{id}/reject/` - Reject
- `GET /api/approvals/{id}/logs/` - View approval history

### Workload
- `POST /api/workload-assignments/` - Assign workload
- `GET /api/workload-assignments/` - List assignments
- `PATCH /api/staff/{id}/set_workload/` - Set max workload
- `GET /api/staff/{id}/workload_status/` - Check workload

---

## 📊 Database Schema

### Core Tables
- `core_college` - Institution
- `core_department` - Departments
- `core_lab` - Labs
- `accounts_user` - Users (with roles)
- `accounts_staff` - Staff profiles

### Timetable Tables
- `timetable_subject` - Subjects (common & core)
- `timetable_timeslot` - Time slots (day + period)
- `timetable_entry` - Schedule entries
- `timetable_common_timetable` - Common timetable status
- `timetable_department_timetable` - Dept timetable status

### Workload Tables
- `workload_assignment` - Staff-subject assignments
- `workload_config` - Department workload settings

### Approval Tables
- `approvals_approval` - Approval records
- `approvals_log` - Approval history

---

##🎯 Project Status

| Phase | Task | Status | Completion |
|-------|------|--------|-----------|
| 1 | Foundation | ✅ | 100% |
| 2 | Modeling API | ✅ | 100% |
| 3 | Subject & Lab Config | ⏳ | 0% |
| 4 | Common Timetable Engine | ⏳ | 0% |
| 5 | Approval Workflow | ⏳ | 0% |
| 6 | Workload Allocation | ⏳ | 0% |
| 7 | Dept Timetable Engine | ⏳ | 0% |
| 8 | Manual Override UI | ⏳ | 0% |
| 9 | Final Merge | ⏳ | 0% |
| 10 | Hardening | ⏳ | 0% |

---

## 🚀 Running the Application

### Backend
```bash
cd backend
# Virtual environment already created
D:/campus_grid/backend/venv/Scripts/python.exe manage.py runserver
```
Server runs on `http://localhost:8000`

### Frontend (Coming Next)
```bash
cd frontend
npm install
npm start
```
App runs on `http://localhost:3000`

### Login Credentials
- Email: `admin@campus.com`
- Password: `admin123`

---

## 📝 Next Steps

1. **Phase 3:** Create SubjectViewSet and LabViewSet with full CRUD
2. **Phase 4:** Implement common timetable generation algorithm
3. **Phase 5:** Build approval workflow with multi-step validation
4. Continue with Phase 6-10 as outlined

---

Generated: March 4, 2026
Last Updated: March 4, 2026
