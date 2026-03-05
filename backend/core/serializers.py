from rest_framework import serializers
import re
from core.models import College, Department, Lab, Class
from accounts.models import User, Staff


class CollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = ['id', 'name', 'address', 'working_days', 'periods_per_day', 'period_duration', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DepartmentSerializer(serializers.ModelSerializer):
    college = serializers.PrimaryKeyRelatedField(queryset=College.objects.all(), required=False)
    college_name = serializers.CharField(source='college.name', read_only=True)
    
    class Meta:
        model = Department
        fields = ['id', 'college', 'college_name', 'name', 'code', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        if self.instance:
            return attrs

        if attrs.get('college'):
            return attrs

        request = self.context.get('request')
        user_college = getattr(getattr(request, 'user', None), 'college', None) if request else None
        default_college = user_college or College.objects.order_by('id').first()

        if not default_college:
            default_college = College.objects.create(
                name='Default College',
                address='Default Address',
            )

        attrs['college'] = default_college
        return attrs


class ClassSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    year_display = serializers.CharField(source='get_year_display', read_only=True)
    section_display = serializers.CharField(source='get_section_display', read_only=True)
    assigned_subjects = serializers.SerializerMethodField()
    tutors = serializers.PrimaryKeyRelatedField(
        queryset=Staff.objects.all(),
        many=True,
        required=False
    )
    tutors_detail = serializers.SerializerMethodField()
    
    class Meta:
        model = Class
        fields = ['id', 'department', 'department_name', 'department_code', 'year', 'year_display', 'section', 'section_display', 'assigned_subjects', 'tutors', 'tutors_detail', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_assigned_subjects(self, obj):
        return [
            {
                'id': mapping.subject.id,
                'name': mapping.subject.name,
                'code': mapping.subject.code,
                'is_lab': mapping.subject.is_lab,
                'hours_per_week': mapping.subject.hours_per_week,
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
            for mapping in obj.subject_mappings.select_related('subject').all().order_by('subject__name')
        ]
    
    def get_tutors_detail(self, obj):
        return [
            {
                'id': tutor.id,
                'user_id': tutor.user.id,
                'name': tutor.user.get_full_name(),
                'email': tutor.user.email,
                'department': tutor.department.name if tutor.department else None,
            }
            for tutor in obj.tutors.all()
        ]


class LabSerializer(serializers.ModelSerializer):
    college = serializers.PrimaryKeyRelatedField(queryset=College.objects.all(), required=False)
    college_name = serializers.CharField(source='college.name', read_only=True)
    reference_docx_url = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Lab
        fields = [
            'id',
            'college',
            'college_name',
            'name',
            'code',
            'capacity',
            'is_available',
            'reference_docx',
            'reference_docx_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        validators = []
        extra_kwargs = {
            'code': {'required': False, 'allow_blank': True},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['college'].required = False
        self.fields['college'].allow_null = True
        self.fields['code'].required = False
        self.fields['code'].allow_blank = True

    def _generate_lab_code(self, college, name):
        base = re.sub(r'[^A-Z0-9]+', '', (name or '').upper())[:12] or 'LAB'
        candidate = base
        index = 1

        while Lab.objects.filter(college=college, code=candidate).exists():
            index += 1
            candidate = f"{base}{index}"

        return candidate

    def validate(self, attrs):
        if self.instance:
            return attrs

        if not attrs.get('college'):
            request = self.context.get('request')
            user_college = getattr(getattr(request, 'user', None), 'college', None) if request else None
            default_college = user_college or College.objects.order_by('id').first()

            if not default_college:
                default_college = College.objects.create(
                    name='Default College',
                    address='Default Address',
                )

            attrs['college'] = default_college

        if not attrs.get('code'):
            attrs['code'] = self._generate_lab_code(attrs['college'], attrs.get('name'))

        return attrs

    def get_reference_docx_url(self, obj):
        if not obj.reference_docx:
            return None

        request = self.context.get('request')
        url = obj.reference_docx.url
        return request.build_absolute_uri(url) if request else url


class UserSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone', 'role', 'college', 'college_name', 'department', 'department_name', 'is_active', 'password', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        role = attrs.get('role', getattr(self.instance, 'role', None))
        department = attrs.get('department', getattr(self.instance, 'department', None))

        if role == 'HOD' and not department:
            raise serializers.ValidationError({'department': 'HOD must be assigned to a department.'})

        if role == 'HOD' and department:
            existing_hod = User.objects.filter(role='HOD', department=department)
            if self.instance:
                existing_hod = existing_hod.exclude(id=self.instance.id)
            if existing_hod.exists():
                raise serializers.ValidationError({'role': 'This department already has a HOD.'})

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password', None)

        if not validated_data.get('username'):
            base_username = validated_data.get('email', '').split('@')[0] or 'user'
            username = base_username
            index = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{index}"
                index += 1
            validated_data['username'] = username

        instance = super().create(validated_data)

        if password:
            instance.set_password(password)
            instance.save(update_fields=['password'])

        return instance

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)

        if password:
            instance.set_password(password)
            instance.save(update_fields=['password'])

        return instance


class StaffSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    remaining_hours = serializers.SerializerMethodField()
    
    class Meta:
        model = Staff
        fields = ['id', 'user', 'name', 'user_name', 'user_email', 'user_role', 'user_phone', 'department', 'department_name', 'max_workload_hours', 'current_workload_hours', 'remaining_hours', 'can_handle_common', 'created_at', 'updated_at']
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
