from rest_framework import viewsets, status, filters, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from timetable.models import Subject, TimeSlot, TimetableEntry, CommonTimetable, DepartmentTimetable
from timetable.serializers import (
    SubjectSerializer, TimeSlotSerializer, TimetableEntrySerializer,
    CommonTimetableSerializer, DepartmentTimetableSerializer
)
from core.permissions import IsSuperAdmin, IsSuperAdminOrCollegeAdmin, IsCollegeAdmin, IsHOD


class SubjectViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Subjects.
    - Common subjects: Tamil, English, Maths, PT, Library, Activity, EDC, FC
    - Core subjects: Department-specific subjects
    
    Endpoints:
    - GET /api/subjects/ - List subjects
    - POST /api/subjects/ - Create subject
    - GET /api/subjects/{id}/ - Get subject
    - PUT /api/subjects/{id}/ - Update subject
    - DELETE /api/subjects/{id}/ - Delete subject
    
    Filters: college, department, is_common, is_lab, year, semester
    """
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['college', 'department', 'is_common', 'is_lab', 'year', 'semester']
    search_fields = ['name', 'code']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return Subject.objects.all()
        elif user.college:
            return Subject.objects.filter(college=user.college)
        return Subject.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """Validate subject creation"""
        user = self.request.user
        is_common = serializer.validated_data.get('is_common', False)
        department = serializer.validated_data.get('department')
        
        # Common subjects cannot have a department
        if is_common and department:
            raise serializers.ValidationError({
                'department': 'Common subjects cannot belong to a department'
            })
        
        # Core subjects must have a department
        if not is_common and not department:
            raise serializers.ValidationError({
                'department': 'Core subjects must belong to a department'
            })
        
        serializer.save()
    
    def perform_update(self, serializer):
        """Validate subject update"""
        instance = serializer.instance
        
        # Get values from validated_data or fall back to instance values for partial updates
        is_common = serializer.validated_data.get('is_common', instance.is_common)
        department = serializer.validated_data.get('department', instance.department)
        
        # Common subjects cannot have a department
        if is_common and department:
            raise serializers.ValidationError({
                'department': 'Common subjects cannot belong to a department'
            })
        
        # Core subjects must have a department
        if not is_common and not department:
            raise serializers.ValidationError({
                'department': 'Core subjects must belong to a department'
            })
        
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def assign_staff(self, request, pk=None):
        """Assign a staff member to a subject"""
        try:
            subject = self.get_object()
            staff_id = request.data.get('staff')

            # Allow explicit unassignment
            if staff_id in [None, '']:
                Subject.objects.filter(id=subject.id).update(staff_id=None)
                subject.refresh_from_db()
                serializer = self.get_serializer(subject)
                return Response(
                    {
                        'message': 'Staff removed from subject',
                        'subject': serializer.data
                    },
                    status=status.HTTP_200_OK
                )

            from accounts.models import Staff
            try:
                staff = Staff.objects.get(id=staff_id)

                # Same-college guard (when department is available)
                if (
                    subject.department
                    and staff.department
                    and subject.department.college_id != staff.department.college_id
                ):
                    return Response(
                        {'error': 'Staff must belong to the same college as the subject'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Save directly in DB table to ensure persistence.
                Subject.objects.filter(id=subject.id).update(staff_id=staff.id)
                subject.refresh_from_db()
                serializer = self.get_serializer(subject)
                return Response(
                    {
                        'message': 'Staff assigned successfully',
                        'subject': serializer.data
                    },
                    status=status.HTTP_200_OK
                )
            except Staff.DoesNotExist:
                return Response({'error': 'Staff member not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TimeSlotViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Time Slots.
    - Represents each period in a day (e.g., Day 1, Period 1)
    
    Endpoints:
    - GET /api/timeslots/ - List time slots
    - POST /api/timeslots/ - Create time slot
    - POST /api/timeslots/generate/ - Generate all time slots for a college
    """
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['college', 'day_order', 'is_common_locked']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return TimeSlot.objects.all()
        elif user.college:
            return TimeSlot.objects.filter(college=user.college)
        return TimeSlot.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'generate']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generate time slots for a college based on configuration.
        
        Request:
        {
            "college_id": 1,
            "working_days": 6,
            "periods_per_day": 5
        }
        
        This will create all time slots for the college.
        """
        college_id = request.data.get('college_id')
        working_days = request.data.get('working_days', 6)
        periods_per_day = request.data.get('periods_per_day', 5)
        
        from core.models import College
        
        try:
            if request.user.is_super_admin():
                college = College.objects.get(id=college_id)
            else:
                college = College.objects.get(id=college_id)
        except College.DoesNotExist:
            return Response(
                {'error': 'College not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Delete existing timeslots if any
        existing_count = TimeSlot.objects.filter(college=college).count()
        if existing_count > 0:
            TimeSlot.objects.filter(college=college).delete()
        
        # Generate new timeslots
        created_slots = []
        for day in range(1, working_days + 1):
            for period in range(1, periods_per_day + 1):
                timeslot = TimeSlot.objects.create(
                    college=college,
                    day_order=day,
                    period_number=period,
                    is_common_locked=False
                )
                created_slots.append(timeslot)
        
        return Response({
            'message': f'Generated {len(created_slots)} time slots',
            'college': college.name,
            'working_days': working_days,
            'periods_per_day': periods_per_day,
            'total_slots': len(created_slots)
        })


class TimetableEntryViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Timetable Entries.
    
    Endpoints:
    - GET /api/timetable-entries/ - List entries
    - POST /api/timetable-entries/ - Create entry
    - PATCH /api/timetable-entries/{id}/move/ - Move entry to new slot
    """
    queryset = TimetableEntry.objects.all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['college', 'department', 'class_name', 'subject__is_common', 'is_common']
    search_fields = ['class_name', 'subject__name', 'staff__user__first_name']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return TimetableEntry.objects.all()
        elif user.college:
            return TimetableEntry.objects.filter(college=user.college)
        elif user.department:
            return TimetableEntry.objects.filter(department=user.department)
        return TimetableEntry.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'move']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['patch'])
    def move(self, request, pk=None):
        """
        Move a timetable entry to a new time slot.
        
        Request:
        {
            "timeslot_id": 10
        }
        
        Validates:
        - Staff availability
        - Class availability
        - Lab availability
        - Workload limit
        - Common slot lock
        """
        entry = self.get_object()
        new_timeslot_id = request.data.get('timeslot_id')
        
        if not new_timeslot_id:
            return Response(
                {'error': 'timeslot_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            new_timeslot = TimeSlot.objects.get(id=new_timeslot_id)
        except TimeSlot.DoesNotExist:
            return Response(
                {'error': 'Time slot not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if new slot is locked
        if new_timeslot.is_common_locked:
            return Response({
                'valid': False,
                'errors': ['Cannot move to a locked common slot']
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check for conflicts
        errors = []
        
        # Check staff availability
        if entry.staff:
            staff_clash = TimetableEntry.objects.filter(
                college=entry.college,
                timeslot=new_timeslot,
                staff=entry.staff
            ).exclude(id=entry.id).exists()
            
            if staff_clash:
                errors.append(f"Staff {entry.staff.user.get_full_name()} is already assigned to another class at this time")
        
        # Check class availability
        class_clash = TimetableEntry.objects.filter(
            college=entry.college,
            timeslot=new_timeslot,
            class_name=entry.class_name
        ).exclude(id=entry.id).exists()
        
        if class_clash:
            errors.append(f"Class {entry.class_name} already has a subject at this time")
        
        # Check lab availability
        if entry.lab:
            lab_clash = TimetableEntry.objects.filter(
                college=entry.college,
                timeslot=new_timeslot,
                lab=entry.lab
            ).exclude(id=entry.id).exists()
            
            if lab_clash:
                errors.append(f"Lab {entry.lab.name} is not available at this time")
        
        if errors:
            return Response({
                'valid': False,
                'errors': errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Move the entry
        entry.timeslot = new_timeslot
        entry.save()
        
        serializer = self.get_serializer(entry)
        return Response({
            'valid': True,
            'entry': serializer.data,
            'message': 'Entry moved successfully'
        })


class CommonTimetableViewSet(viewsets.ModelViewSet):
    """
    Manage Common Timetable.
    
    Endpoints:
    - GET /api/common-timetable/ - List common timetables
    - POST /api/common-timetable/ - Create common timetable
    - POST /api/common-timetable/generate/ - Generate common timetable
    - POST /api/common-timetable/submit/ - Submit for approval
    - POST /api/common-timetable/lock/ - Lock after approvals
    """
    queryset = CommonTimetable.objects.all()
    serializer_class = CommonTimetableSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['college', 'status']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return CommonTimetable.objects.all()
        elif user.college:
            return CommonTimetable.objects.filter(college=user.college)
        return CommonTimetable.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'generate', 'submit', 'lock']:
            permission_classes = [IsCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generate common timetable for a college.
        
        Request:
        {
            "college_id": 1,
            "enable_addons": true
        }
        
        Common subjects: Tamil, English, Maths, PT, Library, Activity, EDC, FC
        """
        college_id = request.data.get('college_id')
        enable_addons = request.data.get('enable_addons', False)
        
        from core.models import College
        
        try:
            if request.user.is_super_admin():
                college = College.objects.get(id=college_id)
            else:
                college = College.objects.get(id=college_id)
        except College.DoesNotExist:
            return Response(
                {'error': 'College not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get or create common timetable
        common_tt, created = CommonTimetable.objects.get_or_create(
            college=college,
            defaults={
                'status': 'DRAFT',
                'created_by': request.user
            }
        )
        
        if not created and common_tt.status != 'DRAFT':
            return Response(
                {'error': f'Cannot regenerate. Current status is {common_tt.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delete existing common entries
        TimetableEntry.objects.filter(college=college, is_common=True).delete()
        
        # Get common subjects
        common_subjects = Subject.objects.filter(
            college=college,
            is_common=True
        )
        
        if not common_subjects.exists():
            return Response(
                {'error': 'No common subjects found. Please create common subjects first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get available timeslots
        timeslots = TimeSlot.objects.filter(
            college=college
        ).order_by('day_order', 'period_number')
        
        if not timeslots.exists():
            return Response(
                {'error': 'No timeslots found. Please generate timeslots first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Simple distribution algorithm
        entries_created = []
        timeslot_list = list(timeslots)
        
        for i, subject in enumerate(common_subjects):
            # Distribute subjects evenly across available slots
            slot_index = i % len(timeslot_list)
            timeslot = timeslot_list[slot_index]
            
            # Create entry for each class (1st, 2nd, 3rd year)
            for year in [1, 2, 3]:
                class_name = f"{year}st Year"
                
                # Skip EDC and FC for 3rd year
                if year == 3 and subject.code in ['EDC', 'FC']:
                    continue
                
                # Skip Add-ons if not enabled
                if subject.code == 'ADDON' and not enable_addons:
                    continue
                
                entry = TimetableEntry.objects.create(
                    college=college,
                    class_name=class_name,
                    subject=subject,
                    timeslot=timeslot,
                    is_common=True
                )
                entries_created.append(entry)
        
        common_tt.status = 'DRAFT'
        common_tt.save()
        
        serializer = self.get_serializer(common_tt)
        return Response({
            'message': f'Generated {len(entries_created)} common timetable entries',
            'common_timetable': serializer.data,
            'entries_count': len(entries_created)
        })
    
    @action(detail=False, methods=['post'])
    def submit(self, request):
        """
        Submit common timetable for approval.
        Creates approval records for Lab Incharge and Common Subject Heads.
        """
        college_id = request.data.get('college_id')
        
        from core.models import College
        from approvals.models import Approval
        
        try:
            college = College.objects.get(id=college_id)
        except College.DoesNotExist:
            return Response(
                {'error': 'College not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            common_tt = CommonTimetable.objects.get(college=college)
        except CommonTimetable.DoesNotExist:
            return Response(
                {'error': 'Common timetable not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if common_tt.status != 'DRAFT':
            return Response(
                {'error': f'Cannot submit. Current status is {common_tt.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if labs are involved in common timetable
        has_labs = TimetableEntry.objects.filter(
            college=college,
            is_common=True,
            subject__is_lab=True
        ).exists()
        
        # Create approval records
        approvals_created = []
        
        # Lab Incharge approval (if labs exist)
        if has_labs:
            lab_approval, _ = Approval.objects.get_or_create(
                common_timetable=common_tt,
                approver_role='LAB_INCHARGE',
                defaults={'status': 'PENDING'}
            )
            approvals_created.append('LAB_INCHARGE')
        
        # Common Subject Head approvals
        common_subjects = Subject.objects.filter(college=college, is_common=True)
        for subject in common_subjects:
            # Get or create approval for each common subject department
            # For now, create one approval per common subject
            approval, _ = Approval.objects.get_or_create(
                common_timetable=common_tt,
                approver_role='COMMON_SUBJECT_HEAD',
                defaults={'status': 'PENDING', 'comment': f'Approval needed for {subject.name}'}
            )
            if approval.approver_role not in approvals_created:
                approvals_created.append(approval.approver_role)
        
        common_tt.status = 'PENDING_APPROVAL'
        common_tt.save()
        
        serializer = self.get_serializer(common_tt)
        return Response({
            'message': 'Common timetable submitted for approval',
            'common_timetable': serializer.data,
            'approvals_required': approvals_created
        })
    
    @action(detail=False, methods=['post'])
    def lock(self, request):
        """
        Lock common timetable after all approvals are complete.
        """
        college_id = request.data.get('college_id')
        
        from core.models import College
        from approvals.models import Approval
        
        try:
            college = College.objects.get(id=college_id)
        except College.DoesNotExist:
            return Response(
                {'error': 'College not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            common_tt = CommonTimetable.objects.get(college=college)
        except CommonTimetable.DoesNotExist:
            return Response(
                {'error': 'Common timetable not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check all approvals
        pending_approvals = Approval.objects.filter(
            common_timetable=common_tt,
            status='PENDING'
        )
        
        if pending_approvals.exists():
            return Response({
                'error': 'Cannot lock. There are pending approvals.',
                'pending_approvals': pending_approvals.count()
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Lock the timetable
        common_tt.status = 'LOCKED'
        common_tt.save()
        
        # Lock all timeslots used by common timetable
        common_entry_timeslots = TimetableEntry.objects.filter(
            college=college,
            is_common=True
        ).values_list('timeslot_id', flat=True)
        
        TimeSlot.objects.filter(id__in=common_entry_timeslots).update(is_common_locked=True)
        
        serializer = self.get_serializer(common_tt)
        return Response({
            'message': 'Common timetable locked successfully',
            'common_timetable': serializer.data
        })


class DepartmentTimetableViewSet(viewsets.ModelViewSet):
    """
    Manage Department Timetable.
    
    Endpoints:
    - GET /api/department-timetable/ - List department timetables
    - POST /api/department-timetable/generate/ - Generate department timetable
    - POST /api/department-timetable/save/ - Save as draft
    - POST /api/department-timetable/publish/ - Publish timetable
    """
    queryset = DepartmentTimetable.objects.all()
    serializer_class = DepartmentTimetableSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['college', 'department', 'status']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return DepartmentTimetable.objects.all()
        elif user.college:
            return DepartmentTimetable.objects.filter(college=user.college)
        elif user.department:
            return DepartmentTimetable.objects.filter(department=user.department)
        return DepartmentTimetable.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'generate', 'save', 'publish']:
            permission_classes = [IsHOD]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generate department timetable.
        
        Request:
        {
            "department_id": 1
        }
        
        Algorithm:
        1. Get locked common timeslots (exclude these)
        2. Get workload assignments for department
        3. Allocate labs first (continuous slots)
        4. Allocate core subjects
        5. Validate and return suggestions
        """
        department_id = request.data.get('department_id')
        
        from core.models import Department
        
        user = request.user
        
        # Only HOD of the department can generate
        if not user.is_hod() or user.department_id != department_id:
            return Response(
                {'error': 'Only HOD of the department can generate timetable'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            department = Department.objects.get(id=department_id)
        except Department.DoesNotExist:
            return Response(
                {'error': 'Department not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        college = department.college
        
        # Get locked common timeslots
        locked_timeslots = TimeSlot.objects.filter(
            college=college,
            is_common_locked=True
        ).values_list('id', flat=True)
        
        # Get available timeslots
        available_timeslots = TimeSlot.objects.filter(
            college=college
        ).exclude(id__in=locked_timeslots).order_by('day_order', 'period_number')
        
        if not available_timeslots.exists():
            return Response(
                {'error': 'No available timeslots. Common timetable may have locked all slots.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get workload assignments for this department
        from workload.models import WorkloadAssignment
        workload_assignments = WorkloadAssignment.objects.filter(
            department=department,
            is_approved=True
        ).select_related('subject', 'staff')
        
        if not workload_assignments.exists():
            return Response(
                {'error': 'No approved workload assignments found. Please assign workload first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delete existing department entries
        TimetableEntry.objects.filter(
            college=college,
            department=department,
            is_common=False
        ).delete()
        
        # Group subjects by lab vs theory
        lab_subjects = workload_assignments.filter(subject__is_lab=True)
        theory_subjects = workload_assignments.filter(subject__is_lab=False)
        
        entries_created = []
        timeslot_list = list(available_timeslots)
        
        # Step 1: Allocate Labs First (need continuous slots)
        for assignment in lab_subjects:
            subject = assignment.subject
            staff = assignment.staff
            class_name = assignment.class_name
            
            # Find continuous slots (2 hours for lab)
            lab_hours = min(subject.hours_per_week, 3)  # Max 3 hours
            
            for slot_idx in range(len(timeslot_list) - lab_hours + 1):
                # Check if we can allocate continuous slots
                can_allocate = True
                selected_slots = []
                
                for h in range(int(lab_hours)):
                    slot = timeslot_list[slot_idx + h]
                    
                    # Check if slot is already used
                    if TimetableEntry.objects.filter(
                        college=college,
                        timeslot=slot
                    ).exists():
                        can_allocate = False
                        break
                    selected_slots.append(slot)
                
                if can_allocate and selected_slots:
                    # Find available lab
                    lab = None
                    labs = Lab.objects.filter(college=college, is_available=True)
                    if assignment.subject.department:
                        labs = labs.filter(department=assignment.subject.department)
                    
                    lab = labs.first()
                    
                    for slot in selected_slots:
                        entry = TimetableEntry.objects.create(
                            college=college,
                            department=department,
                            class_name=class_name,
                            subject=subject,
                            staff=staff,
                            timeslot=slot,
                            lab=lab,
                            is_common=False
                        )
                        entries_created.append(entry)
                    
                    # Remove used slots from available list
                    for slot in selected_slots:
                        timeslot_list.remove(slot)
                    
                    break
        
        # Step 2: Allocate Theory Subjects
        for assignment in theory_subjects:
            subject = assignment.subject
            staff = assignment.staff
            class_name = assignment.class_name
            hours = subject.hours_per_week
            
            for h in range(hours):
                if not timeslot_list:
                    break
                
                # Find first available slot
                slot = timeslot_list[0]
                
                # Check if staff is available
                if TimetableEntry.objects.filter(
                    college=college,
                    timeslot=slot,
                    staff=staff
                ).exists():
                    # Try next slot
                    timeslot_list.pop(0)
                    continue
                
                entry = TimetableEntry.objects.create(
                    college=college,
                    department=department,
                    class_name=class_name,
                    subject=subject,
                    staff=staff,
                    timeslot=slot,
                    is_common=False
                )
                entries_created.append(entry)
                
                # Remove used slot
                timeslot_list.pop(0)
        
        # Create or update department timetable record
        dept_tt, _ = DepartmentTimetable.objects.get_or_create(
            department=department,
            defaults={
                'college': college,
                'status': 'DRAFT',
                'created_by': user
            }
        )
        dept_tt.status = 'DRAFT'
        dept_tt.save()
        
        serializer = self.get_serializer(dept_tt)
        return Response({
            'message': f'Generated {len(entries_created)} department timetable entries',
            'department_timetable': serializer.data,
            'entries_count': len(entries_created)
        })
    
    @action(detail=False, methods=['post'])
    def publish(self, request):
        """
        Publish department timetable.
        """
        department_id = request.data.get('department_id')
        
        from core.models import Department
        
        user = request.user
        
        if not user.is_hod() or user.department_id != department_id:
            return Response(
                {'error': 'Only HOD of the department can publish timetable'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            dept_tt = DepartmentTimetable.objects.get(department_id=department_id)
        except DepartmentTimetable.DoesNotExist:
            return Response(
                {'error': 'Department timetable not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        dept_tt.status = 'PUBLISHED'
        dept_tt.save()
        
        serializer = self.get_serializer(dept_tt)
        return Response({
            'message': 'Department timetable published successfully',
            'department_timetable': serializer.data
        })


# Import Lab model for use in DepartmentTimetableViewSet
from core.models import Lab


class TimetableMergeViewSet(viewsets.ViewSet):
    """
    Merge API for combined view of common and department timetables.
    
    Endpoints:
    - GET /api/timetable/merged/ - Get merged timetable
    - GET /api/timetable/conflicts/ - Get all conflicts
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """
        Get merged timetable (common + department).
        
        Query params:
        - college_id: Filter by college
        - department_id: Filter by department
        - class_name: Filter by class
        """
        college_id = request.query_params.get('college_id')
        department_id = request.query_params.get('department_id')
        class_name = request.query_params.get('class_name')
        
        user = request.user
        
        # Determine college
        if college_id:
            from core.models import College
            try:
                college = College.objects.get(id=college_id)
            except College.DoesNotExist:
                return Response(
                    {'error': 'College not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        elif user.college:
            college = user.college
        else:
            return Response(
                {'error': 'College ID required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build query
        entries = TimetableEntry.objects.filter(college=college).select_related(
            'subject', 'timeslot', 'staff__user', 'lab', 'department'
        )
        
        if department_id:
            entries = entries.filter(department_id=department_id)
        
        if class_name:
            entries = entries.filter(class_name=class_name)
        
        # Organize by timeslot
        merged_data = {}
        for entry in entries:
            slot_key = f"{entry.timeslot.day_order}_{entry.timeslot.period_number}"
            if slot_key not in merged_data:
                merged_data[slot_key] = {
                    'day': entry.timeslot.day_order,
                    'period': entry.timeslot.period_number,
                    'timeslot_id': entry.timeslot.id,
                    'entries': []
                }
            
            merged_data[slot_key]['entries'].append({
                'id': entry.id,
                'class_name': entry.class_name,
                'subject': entry.subject.name if entry.subject else None,
                'subject_code': entry.subject.code if entry.subject else None,
                'staff': entry.staff.user.get_full_name() if entry.staff else None,
                'lab': entry.lab.name if entry.lab else None,
                'is_common': entry.is_common,
                'department': entry.department.name if entry.department else None
            })
        
        # Convert to sorted list
        result = sorted(merged_data.values(), key=lambda x: (x['day'], x['period']))
        
        return Response({
            'college': college.name,
            'total_entries': len(entries),
            'timetable': result
        })
    
    @action(detail=False, methods=['get'])
    def conflicts(self, request):
        """
        Get all conflicts in the timetable.
        
        Returns list of staff clashes, class clashes, and lab clashes.
        """
        college_id = request.query_params.get('college_id')
        user = request.user
        
        if college_id:
            from core.models import College
            try:
                college = College.objects.get(id=college_id)
            except College.DoesNotExist:
                return Response(
                    {'error': 'College not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        elif user.college:
            college = user.college
        else:
            return Response(
                {'error': 'College ID required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        entries = TimetableEntry.objects.filter(college=college).select_related(
            'timeslot', 'staff__user', 'lab'
        )
        
        conflicts = []
        
        # Check staff clashes
        staff_slots = {}
        for entry in entries:
            if entry.staff and entry.timeslot:
                key = f"{entry.timeslot.id}_{entry.staff.id}"
                if key in staff_slots:
                    conflicts.append({
                        'type': 'STAFF_CLASH',
                        'staff': entry.staff.user.get_full_name(),
                        'timeslot': str(entry.timeslot),
                        'entries': [staff_slots[key], entry.id]
                    })
                else:
                    staff_slots[key] = entry.id
        
        # Check class clashes
        class_slots = {}
        for entry in entries:
            if entry.timeslot:
                key = f"{entry.timeslot.id}_{entry.class_name}"
                if key in class_slots:
                    conflicts.append({
                        'type': 'CLASS_CLASH',
                        'class': entry.class_name,
                        'timeslot': str(entry.timeslot),
                        'entries': [class_slots[key], entry.id]
                    })
                else:
                    class_slots[key] = entry.id
        
        # Check lab clashes
        lab_slots = {}
        for entry in entries:
            if entry.lab and entry.timeslot:
                key = f"{entry.timeslot.id}_{entry.lab.id}"
                if key in lab_slots:
                    conflicts.append({
                        'type': 'LAB_CLASH',
                        'lab': entry.lab.name,
                        'timeslot': str(entry.timeslot),
                        'entries': [lab_slots[key], entry.id]
                    })
                else:
                    lab_slots[key] = entry.id
        
        return Response({
            'has_conflicts': len(conflicts) > 0,
            'conflict_count': len(conflicts),
            'conflicts': conflicts
        })


class TimetableExportViewSet(viewsets.ViewSet):
    """
    Export functionality for timetable.
    
    Endpoints:
    - GET /api/timetable/export/pdf/ - Export as PDF
    - GET /api/timetable/export/csv/ - Export as CSV
    - GET /api/timetable/export/excel/ - Export as Excel
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """
        Export timetable data.
        
        Query params:
        - college_id: College ID
        - format: pdf, csv, or excel
        - department_id: Optional department filter
        """
        college_id = request.query_params.get('college_id')
        export_format = request.query_params.get('format', 'csv')
        department_id = request.query_params.get('department_id')
        
        user = request.user
        
        if college_id:
            from core.models import College
            try:
                college = College.objects.get(id=college_id)
            except College.DoesNotExist:
                return Response(
                    {'error': 'College not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        elif user.college:
            college = user.college
        else:
            return Response(
                {'error': 'College ID required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get entries
        entries = TimetableEntry.objects.filter(college=college).select_related(
            'subject', 'timeslot', 'staff__user', 'lab', 'department'
        ).order_by('timeslot__day_order', 'timeslot__period_number')
        
        if department_id:
            entries = entries.filter(department_id=department_id)
        
        # Prepare data for export
        export_data = []
        for entry in entries:
            export_data.append({
                'Day': entry.timeslot.day_order,
                'Period': entry.timeslot.period_number,
                'Class': entry.class_name,
                'Subject': entry.subject.name if entry.subject else '',
                'Subject_Code': entry.subject.code if entry.subject else '',
                'Staff': entry.staff.user.get_full_name() if entry.staff else '',
                'Lab': entry.lab.name if entry.lab else '',
                'Type': 'Common' if entry.is_common else 'Department',
                'Department': entry.department.name if entry.department else ''
            })
        
        if export_format == 'csv':
            import csv
            import io
            
            output = io.StringIO()
            if export_data:
                writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
                writer.writeheader()
                writer.writerows(export_data)
            
            return Response({
                'format': 'csv',
                'data': output.getvalue(),
                'count': len(export_data)
            })
        
        elif export_format == 'excel':
            return Response({
                'format': 'excel',
                'message': 'Excel export not yet implemented',
                'data': export_data,
                'count': len(export_data)
            })
        
        elif export_format == 'pdf':
            return Response({
                'format': 'pdf',
                'message': 'PDF export not yet implemented',
                'data': export_data,
                'count': len(export_data)
            })
        
        return Response(
            {'error': 'Invalid format. Use csv, excel, or pdf'},
            status=status.HTTP_400_BAD_REQUEST
        )

