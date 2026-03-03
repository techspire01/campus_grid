from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from workload.models import WorkloadAssignment, WorkloadConfig
from workload.serializers import WorkloadAssignmentSerializer, WorkloadConfigSerializer
from core.permissions import IsSuperAdminOrCollegeAdmin, IsHOD
from accounts.models import Staff


class WorkloadAssignmentViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Workload Assignments.
    - Only HODs can assign workload to their department staff
    - Super Admins can view all workload assignments
    - College Admins can view workload assignments in their college
    """
    queryset = WorkloadAssignment.objects.all()
    serializer_class = WorkloadAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['department', 'staff', 'is_approved']
    search_fields = ['staff__user__first_name', 'subject__name']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return WorkloadAssignment.objects.all()
        elif user.is_college_admin() and user.college:
            return WorkloadAssignment.objects.filter(department__college=user.college)
        elif user.is_hod() and user.department:
            return WorkloadAssignment.objects.filter(department=user.department)
        return WorkloadAssignment.objects.none()
    
    def create(self, request, *args, **kwargs):
        """Only HODs can create workload assignments for their department"""
        user = request.user
        department_id = request.data.get('department')
        
        # Verify HOD belongs to this department
        if not user.is_hod() and not user.is_super_admin():
            return Response(
                {'error': 'Only HODs can assign workload'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if user.is_hod() and user.department_id != int(department_id):
            return Response(
                {'error': 'You can only assign workload in your department'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Validate workload doesn't exceed max
        staff_id = request.data.get('staff')
        hours_assigned = float(request.data.get('hours_assigned', 0))
        
        try:
            staff = Staff.objects.get(id=staff_id)
            remaining = staff.remaining_workload_hours()
            if hours_assigned > remaining:
                return Response(
                    {'error': f'Exceeds available workload. Remaining: {remaining}h'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Staff.DoesNotExist:
            return Response(
                {'error': 'Staff member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsHOD]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'])
    def by_staff(self, request):
        """Get all workload assignments for a specific staff member"""
        staff_id = request.query_params.get('staff_id')
        if not staff_id:
            return Response({'error': 'staff_id parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        assignments = self.get_queryset().filter(staff_id=staff_id)
        serializer = WorkloadAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_department(self, request):
        """Get all workload assignments for a department"""
        dept_id = request.query_params.get('department_id')
        if not dept_id:
            return Response({'error': 'department_id parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        assignments = self.get_queryset().filter(department_id=dept_id)
        serializer = WorkloadAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)


class WorkloadConfigViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Workload Configuration.
    - Super Admins can manage all workload configs
    - College Admins can view workload configs in their college
    """
    queryset = WorkloadConfig.objects.all()
    serializer_class = WorkloadConfigSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['department']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return WorkloadConfig.objects.all()
        elif user.college:
            return WorkloadConfig.objects.filter(department__college=user.college)
        return WorkloadConfig.objects.none()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdminOrCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

