"""
Validation Service for Timetable Entries
Provides validation logic for timetable operations.
"""
from typing import Dict, List, Optional
from timetable.models import TimetableEntry, TimeSlot, Subject
from accounts.models import Staff


class ValidationResult:
    """Result of validation"""
    def __init__(self, valid: bool, errors: List[str] = None, warnings: List[str] = None):
        self.valid = valid
        self.errors = errors or []
        self.warnings = warnings or []
    
    def to_dict(self) -> dict:
        return {
            'valid': self.valid,
            'errors': self.errors,
            'warnings': self.warnings
        }


class TimetableValidationService:
    """
    Service for validating timetable operations.
    
    Validates:
    - Staff availability
    - Class availability
    - Lab availability
    - Workload limits
    - Common slot locks
    - Lab continuity
    """
    
    def __init__(self, college_id: int):
        self.college_id = college_id
    
    def validate_move(self, entry: TimetableEntry, new_timeslot: TimeSlot) -> ValidationResult:
        """
        Validate moving an entry to a new time slot.
        
        Args:
            entry: The timetable entry to move
            new_timeslot: The new time slot
        
        Returns:
            ValidationResult: Validation result
        """
        errors = []
        warnings = []
        
        # Check 1: Is new slot locked?
        if new_timeslot.is_common_locked:
            errors.append("Cannot move to a locked common slot")
            return ValidationResult(False, errors, warnings)
        
        # Check 2: Staff availability
        if entry.staff:
            staff_clash = TimetableEntry.objects.filter(
                college_id=self.college_id,
                timeslot=new_timeslot,
                staff=entry.staff
            ).exclude(id=entry.id).exists()
            
            if staff_clash:
                errors.append(f"Staff {entry.staff.user.get_full_name()} is already assigned to another class at this time")
        
        # Check 3: Class availability
        class_clash = TimetableEntry.objects.filter(
            college_id=self.college_id,
            timeslot=new_timeslot,
            class_name=entry.class_name
        ).exclude(id=entry.id).exists()
        
        if class_clash:
            errors.append(f"Class {entry.class_name} already has a subject at this time")
        
        # Check 4: Lab availability (if lab subject)
        if entry.subject.is_lab and entry.lab:
            lab_clash = TimetableEntry.objects.filter(
                college_id=self.college_id,
                timeslot=new_timeslot,
                lab=entry.lab
            ).exclude(id=entry.id).exists()
            
            if lab_clash:
                errors.append(f"Lab {entry.lab.name} is not available at this time")
        
        # Check 5: Workload limit
        if entry.staff:
            if not self._check_workload_limit(entry.staff, new_timeslot):
                errors.append("This move would exceed the staff's maximum workload hours")
        
        # Check 6: Lab continuity (if moving a lab subject)
        if entry.subject.is_lab:
            continuity_warning = self._check_lab_continuity(entry, new_timeslot)
            if continuity_warning:
                warnings.append(continuity_warning)
        
        return ValidationResult(len(errors) == 0, errors, warnings)
    
    def validate_new_entry(self, timeslot: TimeSlot, staff: Staff = None, 
                          class_name: str = None, lab: 'Lab' = None) -> ValidationResult:
        """
        Validate creating a new timetable entry.
        
        Args:
            timeslot: The time slot
            staff: The staff member
            class_name: The class name
            lab: The lab (if applicable)
        
        Returns:
            ValidationResult: Validation result
        """
        errors = []
        warnings = []
        
        # Check 1: Is slot locked?
        if timeslot.is_common_locked:
            errors.append("Cannot create entry in a locked common slot")
            return ValidationResult(False, errors, warnings)
        
        # Check 2: Staff availability
        if staff:
            staff_clash = TimetableEntry.objects.filter(
                college_id=self.college_id,
                timeslot=timeslot,
                staff=staff
            ).exists()
            
            if staff_clash:
                errors.append(f"Staff {staff.user.get_full_name()} is already assigned to another class at this time")
        
        # Check 3: Class availability
        if class_name:
            class_clash = TimetableEntry.objects.filter(
                college_id=self.college_id,
                timeslot=timeslot,
                class_name=class_name
            ).exists()
            
            if class_clash:
                errors.append(f"Class {class_name} already has a subject at this time")
        
        # Check 4: Lab availability
        if lab:
            lab_clash = TimetableEntry.objects.filter(
                college_id=self.college_id,
                timeslot=timeslot,
                lab=lab
            ).exists()
            
            if lab_clash:
                errors.append(f"Lab {lab.name} is not available at this time")
        
        # Check 5: Workload limit
        if staff:
            if not self._check_workload_limit(staff, timeslot):
                errors.append("Adding this subject would exceed the staff's maximum workload hours")
        
        return ValidationResult(len(errors) == 0, errors, warnings)
    
    def _check_workload_limit(self, staff: Staff, timeslot: TimeSlot) -> bool:
        """Check if adding one more hour would exceed workload limit"""
        # Get current workload
        current_hours = staff.current_workload_hours
        
        # Get max workload
        max_hours = staff.max_workload_hours
        
        # Check if adding one more hour would exceed
        # Note: This is a simplified check
        return current_hours < max_hours
    
    def _check_lab_continuity(self, entry: TimetableEntry, new_timeslot: TimeSlot) -> Optional[str]:
        """Check if lab would still be continuous after move"""
        if not entry.subject.is_lab:
            return None
        
        # Check if the new slot is adjacent to existing lab slots
        # This is a simplified check - real implementation would check the whole schedule
        return None  # Return None for now - can be enhanced
    
    def check_all_conflicts(self) -> List[dict]:
        """
        Check for all conflicts in the timetable.
        
        Returns:
            List of conflicts
        """
        conflicts = []
        
        entries = TimetableEntry.objects.filter(
            college_id=self.college_id
        ).select_related('timeslot', 'subject', 'staff__user', 'lab')
        
        # Check staff clashes
        for entry in entries:
            if entry.staff:
                clashes = TimetableEntry.objects.filter(
                    college_id=self.college_id,
                    timeslot=entry.timeslot,
                    staff=entry.staff
                ).exclude(id=entry.id)
                
                if clashes.exists():
                    conflicts.append({
                        'type': 'STAFF_CLASH',
                        'entry_id': entry.id,
                        'staff': entry.staff.user.get_full_name(),
                        'timeslot': str(entry.timeslot),
                        'clashing_entries': list(clashes.values_list('id', flat=True))
                    })
        
        # Check class clashes
        class_map = {}
        for entry in entries:
            key = f"{entry.class_name}_{entry.timeslot_id}"
            if key in class_map:
                conflicts.append({
                    'type': 'CLASS_CLASH',
                    'class': entry.class_name,
                    'timeslot': str(entry.timeslot),
                    'entries': [class_map[key], entry.id]
                })
            else:
                class_map[key] = entry.id
        
        # Check lab clashes
        for entry in entries:
            if entry.lab:
                clashes = TimetableEntry.objects.filter(
                    college_id=self.college_id,
                    timeslot=entry.timeslot,
                    lab=entry.lab
                ).exclude(id=entry.id)
                
                if clashes.exists():
                    conflicts.append({
                        'type': 'LAB_CLASH',
                        'lab': entry.lab.name,
                        'timeslot': str(entry.timeslot),
                        'clashing_entries': list(clashes.values_list('id', flat=True))
                    })
        
        return conflicts


def validate_timetable_move(entry_id: int, new_timeslot_id: int) -> dict:
    """
    Convenience function to validate timetable move.
    
    Args:
        entry_id: ID of the entry to move
        new_timeslot_id: ID of the new time slot
    
    Returns:
        dict: Validation result
    """
    try:
        entry = TimetableEntry.objects.get(id=entry_id)
        new_timeslot = TimeSlot.objects.get(id=new_timeslot_id)
    except (TimetableEntry.DoesNotExist, TimeSlot.DoesNotExist):
        return {
            'valid': False,
            'errors': ['Entry or time slot not found'],
            'warnings': []
        }
    
    service = TimetableValidationService(entry.college_id)
    result = service.validate_move(entry, new_timeslot)
    
    return result.to_dict()


def get_timetable_conflicts(college_id: int) -> dict:
    """
    Get all conflicts in the timetable.
    
    Args:
        college_id: ID of the college
    
    Returns:
        dict: {
            'has_conflicts': bool,
            'conflicts': list
        }
    """
    service = TimetableValidationService(college_id)
    conflicts = service.check_all_conflicts()
    
    return {
        'has_conflicts': len(conflicts) > 0,
        'conflicts': conflicts
    }
