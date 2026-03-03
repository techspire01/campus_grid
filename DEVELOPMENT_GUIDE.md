# Campus Timetable Scheduler - Development Guide

## 10-Phase Development Implementation

### Phase 1: Project Foundation ✓ COMPLETED
- Django project setup with 5 apps (core, accounts, timetable, workload, approvals)
- PostgreSQL configured (using SQLite for dev)
- All models created with proper relationships
- Database migrations generated

---

## Tech Stack
- **Backend:** Django 5.0.1 + Django REST Framework
- **Frontend:** React 18.x + MUI
- **Database:** PostgreSQL (SQLite for development)
- **Authentication:** Token-based JWT (custom implementation)
- **Real-time:** WebSockets (future implementation)

---

## Database Schema Overview

### Core Models
- `College` - Institution details (working days, periods, duration)
- `Department` - Multiple departments per college
- `Lab` - Lab facilities with capacity

### Authentication
- `User` - Custom user model with roles (SUPER_ADMIN, COLLEGE_ADMIN, HOD, LAB_INCHARGE, COMMON_SUBJECT_HEAD, STAFF, STUDENT)
- `Staff` - Staff members with max_workload_hours and current_workload_hours

### Timetable
- `Subject` - Core and common subjects
- `TimeSlot` - Day/Period slots with common_locked flag
- `TimetableEntry` - Actual schedule entries
- `CommonTimetable` - Common timetable with approval workflow
- `DepartmentTimetable` - Department-specific schedule

### Workload
- `WorkloadAssignment` - Staff assignments with hours
- `WorkloadConfig` - Department-level workload settings

### Approvals
- `Approval` - Multi-level approval workflow
- `ApprovalLog` - Audit trail

---

## Key Features Implementation

### Approval Workflow
1. College Admin generates common timetable
2. Lab Incharge approves (if labs are involved)
3. Common Subject Department Heads approve (Tamil, English, etc.)
4. Only after ALL approvals → Status = LOCKED

### Workload Assignment
- Only department HOD can assign workload to their staff
- Cannot exceed max_workload_hours set by admin
- Validates against subject hours_per_week

### Timetable Generation
- Allocate labs first (hardest constraint)
- Then allocate core subjects
- Validate staff availability and workload
- Return suggestion (not final)

---

## Running the Development Server

### Backend
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm start
```

---

## Next Phases
- Phase 2: Institution Structure Modeling + APIs
- Phase 3: Subject & Lab Configuration
- Phase 4: Common Timetable Generation Engine
- Phase 5: Approval Workflow APIs
- Phase 6: Workload Assignment APIs
- Phase 7: Department Timetable Suggestion Engine
- Phase 8: Manual Override + Drag & Drop UI
- Phase 9: Final Merge & Publishing
- Phase 10: Performance & Security Hardening

---

## Database Design Constraints
- UNIQUE(staff_id, timeslot_id) - Prevents staff clash
- UNIQUE(class_id, timeslot_id) - Prevents class clash
- UNIQUE(lab_id, timeslot_id) - Prevents lab clash
- is_common_locked prevents editing common slots
- Cascading deletes for data integrity

---

## Authentication Flow
1. User logs in with email + password
2. Backend generates JWT token
3. Frontend stores token in localStorage
4. All requests include token in Authorization header
5. Backend validates token and enforces role-based permissions

---

## Development Checklist
- [x] Django project setup
- [x] App structure created
- [x] All models defined
- [x] Migrations generated
- [ ] Database migrations applied
- [ ] Serializers created
- [ ] ViewSets created
- [ ] URL routing configured
- [ ] React frontend initialized
- [ ] Authentication pages
- [ ] Admin panel design
- [ ] Timetable grid component
- [ ] Approval workflow UI
- [ ] Workload assignment UI
- [ ] Scheduling engine implementation
- [ ] Manual override system
- [ ] Final deployment

---

Generated: March 4, 2026
Status: Phase 1 Complete - Ready for Phase 2
