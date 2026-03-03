from django.db import models
from accounts.models import Staff
from timetable.models import Subject
from core.models import Department


class WorkloadAssignment(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='workload_assignments')
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='workload_assignments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='workload_assignments')
    
    class_name = models.CharField(max_length=100)  # e.g., "CSE-A"
    hours_assigned = models.FloatField(default=3.0)
    
    is_approved = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'workload_assignment'
        unique_together = ('staff', 'subject', 'class_name')
        indexes = [
            models.Index(fields=['staff', 'department']),
            models.Index(fields=['department', 'subject']),
        ]
    
    def __str__(self):
        return f"{self.staff.user.get_full_name()} - {self.subject.name} ({self.hours_assigned}h)"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update staff's current workload
        total_hours = self.staff.workload_assignments.aggregate(
            total=models.Sum('hours_assigned')
        )['total'] or 0.0
        self.staff.current_workload_hours = total_hours
        self.staff.save()


class WorkloadConfig(models.Model):
    """Configuration for workload limits set by admin"""
    department = models.OneToOneField(Department, on_delete=models.CASCADE, related_name='workload_config')
    
    default_staff_workload = models.IntegerField(default=20)  # Default max hours for staff
    default_hod_workload = models.IntegerField(default=14)  # Default max hours for HOD
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'workload_config'
    
    def __str__(self):
        return f"Workload Config - {self.department.name}"

