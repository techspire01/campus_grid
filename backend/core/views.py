from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from core.models import College, Department, Lab
from accounts.models import User, Staff
from core.serializers import CollegeSerializer, DepartmentSerializer, LabSerializer, UserSerializer, StaffSerializer, StaffDetailSerializer
from core.permissions import IsSuperAdmin, IsSuperAdminOrCollegeAdmin


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
    filterset_fields = ['college', 'is_available']
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
            return Staff.objects.filter(department__college=user.college)
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

