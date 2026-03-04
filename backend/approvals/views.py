from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from approvals.models import Approval, ApprovalLog
from approvals.serializers import ApprovalSerializer, ApprovalLogSerializer
from core.permissions import IsSuperAdmin, IsCollegeAdmin, IsLabIncharge, IsCommonSubjectHead


class ApprovalViewSet(viewsets.ModelViewSet):
    """
    Manage Approvals for Common Timetable.
    
    Endpoints:
    - GET /api/approvals/ - List approvals
    - GET /api/approvals/pending/ - Get current user's pending approvals
    - PATCH /api/approvals/{id}/approve/ - Approve
    - PATCH /api/approvals/{id}/reject/ - Reject
    - GET /api/approvals/{id}/logs/ - View approval history
    """
    queryset = Approval.objects.all()
    serializer_class = ApprovalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['common_timetable', 'approver_role', 'status', 'department']
    ordering_fields = ['created_at', 'updated_at']
    
    def get_queryset(self):
        user = self.request.user
        
        # Filter based on user role
        if user.is_super_admin():
            return Approval.objects.all()
        elif user.college:
            return Approval.objects.filter(common_timetable__college=user.college)
        return Approval.objects.none()
    
    def get_permissions(self):
        if self.action in ['approve', 'reject']:
            permission_classes = [IsLabIncharge, IsCommonSubjectHead]
        elif self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsCollegeAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """
        Get current user's pending approvals based on their role.
        
        - Lab Incharge sees lab-related approvals
        - Common Subject Heads see their subject approvals
        """
        user = request.user
        approvals = Approval.objects.filter(
            common_timetable__college=user.college,
            status='PENDING'
        )
        
        # Filter based on role
        if user.is_lab_incharge():
            approvals = approvals.filter(approver_role='LAB_INCHARGE')
        elif user.is_common_subject_head():
            approvals = approvals.filter(approver_role='COMMON_SUBJECT_HEAD')
        
        serializer = self.get_serializer(approvals, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        """
        Approve a pending approval.
        
        Request:
        {
            "comment": "Approved"
        }
        
        If all approvals are complete, the common timetable will be auto-locked.
        """
        approval = self.get_object()
        
        if approval.status != 'PENDING':
            return Response(
                {'error': f'Cannot approve. Current status is {approval.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify user role matches approver role
        user = request.user
        if approval.approver_role == 'LAB_INCHARGE' and not user.is_lab_incharge():
            return Response(
                {'error': 'Only Lab Incharge can approve this'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if approval.approver_role == 'COMMON_SUBJECT_HEAD' and not user.is_common_subject_head():
            return Response(
                {'error': 'Only Common Subject Head can approve this'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update approval
        approval.status = 'APPROVED'
        approval.approved_by = user
        approval.comment = request.data.get('comment', '')
        approval.save()
        
        # Create log
        ApprovalLog.objects.create(
            approval=approval,
            action='APPROVED',
            changed_by=user,
            comment=approval.comment
        )
        
        # Check if all approvals are complete
        self._check_and_lock_common_timetable(approval.common_timetable)
        
        serializer = self.get_serializer(approval)
        return Response({
            'message': 'Approval granted successfully',
            'approval': serializer.data
        })
    
    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        """
        Reject a pending approval.
        
        Request:
        {
            "comment": "Reason for rejection"
        }
        """
        approval = self.get_object()
        
        if approval.status != 'PENDING':
            return Response(
                {'error': f'Cannot reject. Current status is {approval.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify user role
        user = request.user
        if approval.approver_role == 'LAB_INCHARGE' and not user.is_lab_incharge():
            return Response(
                {'error': 'Only Lab Incharge can reject this'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if approval.approver_role == 'COMMON_SUBJECT_HEAD' and not user.is_common_subject_head():
            return Response(
                {'error': 'Only Common Subject Head can reject this'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        comment = request.data.get('comment', '')
        if not comment:
            return Response(
                {'error': 'Comment is required for rejection'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update approval
        approval.status = 'REJECTED'
        approval.approved_by = user
        approval.comment = comment
        approval.save()
        
        # Create log
        ApprovalLog.objects.create(
            approval=approval,
            action='REJECTED',
            changed_by=user,
            comment=comment
        )
        
        # Reset common timetable status
        common_tt = approval.common_timetable
        common_tt.status = 'REJECTED'
        common_tt.save()
        
        serializer = self.get_serializer(approval)
        return Response({
            'message': 'Approval rejected',
            'approval': serializer.data
        })
    
    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """Get approval history"""
        approval = self.get_object()
        logs = approval.logs.all()
        serializer = ApprovalLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    def _check_and_lock_common_timetable(self, common_timetable):
        """Check if all approvals are complete and lock the timetable"""
        pending_count = Approval.objects.filter(
            common_timetable=common_timetable,
            status='PENDING'
        ).count()
        
        if pending_count == 0:
            # All approvals complete - lock the timetable
            common_timetable.status = 'LOCKED'
            common_timetable.save()
            
            # Lock all timeslots used by common timetable
            from timetable.models import TimeSlot
            common_entry_timeslots = common_timetable.college.timetable_entries.filter(
                is_common=True
            ).values_list('timeslot_id', flat=True)
            
            TimeSlot.objects.filter(id__in=common_entry_timeslots).update(is_common_locked=True)


class ApprovalLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view for approval logs.
    """
    queryset = ApprovalLog.objects.all()
    serializer_class = ApprovalLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['approval']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin():
            return ApprovalLog.objects.all()
        elif user.college:
            return ApprovalLog.objects.filter(
                approval__common_timetable__college=user.college
            )
        return ApprovalLog.objects.none()
