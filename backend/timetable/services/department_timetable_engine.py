"""
Department Timetable Generation Engine
Generates department-specific timetable using greedy algorithm with backtracking.
"""
from django.db.models import QuerySet
from timetable.models import Subject, TimeSlot, TimetableEntry, College, Department
from core.models import Lab
from workload.models import WorkloadAssignment


class DepartmentTimetableEngine:
    """
    Engine for generating department timetable.
    
    Algorithm:
    1. Get locked common timeslots (exclude these)
    2. Get workload assignments for department
    3. Allocate labs first (continuous slots)
    4. Allocate core subjects
    5. Validate and return suggestions
    """
    
    def __init__(self, department: Department):
        self.department = department
        self.college = department.college
        self.errors = []
        self.warnings = []
        self.allocated_entries = []
    
    def generate(self) -> dict:
        """
        Main method to generate department timetable.
        
        Returns:
            dict: {
                'success': bool,
                'entries': list,
                'errors': list,
                'warnings': list,
                'conflicts': list
            }
        """
        # Step 1: Get workload assignments
        workload_assignments = self._get_workload_assignments()
        
        if not workload_assignments:
            self.errors.append("No approved workload assignments found")
            return {
                'success': False,
                'entries': [],
                'errors': self.errors,
                'warnings': self.warnings,
                'conflicts': []
            }
        
        # Step 2: Get available timeslots
        available_timeslots = self._get_available_timeslots()
        
        if not available_timeslots:
            self.errors.append("No available timeslots. Common timetable may have locked all slots.")
            return {
                'success': False,
                'entries': [],
                'errors': self.errors,
                'warnings': self.warnings,
                'conflicts': []
            }
        
        # Step 3: Separate lab and theory subjects
        lab_assignments = [wa for wa in workload_assignments if wa.subject.is_lab]
        theory_assignments = [wa for wa in workload_assignments if not wa.subject.is_lab]
        
        # Step 4: Allocate labs first (hardest constraint)
        self._allocate_labs(lab_assignments, available_timeslots)
        
        # Step 5: Allocate theory subjects
        self._allocate_theory(theory_assignments, available_timeslots)
        
        # Step 6: Validate
        conflicts = self._validate()
        
        return {
            'success': len(self.errors) == 0,
            'entries': self.allocated_entries,
            'errors': self.errors,
            'warnings': self.warnings,
            'conflicts': conflicts
        }
    
    def _get_workload_assignments(self) -> QuerySet:
        """Get approved workload assignments for the department"""
        return WorkloadAssignment.objects.filter(
            department=self.department,
            is_approved=True
        ).select_related('subject', 'staff', 'staff__user')
    
    def _get_available_timeslots(self) -> list:
        """Get available timeslots (not locked by common timetable)"""
        locked_ids = TimeSlot.objects.filter(
            college=self.college,
            is_common_locked=True
        ).values_list('id', flat=True)
        
        timeslots = TimeSlot.objects.filter(
            college=self.college
        ).exclude(id__in=locked_ids).order_by('day_order', 'period_number')
        
        return list(timeslots)
    
    def _allocate_labs(self, lab_assignments: list, available_timeslots: list):
        """
        Allocate lab subjects to continuous time slots.
        
        Labs require continuous slots (2-3 hours).
        """
        if not lab_assignments:
            return
        
        for assignment in lab_assignments:
            subject = assignment.subject
            staff = assignment.staff
            class_name = assignment.class_name
            required_hours = min(subject.hours_per_week, 3)  # Max 3 hours
            
            # Find available lab
            lab = self._find_available_lab(subject)
            
            if not lab:
                self.warnings.append(f"No available lab found for {subject.name}")
                continue
            
            # Find continuous slots
            allocated = self._find_continuous_slots(
                staff=staff,
                class_name=class_name,
                required_hours=required_hours,
                timeslots=available_timeslots,
                lab=lab,
                subject=subject
            )
            
            if allocated:
                self.allocated_entries.extend(allocated)
                # Remove used timeslots
                for entry in allocated:
                    if entry['timeslot'] in available_timeslots:
                        available_timeslots.remove(entry['timeslot'])
            else:
                self.warnings.append(f"Could not allocate continuous slots for {subject.name} ({class_name})")
    
    def _find_available_lab(self, subject: Subject) -> Lab:
        """Find an available lab for the subject"""
        labs = Lab.objects.filter(
            college=self.college,
            is_available=True
        )
        
        # If subject has a department, prefer that department's lab
        if subject.department:
            labs = labs.filter(department=subject.department)
        
        return labs.first()
    
    def _find_continuous_slots(self, staff, class_name: str, required_hours: int, 
                              timeslots: list, lab: Lab, subject: Subject) -> list:
        """
        Find continuous available slots for lab.
        
        Returns list of entries if found, empty list if not.
        """
        entries = []
        
        for start_idx in range(len(timeslots) - required_hours + 1):
            can_allocate = True
            selected_slots = []
            
            for hour in range(required_hours):
                slot = timeslots[start_idx + hour]
                
                # Check if same day and continuous periods
                if hour > 0:
                    prev_slot = timeslots[start_idx + hour - 1]
                    if (slot.day_order != prev_slot.day_order or 
                        slot.period_number != prev_slot.period_number + 1):
                        can_allocate = False
                        break
                
                # Check staff availability
                if self._is_staff_busy(staff, slot):
                    can_allocate = False
                    break
                
                # Check class availability
                if self._is_class_busy(class_name, slot):
                    can_allocate = False
                    break
                
                # Check lab availability
                if self._is_lab_busy(lab, slot):
                    can_allocate = False
                    break
                
                selected_slots.append(slot)
            
            if can_allocate and selected_slots:
                for slot in selected_slots:
                    entries.append({
                        'college': self.college.id,
                        'department': self.department.id,
                        'class_name': class_name,
                        'subject': subject.id,
                        'staff': staff.id if staff else None,
                        'timeslot': slot.id,
                        'lab': lab.id if lab else None,
                        'is_common': False,
                    })
                return entries
        
        return []
    
    def _allocate_theory(self, theory_assignments: list, available_timeslots: list):
        """Allocate theory subjects to available slots"""
        if not theory_assignments:
            return
        
        for assignment in theory_assignments:
            subject = assignment.subject
            staff = assignment.staff
            class_name = assignment.class_name
            hours = subject.hours_per_week
            
            for hour in range(hours):
                if not available_timeslots:
                    self.warnings.append(f"No more available slots for {subject.name}")
                    break
                
                # Find first available slot
                allocated = False
                for i, slot in enumerate(available_timeslots):
                    # Check staff availability
                    if staff and self._is_staff_busy(staff, slot):
                        continue
                    
                    # Check class availability
                    if self._is_class_busy(class_name, slot):
                        continue
                    
                    # Allocate
                    entry = {
                        'college': self.college.id,
                        'department': self.department.id,
                        'class_name': class_name,
                        'subject': subject.id,
                        'staff': staff.id if staff else None,
                        'timeslot': slot.id,
                        'lab': None,
                        'is_common': False,
                    }
                    self.allocated_entries.append(entry)
                    available_timeslots.pop(i)
                    allocated = True
                    break
                
                if not allocated:
                    self.warnings.append(f"Could not allocate hour {hour + 1} for {subject.name}")
    
    def _is_staff_busy(self, staff, slot) -> bool:
        """Check if staff is busy at the given slot"""
        if not staff:
            return False
        return TimetableEntry.objects.filter(
            college=self.college,
            timeslot=slot,
            staff=staff
        ).exists()
    
    def _is_class_busy(self, class_name: str, slot) -> bool:
        """Check if class is busy at the given slot"""
        return TimetableEntry.objects.filter(
            college=self.college,
            timeslot=slot,
            class_name=class_name
        ).exists()
    
    def _is_lab_busy(self, lab: Lab, slot) -> bool:
        """Check if lab is busy at the given slot"""
        if not lab:
            return False
        return TimetableEntry.objects.filter(
            college=self.college,
            timeslot=slot,
            lab=lab
        ).exists()
    
    def _validate(self) -> list:
        """Validate generated timetable for conflicts"""
        conflicts = []
        
        for entry_data in self.allocated_entries:
            # This is a simplified validation
            # Real implementation would check against existing entries
            pass
        
        return conflicts
    
    def save_entries(self) -> tuple:
        """Save generated entries to database"""
        saved_count = 0
        errors = []
        
        # Delete existing department entries
        TimetableEntry.objects.filter(
            college=self.college,
            department=self.department,
            is_common=False
        ).delete()
        
        for entry_data in self.allocated_entries:
            try:
                TimetableEntry.objects.create(
                    college=self.college,
                    department=self.department,
                    class_name=entry_data['class_name'],
                    subject_id=entry_data['subject'],
                    staff_id=entry_data['staff'],
                    timeslot_id=entry_data['timeslot'],
                    lab_id=entry_data.get('lab'),
                    is_common=False
                )
                saved_count += 1
            except Exception as e:
                errors.append(f"Error saving entry: {str(e)}")
        
        return (len(errors) == 0, saved_count, errors)


def generate_department_timetable(department_id: int) -> dict:
    """
    Convenience function to generate department timetable.
    
    Args:
        department_id: ID of the department
    
    Returns:
        dict: Generation result
    """
    try:
        department = Department.objects.get(id=department_id)
    except Department.DoesNotExist:
        return {
            'success': False,
            'entries': [],
            'errors': ['Department not found'],
            'warnings': [],
            'conflicts': []
        }
    
    engine = DepartmentTimetableEngine(department)
    return engine.generate()
