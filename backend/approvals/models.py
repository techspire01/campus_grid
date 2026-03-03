from django.db import models
from accounts.models import User
from timetable.models import CommonTimetable
from core.models import Department


class Approval(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )
    
    APPROVER_ROLE_CHOICES = (
        ('LAB_INCHARGE', 'Lab Incharge'),
        ('COMMON_SUBJECT_HEAD', 'Common Subject Head'),
        ('COLLEGE_ADMIN', 'College Admin'),
    )
    
    common_timetable = models.ForeignKey(CommonTimetable, on_delete=models.CASCADE, related_name='approvals')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approvals_given')
    
    approver_role = models.CharField(max_length=30, choices=APPROVER_ROLE_CHOICES)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='approvals')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    comment = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'approvals_approval'
        unique_together = [
            ('common_timetable', 'approver_role', 'department'),
        ]
        indexes = [
            models.Index(fields=['common_timetable', 'status']),
            models.Index(fields=['approved_by', 'status']),
        ]
    
    def __str__(self):
        return f"Approval - {self.common_timetable.college.name} ({self.approver_role})"


class ApprovalLog(models.Model):
    """Audit log for all approvals"""
    approval = models.ForeignKey(Approval, on_delete=models.CASCADE, related_name='logs')
    
    action = models.CharField(max_length=50)  # SUBMITTED, APPROVED, REJECTED
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='approval_logs')
    comment = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'approvals_log'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Log - {self.approval} ({self.action})"

