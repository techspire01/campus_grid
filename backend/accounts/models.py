from django.db import models
from django.contrib.auth.models import AbstractUser
from core.models import College, Department


class User(AbstractUser):
    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Super Admin'),
        ('COLLEGE_ADMIN', 'College Admin'),
        ('HOD', 'Head of Department'),
        ('LAB_INCHARGE', 'Lab Incharge'),
        ('COMMON_SUBJECT_HEAD', 'Common Subject Head'),
        ('STAFF', 'Staff'),
        ('STUDENT', 'Student'),
    )
    
    college = models.ForeignKey(College, on_delete=models.CASCADE, null=True, blank=True, related_name='users')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff')
    
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='STAFF')
    
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'accounts_user'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"
    
    def is_super_admin(self):
        return self.role == 'SUPER_ADMIN'
    
    def is_college_admin(self):
        return self.role == 'COLLEGE_ADMIN'
    
    def is_hod(self):
        return self.role == 'HOD'
    
    def is_lab_incharge(self):
        return self.role == 'LAB_INCHARGE'
    
    def is_common_subject_head(self):
        return self.role == 'COMMON_SUBJECT_HEAD'


class Staff(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_members')
    
    max_workload_hours = models.IntegerField(default=20)  # Admin sets this
    current_workload_hours = models.FloatField(default=0.0)
    
    can_handle_common = models.BooleanField(default=False)  # Can handle common subjects
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'accounts_staff'
        unique_together = ('user', 'department')
    
    def __str__(self):
        department_name = self.department.name if self.department else 'No Department'
        return f"{self.user.get_full_name()} - {department_name}"
    
    def remaining_workload_hours(self):
        return self.max_workload_hours - self.current_workload_hours

