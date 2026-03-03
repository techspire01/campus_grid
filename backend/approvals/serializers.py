from rest_framework import serializers
from approvals.models import Approval, ApprovalLog


class ApprovalLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = ApprovalLog
        fields = ['id', 'action', 'changed_by', 'changed_by_name', 'comment', 'created_at']
        read_only_fields = ['id', 'created_at']


class ApprovalSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='common_timetable.college.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    logs = ApprovalLogSerializer(many=True, read_only=True, source='logs')
    
    class Meta:
        model = Approval
        fields = ['id', 'common_timetable', 'college_name', 'approver_role', 'status', 'approved_by', 'approved_by_name', 'department', 'department_name', 'comment', 'logs', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
