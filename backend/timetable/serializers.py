from rest_framework import serializers
from datetime import datetime
from timetable.models import Subject, SubjectType, TimeSlot, TimetableEntry, CommonTimetable, DepartmentTimetable, CollegeTiming


class SubjectTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectType
        fields = ['id', 'name', 'code', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SubjectSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    staff_details = serializers.SerializerMethodField(read_only=True)
    subject_type = serializers.IntegerField(source='subject_type_fk.id', read_only=True, allow_null=True)
    subject_type_display = serializers.CharField(read_only=True)
    
    class Meta:
        model = Subject
        fields = [
            'id', 'college', 'college_name', 'department', 'department_name', 
            'name', 'code', 'is_common', 'is_lab', 'subject_type', 'subject_type_display',
            'hours_per_week', 'hours_monday', 'hours_tuesday', 'hours_wednesday', 
            'hours_thursday', 'hours_friday', 'hours_saturday',
            'total_semester_hours', 'year', 'semester', 
            'staff', 'staff_details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_staff_details(self, obj):
        if obj.staff:
            return {
                'id': obj.staff.id,
                'name': obj.staff.user.get_full_name(),
                'email': obj.staff.user.email,
                'department': obj.staff.department.name if obj.staff.department else None
            }
        return None


class TimeSlotSerializer(serializers.ModelSerializer):
    day_name = serializers.SerializerMethodField()
    period_label = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeSlot
        fields = ['id', 'college', 'day_order', 'day_name', 'period_number', 'start_time', 'end_time', 'period_label', 'is_common_locked', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_day_name(self, obj):
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return days[obj.day_order - 1] if 1 <= obj.day_order <= 6 else 'Unknown'

    def get_period_label(self, obj):
        if not obj.start_time or not obj.end_time:
            return None
        return f"{obj.start_time.strftime('%H:%M')} - {obj.end_time.strftime('%H:%M')}"


class CollegeTimingSerializer(serializers.ModelSerializer):
    split_hours = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CollegeTiming
        fields = ['id', 'college', 'start_time', 'end_time', 'split_hours', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        start_time = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = attrs.get('end_time', getattr(self.instance, 'end_time', None))

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({'end_time': 'End time must be later than start time'})
        return attrs

    def get_split_hours(self, obj):
        slots_qs = TimeSlot.objects.filter(college=obj.college, day_order=1).order_by('period_number')
        slots = []
        for slot in slots_qs:
            if slot.start_time and slot.end_time:
                slots.append({
                    'period_number': slot.period_number,
                    'start_time': slot.start_time.strftime('%H:%M'),
                    'end_time': slot.end_time.strftime('%H:%M'),
                })
        return slots


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
