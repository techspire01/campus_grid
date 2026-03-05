from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from core.models import College, Department, Lab, Class
from accounts.models import User, Staff
from core.serializers import CollegeSerializer, DepartmentSerializer, ClassSerializer, LabSerializer, UserSerializer, StaffSerializer, StaffDetailSerializer
from core.permissions import IsSuperAdmin, IsSuperAdminOrCollegeAdmin
from timetable.models import Subject, ClassSubjectMapping, TimetableEntry
import re


CLASS_SPECIAL_SUBJECTS = {
    'LABHRS': {'name': 'Lab Hours', 'is_lab': True, 'hours_per_week': 2},
    'PT': {'name': 'PT', 'is_lab': False, 'hours_per_week': 1},
    'ADDON': {'name': 'Addon Course', 'is_lab': False, 'hours_per_week': 2},
    'PLACEMENT': {'name': 'Placement Training', 'is_lab': False, 'hours_per_week': 2},
    'EDC': {'name': 'EDC', 'is_lab': False, 'hours_per_week': 1},
    'FC': {'name': 'FC', 'is_lab': False, 'hours_per_week': 1},
    'LIB': {'name': 'Library', 'is_lab': False, 'hours_per_week': 1},
}


class CollegeViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Colleges.
    - Only Super Admins can create/edit/delete colleges
    - College Admins can view their college
    - Staff can view their college
    """
    queryset = College.objects.all()
    serializer_class = CollegeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'address']
    ordering_fields = ['name', 'created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return College.objects.all()
        elif user.college:
            return College.objects.filter(id=user.college_id)
        return College.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get statistics for a college"""
        college = self.get_object()
        stats = {
            'total_departments': college.departments.count(),
            'total_staff': Staff.objects.filter(department__college=college).count(),
            'total_labs': college.labs.count(),
            'total_timeslots': college.timeslots.count(),
            'total_subjects': college.subjects.count(),
        }
        return Response(stats)


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Departments.
    - Super Admins can manage all departments
    - College Admins can manage departments in their college
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['college']
    search_fields = ['name', 'code']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return Department.objects.all()
        elif user.college:
            return Department.objects.filter(college=user.college)
        return Department.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()

        if not data.get('college'):
            default_college = getattr(request.user, 'college', None) or College.objects.order_by('id').first()

            if not default_college:
                default_college = College.objects.create(
                    name='Default College',
                    address='Default Address',
                )

            data['college'] = default_college.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['get'])
    def staff_members(self, request, pk=None):
        """Get all staff members in a department"""
        department = self.get_object()
        staff_members = Staff.objects.filter(department=department)
        serializer = StaffSerializer(staff_members, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def hod_info(self, request, pk=None):
        """Get HOD information for a department"""
        department = self.get_object()
        try:
            hod_user = User.objects.get(department=department, role='HOD')
            serializer = UserSerializer(hod_user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response({'detail': 'HOD not assigned'}, status=status.HTTP_404_NOT_FOUND)


class ClassViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Classes.
    - Manage classes (year and section) for departments
    """
    queryset = Class.objects.all()
    serializer_class = ClassSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['department', 'year', 'section']
    search_fields = ['department__name', 'department__code']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return Class.objects.select_related('department').prefetch_related('subject_mappings__subject')
        elif user.college:
            return Class.objects.filter(department__college=user.college).select_related('department').prefetch_related('subject_mappings__subject')
        return Class.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'assign_subject', 'add_subject', 'remove_subject', 'set_special_subjects']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def _validate_subject_for_class(self, class_instance, subject):
        if subject.college_id != class_instance.department.college_id:
            return 'Subject does not belong to the same college as this class'

        if not subject.is_common and subject.department_id != class_instance.department_id:
            return 'Only same-department core subjects can be assigned to this class'

        if subject.year and subject.year != class_instance.year:
            return 'Subject year does not match class year'

        return None

    def _generate_subject_code(self, college, subject_name):
        base = re.sub(r'[^A-Z0-9]+', '', (subject_name or '').upper())[:12] or 'SUB'
        candidate = base
        index = 1

        while Subject.objects.filter(college=college, code=candidate).exists():
            index += 1
            candidate = f"{base}{index}"

        return candidate

    @action(detail=True, methods=['get'])
    def subjects(self, request, pk=None):
        class_instance = self.get_object()
        assigned_subjects = class_instance.subject_mappings.select_related('subject').all().order_by('subject__name')

        return Response([
            {
                'id': mapping.subject.id,
                'name': mapping.subject.name,
                'code': mapping.subject.code,
                'is_lab': mapping.subject.is_lab,
                'hours_per_week': mapping.subject.hours_per_week,
                'year': mapping.subject.year,
                'semester': mapping.subject.semester,
                'staff': mapping.subject.staff_id,
                'staff_details': (
                    {
                        'id': mapping.subject.staff.id,
                        'name': mapping.subject.staff.user.get_full_name(),
                        'email': mapping.subject.staff.user.email,
                        'department': mapping.subject.staff.department.name if mapping.subject.staff.department else None,
                    }
                    if mapping.subject.staff else None
                ),
            }
            for mapping in assigned_subjects
        ])

    @action(detail=True, methods=['post'])
    def assign_subject(self, request, pk=None):
        class_instance = self.get_object()
        subject_id = request.data.get('subject_id')

        if not subject_id:
            return Response({'error': 'subject_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            subject = Subject.objects.get(id=subject_id)
        except Subject.DoesNotExist:
            return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

        validation_error = self._validate_subject_for_class(class_instance, subject)
        if validation_error:
            return Response({'error': validation_error}, status=status.HTTP_400_BAD_REQUEST)

        mapping, created = ClassSubjectMapping.objects.get_or_create(
            class_instance=class_instance,
            subject=subject,
        )

        if not created:
            return Response({'message': 'Subject already assigned to this class'}, status=status.HTTP_200_OK)

        return Response({'message': 'Subject assigned successfully'}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_subject(self, request, pk=None):
        class_instance = self.get_object()

        subject_id = request.data.get('subject_id')
        subject_name = str(request.data.get('name', '')).strip()
        subject_code = str(request.data.get('code', '')).strip().upper()
        is_lab = bool(request.data.get('is_lab', False))
        hours_per_week = request.data.get('hours_per_week', 3)
        total_semester_hours = request.data.get('total_semester_hours', 0)
        subject_type_id = request.data.get('subject_type', None)

        if subject_id:
            try:
                subject = Subject.objects.get(id=subject_id)
                # Update hours fields if subject already exists and values are provided
                if hours_per_week is not None and hours_per_week != '':
                    subject.hours_per_week = int(hours_per_week) if hours_per_week else 3
                if total_semester_hours is not None and total_semester_hours != '':
                    subject.total_semester_hours = int(total_semester_hours) if total_semester_hours else 0
                if subject_type_id:
                    from timetable.models import SubjectType
                    try:
                        subject.subject_type_fk = SubjectType.objects.get(id=subject_type_id)
                    except SubjectType.DoesNotExist:
                        pass
                subject.save()
            except Subject.DoesNotExist:
                return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            if not subject_name:
                return Response({'error': 'name is required when subject_id is not provided'}, status=status.HTTP_400_BAD_REQUEST)

            college = class_instance.department.college

            subject = Subject.objects.filter(
                college=college,
                name__iexact=subject_name,
            ).filter(
                Q(is_common=True) | Q(department=class_instance.department)
            ).first()

            if not subject and subject_code:
                subject = Subject.objects.filter(
                    college=college,
                    code__iexact=subject_code,
                ).first()

            if not subject:
                safe_hours = 3
                try:
                    safe_hours = int(hours_per_week)
                except (TypeError, ValueError):
                    safe_hours = 3

                safe_total_sem_hours = 0
                try:
                    safe_total_sem_hours = int(total_semester_hours)
                except (TypeError, ValueError):
                    safe_total_sem_hours = 0

                # Get subject type object if provided
                subject_type_obj = None
                if subject_type_id:
                    from timetable.models import SubjectType
                    try:
                        subject_type_obj = SubjectType.objects.get(id=subject_type_id)
                    except SubjectType.DoesNotExist:
                        pass

                subject = Subject.objects.create(
                    college=college,
                    department=class_instance.department,
                    name=subject_name,
                    code=subject_code or self._generate_subject_code(college, subject_name),
                    is_common=False,
                    is_lab=is_lab,
                    subject_type_fk=subject_type_obj,
                    hours_per_week=max(1, safe_hours),
                    total_semester_hours=safe_total_sem_hours,
                    year=class_instance.year,
                    semester=None,
                )
            else:
                # Update existing subject with new hours if provided
                if hours_per_week is not None and hours_per_week != '':
                    subject.hours_per_week = int(hours_per_week) if hours_per_week else 3
                if total_semester_hours is not None and total_semester_hours != '':
                    subject.total_semester_hours = int(total_semester_hours) if total_semester_hours else 0
                if subject_type_id:
                    from timetable.models import SubjectType
                    try:
                        subject.subject_type_fk = SubjectType.objects.get(id=subject_type_id)
                    except SubjectType.DoesNotExist:
                        pass
                subject.save()

        validation_error = self._validate_subject_for_class(class_instance, subject)
        if validation_error:
            return Response({'error': validation_error}, status=status.HTTP_400_BAD_REQUEST)

        _, created = ClassSubjectMapping.objects.get_or_create(
            class_instance=class_instance,
            subject=subject,
        )

        return Response(
            {
                'message': 'Subject added to class successfully' if created else 'Subject already assigned to this class',
                'subject': {
                    'id': subject.id,
                    'name': subject.name,
                    'code': subject.code,
                }
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['delete'], url_path=r'subjects/(?P<subject_id>[^/.]+)')
    def remove_subject(self, request, pk=None, subject_id=None):
        class_instance = self.get_object()

        deleted_count, _ = ClassSubjectMapping.objects.filter(
            class_instance=class_instance,
            subject_id=subject_id,
        ).delete()

        if not deleted_count:
            return Response({'error': 'Subject assignment not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'message': 'Subject removed from class successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def set_special_subjects(self, request, pk=None):
        class_instance = self.get_object()
        selected_codes = request.data.get('selected_codes', [])

        if not isinstance(selected_codes, list):
            return Response({'error': 'selected_codes must be an array'}, status=status.HTTP_400_BAD_REQUEST)

        normalized_codes = []
        for code in selected_codes:
            code_value = str(code).strip().upper()
            if code_value not in CLASS_SPECIAL_SUBJECTS:
                return Response({'error': f'Invalid common subject code: {code_value}'}, status=status.HTTP_400_BAD_REQUEST)
            normalized_codes.append(code_value)

        normalized_codes = list(dict.fromkeys(normalized_codes))

        college = class_instance.department.college

        special_subjects_by_code = {}
        for code, subject_data in CLASS_SPECIAL_SUBJECTS.items():
            subject, _ = Subject.objects.get_or_create(
                college=college,
                code=code,
                defaults={
                    'name': subject_data['name'],
                    'department': None,
                    'is_common': True,
                    'is_lab': subject_data['is_lab'],
                    'hours_per_week': subject_data['hours_per_week'],
                    'year': None,
                    'semester': None,
                }
            )
            special_subjects_by_code[code] = subject

        selected_subject_ids = [special_subjects_by_code[code].id for code in normalized_codes]
        all_special_subject_ids = [subject.id for subject in special_subjects_by_code.values()]

        ClassSubjectMapping.objects.filter(
            class_instance=class_instance,
            subject_id__in=all_special_subject_ids,
        ).exclude(subject_id__in=selected_subject_ids).delete()

        for subject_id in selected_subject_ids:
            ClassSubjectMapping.objects.get_or_create(
                class_instance=class_instance,
                subject_id=subject_id,
            )

        serializer = self.get_serializer(class_instance)
        return Response({
            'message': 'Common subjects updated successfully',
            'class': serializer.data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def tutors(self, request, pk=None):
        """Get all tutors assigned to a class"""
        class_instance = self.get_object()
        tutors = class_instance.tutors.all()
        tutors_data = [
            {
                'id': tutor.id,
                'user_id': tutor.user.id,
                'name': tutor.user.get_full_name(),
                'email': tutor.user.email,
                'department': tutor.department.name if tutor.department else None,
            }
            for tutor in tutors
        ]
        return Response(tutors_data)

    @action(detail=True, methods=['post'])
    def assign_tutors(self, request, pk=None):
        """Assign tutors to a class"""
        class_instance = self.get_object()
        tutor_ids = request.data.get('tutor_ids', [])

        if not isinstance(tutor_ids, list):
            return Response({'error': 'tutor_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tutors = Staff.objects.filter(id__in=tutor_ids)
            if len(tutors) != len(tutor_ids):
                return Response({'error': 'One or more tutors not found'}, status=status.HTTP_404_NOT_FOUND)
            
            class_instance.tutors.set(tutors)
            serializer = self.get_serializer(class_instance)
            return Response({
                'message': 'Tutors assigned successfully',
                'class': serializer.data,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class LabViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Labs.
    - Super Admins can manage all labs
    - College Admins can manage labs in their college
    """
    queryset = Lab.objects.all()
    serializer_class = LabSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['college']
    search_fields = ['name', 'code']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return Lab.objects.all()
        elif user.college:
            return Lab.objects.filter(college=user.college)
        return Lab.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()

        if not data.get('college'):
            default_college = getattr(request.user, 'college', None) or College.objects.order_by('id').first()

            if not default_college:
                default_college = College.objects.create(
                    name='Default College',
                    address='Default Address',
                )

            data['college'] = default_college.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['get'])
    def practical_timetable(self, request, pk=None):
        lab = self.get_object()
        entries = (
            TimetableEntry.objects
            .filter(lab=lab, subject__is_lab=True)
            .select_related('subject', 'staff__user', 'timeslot')
            .order_by('timeslot__day_order', 'timeslot__period_number', 'class_name')
        )

        timetable = [
            {
                'entry_id': entry.id,
                'class_name': entry.class_name,
                'subject_name': entry.subject.name if entry.subject else None,
                'subject_code': entry.subject.code if entry.subject else None,
                'staff_name': entry.staff.user.get_full_name() if entry.staff else None,
                'day_order': entry.timeslot.day_order if entry.timeslot else None,
                'period_number': entry.timeslot.period_number if entry.timeslot else None,
                'start_time': entry.timeslot.start_time.strftime('%H:%M') if entry.timeslot and entry.timeslot.start_time else None,
                'end_time': entry.timeslot.end_time.strftime('%H:%M') if entry.timeslot and entry.timeslot.end_time else None,
            }
            for entry in entries
        ]

        return Response({
            'lab_id': lab.id,
            'lab_name': lab.name,
            'count': len(timetable),
            'timetable': timetable,
        })


class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Users.
    - Super Admins can manage all users
    - College Admins can manage users in their college
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['role', 'college', 'department', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return User.objects.all()
        elif user.college:
            return User.objects.filter(college=user.college)
        return User.objects.filter(id=user.id)
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user information"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def hods(self, request):
        """Get all HODs in user's college"""
        user = request.user
        if user.is_super_admin():
            hods = User.objects.filter(role='HOD')
        elif user.college:
            hods = User.objects.filter(college=user.college, role='HOD')
        else:
            hods = User.objects.none()
        
        serializer = UserSerializer(hods, many=True)
        return Response(serializer.data)


class StaffViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Staff.
    - Super Admins can manage all staff
    - College Admins can manage staff in their college
    - HODs can manage staff in their department
    """
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['department']
    search_fields = ['user__first_name', 'user__last_name', 'user__email']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return Staff.objects.all()
        elif user.is_college_admin() and user.college:
            return Staff.objects.filter(
                Q(department__college=user.college) |
                Q(department__isnull=True, user__college=user.college)
            )
        elif user.is_hod() and user.department:
            return Staff.objects.filter(department=user.department)
        return Staff.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return StaffDetailSerializer
        return StaffSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['patch'])
    def set_workload(self, request, pk=None):
        """Set maximum workload hours for a staff member"""
        staff = self.get_object()
        max_hours = request.data.get('max_workload_hours')
        
        if max_hours is None:
            return Response({'error': 'max_workload_hours is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            max_hours = int(max_hours)
            if max_hours < 0:
                raise ValueError
        except ValueError:
            return Response({'error': 'max_workload_hours must be a positive integer'}, status=status.HTTP_400_BAD_REQUEST)
        
        staff.max_workload_hours = max_hours
        staff.save()
        
        serializer = self.get_serializer(staff)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def workload_status(self, request, pk=None):
        """Get workload status for a staff member"""
        staff = self.get_object()
        return Response({
            'max_workload_hours': staff.max_workload_hours,
            'current_workload_hours': staff.current_workload_hours,
            'remaining_hours': staff.remaining_workload_hours(),
            'utilization_percentage': (staff.current_workload_hours / staff.max_workload_hours * 100) if staff.max_workload_hours > 0 else 0,
        })

