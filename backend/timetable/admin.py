from django.contrib import admin
from .models import SubjectType, Subject, TimeSlot, TimetableEntry, CollegeTiming


@admin.register(SubjectType)
class SubjectTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    ordering = ['name']


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'subject_type_fk', 'college', 'department', 'is_common', 'is_lab', 'hours_per_week']
    list_filter = ['is_common', 'is_lab', 'subject_type_fk', 'college']
    search_fields = ['name', 'code']
    ordering = ['name']
