from rest_framework import serializers
from workload.models import WorkloadAssignment, WorkloadConfig
from timetable.models import Subject


class WorkloadAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    class Meta:
        model = WorkloadAssignment
        fields = ['id', 'department', 'department_name', 'staff', 'staff_name', 'subject', 'subject_name', 'class_name', 'hours_assigned', 'is_approved', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkloadConfigSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    class Meta:
        model = WorkloadConfig
        fields = ['id', 'department', 'department_name', 'default_staff_workload', 'default_hod_workload', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
