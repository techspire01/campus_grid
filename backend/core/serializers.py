from rest_framework import serializers
from core.models import College, Department, Lab
from accounts.models import User, Staff


class CollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = ['id', 'name', 'address', 'working_days', 'periods_per_day', 'period_duration', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DepartmentSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)
    
    class Meta:
        model = Department
        fields = ['id', 'college', 'college_name', 'name', 'code', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class LabSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    
    class Meta:
        model = Lab
        fields = ['id', 'college', 'college_name', 'department', 'department_name', 'name', 'code', 'capacity', 'is_available', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone', 'role', 'college', 'college_name', 'department', 'department_name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class StaffSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    remaining_hours = serializers.SerializerMethodField()
    
    class Meta:
        model = Staff
        fields = ['id', 'user', 'user_name', 'user_email', 'department', 'department_name', 'max_workload_hours', 'current_workload_hours', 'remaining_hours', 'can_handle_common', 'created_at', 'updated_at']
        read_only_fields = ['id', 'current_workload_hours', 'created_at', 'updated_at']
    
    def get_remaining_hours(self, obj):
        return obj.remaining_workload_hours()


class StaffDetailSerializer(StaffSerializer):
    """Detailed view of staff with additional information"""
    workload_assignments = serializers.SerializerMethodField()
    
    def get_workload_assignments(self, obj):
        from workload.serializers import WorkloadAssignmentSerializer
        assignments = obj.workload_assignments.all()
        return WorkloadAssignmentSerializer(assignments, many=True).data
