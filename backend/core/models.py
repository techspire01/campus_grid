from django.db import models

class College(models.Model):
    name = models.CharField(max_length=255, unique=True)
    address = models.TextField()
    
    working_days = models.IntegerField(default=6)  # 1-6 (Monday to Saturday)
    periods_per_day = models.IntegerField(default=5)  # No. of periods per day
    period_duration = models.IntegerField(default=45)  # In minutes
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_college'
        verbose_name_plural = 'Colleges'
    
    def __str__(self):
        return self.name


class Department(models.Model):
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_department'
        unique_together = ('college', 'code')
    
    def __str__(self):
        return f"{self.name} ({self.college.name})"


class Lab(models.Model):
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='labs')
    
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    capacity = models.IntegerField(default=30)
    
    is_available = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_lab'
        unique_together = ('college', 'code')
    
    def __str__(self):
        return f"{self.name} ({self.code})"



class Class(models.Model):
    YEAR_CHOICES = [
        (1, '1st Year'),
        (2, '2nd Year'),
        (3, '3rd Year'),
    ]
    
    SECTION_CHOICES = [
        ('A', 'Section A'),
        ('B', 'Section B'),
    ]
    
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='classes')
    year = models.IntegerField(choices=YEAR_CHOICES)
    section = models.CharField(max_length=1, choices=SECTION_CHOICES)
    tutors = models.ManyToManyField('accounts.Staff', related_name='classes', blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'core_class'
        unique_together = ('department', 'year', 'section')
        verbose_name_plural = 'Classes'
    
    def __str__(self):
        return f"{self.department.code} - Year {self.year} Section {self.section}"

