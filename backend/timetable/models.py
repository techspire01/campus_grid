from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import College, Department, Lab, Class
from accounts.models import User, Staff


class SubjectType(models.Model):
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'timetable_subject_type'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Subject(models.Model):
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='subjects')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='subjects')
    
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    
    is_common = models.BooleanField(default=False)  # Tamil, English, Maths, etc.
    is_lab = models.BooleanField(default=False)
    
    # New subject type as ForeignKey (null for backward compatibility during migration)
    subject_type_fk = models.ForeignKey(SubjectType, on_delete=models.SET_NULL, null=True, blank=True, related_name='subjects')
    # Old subject type field (will be deprecated)
    subject_type_old = models.CharField(max_length=20, default='THEORY', null=True, blank=True)
    
    hours_per_week = models.IntegerField(default=3)
    
    # Hours per day (6-day week: Monday to Saturday)
    hours_monday = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10)])
    hours_tuesday = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10)])
    hours_wednesday = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10)])
    hours_thursday = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10)])
    hours_friday = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10)])
    hours_saturday = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10)])
    
    # Total hours for the entire semester
    total_semester_hours = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    
    year = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(4)], null=True, blank=True)
    semester = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(8)], null=True, blank=True)
    
    # Staff member handling this subject
    staff = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name='subjects')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'timetable_subject'
        unique_together = ('college', 'code')
    
    @property
    def subject_type(self):
        """Returns subject type ID for API compatibility"""
        return self.subject_type_fk.id if self.subject_type_fk else None
    
    @property
    def subject_type_display(self):
        """Returns subject type name for display"""
        return self.subject_type_fk.name if self.subject_type_fk else (self.subject_type_old or 'Theory')
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class ClassSubjectMapping(models.Model):
    class_instance = models.ForeignKey(Class, on_delete=models.CASCADE, related_name='subject_mappings')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='class_mappings')
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'timetable_class_subject_mapping'
        unique_together = ('class_instance', 'subject')
        indexes = [
            models.Index(fields=['class_instance']),
            models.Index(fields=['subject']),
        ]

    def __str__(self):
        return f"{self.class_instance} -> {self.subject.code}"


class TimeSlot(models.Model):
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='timeslots')
    
    day_order = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(6)])  # Monday = 1, ... Saturday = 6
    period_number = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    
    is_common_locked = models.BooleanField(default=False)  # Prevents editing common slots
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'timetable_timeslot'
        unique_together = ('college', 'day_order', 'period_number')
        indexes = [
            models.Index(fields=['college', 'day_order', 'period_number']),
        ]
    
    def __str__(self):
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return f"Day {self.day_order} ({days[self.day_order-1]}) - Period {self.period_number}"


class CollegeTiming(models.Model):
    college = models.OneToOneField(College, on_delete=models.CASCADE, related_name='timing_config')
    start_time = models.TimeField()
    end_time = models.TimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'timetable_college_timing'

    def __str__(self):
        return f"{self.college.name}: {self.start_time} - {self.end_time}"


class TimetableEntry(models.Model):
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='timetable_entries')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='timetable_entries', null=True, blank=True)
    
    class_name = models.CharField(max_length=100)  # e.g., "CSE-A", "ECE-B"
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='timetable_entries')
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='timetable_entries', null=True, blank=True)
    timeslot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE, related_name='timetable_entries')
    lab = models.ForeignKey(Lab, on_delete=models.SET_NULL, null=True, blank=True, related_name='timetable_entries')
    
    is_common = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'timetable_entry'
        unique_together = [
            ('college', 'timeslot', 'class_name'),
            ('college', 'timeslot', 'staff'),
            ('college', 'timeslot', 'lab'),
        ]
        indexes = [
            models.Index(fields=['college', 'department']),
            models.Index(fields=['staff', 'timeslot']),
            models.Index(fields=['lab', 'timeslot']),
        ]
    
    def __str__(self):
        return f"{self.class_name} - {self.subject.name} ({self.timeslot})"


class CommonTimetable(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('LOCKED', 'Locked'),
        ('REJECTED', 'Rejected'),
    )
    
    college = models.OneToOneField(College, on_delete=models.CASCADE, related_name='common_timetable')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_common_timetables')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_common_timetables')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'timetable_common_timetable'
    
    def __str__(self):
        return f"{self.college.name} - Common Timetable ({self.status})"


class DepartmentTimetable(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('PUBLISHED', 'Published'),
    )
    
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='department_timetables')
    department = models.OneToOneField(Department, on_delete=models.CASCADE, related_name='timetable')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_dept_timetables')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_dept_timetables')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'timetable_department_timetable'
    
    def __str__(self):
        return f"{self.department.name} - Timetable ({self.status})"

