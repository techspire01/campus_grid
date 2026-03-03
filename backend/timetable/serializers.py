from rest_framework import serializers
from timetable.models import Subject, TimeSlot, TimetableEntry, CommonTimetable, DepartmentTimetable


class SubjectSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    
    class Meta:
        model = Subject
        fields = ['id', 'college', 'college_name', 'department', 'department_name', 'name', 'code', 'is_common', 'is_lab', 'hours_per_week', 'year', 'semester', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TimeSlotSerializer(serializers.ModelSerializer):
    day_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeSlot
        fields = ['id', 'college', 'day_order', 'day_name', 'period_number', 'is_common_locked', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_day_name(self, obj):
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return days[obj.day_order - 1] if 1 <= obj.day_order <= 6 else 'Unknown'


class TimetableEntrySerializer(serializers.ModelSerializer):
    class_name_display = serializers.CharField(source='class_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True, allow_null=True)
    lab_name = serializers.CharField(source='lab.name', read_only=True, allow_null=True)
    day_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TimetableEntry
        fields = ['id', 'college', 'department', 'class_name', 'class_name_display', 'subject', 'subject_name', 'subject_code', 'staff', 'staff_name', 'timeslot', 'day_name', 'lab', 'lab_name', 'is_common', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_day_name(self, obj):
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return days[obj.timeslot.day_order - 1] if 1 <= obj.timeslot.day_order <= 6 else 'Unknown'


class CommonTimetableSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    entries_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CommonTimetable
        fields = ['id', 'college', 'college_name', 'status', 'created_by', 'created_by_name', 'approved_by', 'approved_by_name', 'entries_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_entries_count(self, obj):
        return obj.college.timetable_entries.filter(is_common=True).count()


class DepartmentTimetableSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    entries_count = serializers.SerializerMethodField()
    
    class Meta:
        model = DepartmentTimetable
        fields = ['id', 'college', 'college_name', 'department', 'department_name', 'status', 'created_by', 'created_by_name', 'approved_by', 'approved_by_name', 'entries_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_entries_count(self, obj):
        return obj.college.timetable_entries.filter(department=obj.department, is_common=False).count()
