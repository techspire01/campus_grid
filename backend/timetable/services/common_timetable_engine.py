"""
Common Timetable Generation Engine
Generates common timetable for all years (1st, 2nd, 3rd year).
"""
from django.db.models import QuerySet
from timetable.models import Subject, TimeSlot, TimetableEntry, College, CommonTimetable
from workload.models import WorkloadAssignment


class CommonTimetableEngine:
    """
    Engine for generating common timetable.
    
    Common subjects: Tamil, English, Maths, PT, Library, Activity, EDC, FC
    
    Algorithm:
    1. Get all common subjects for the college
    2. Get available timeslots
    3. Distribute subjects evenly across available slots
    4. Create entries for each year (1st, 2nd, 3rd)
    """
    
    def __init__(self, college: College):
        self.college = college
        self.errors = []
        self.warnings = []
        self.allocated_entries = []
    
    def generate(self, enable_addons: bool = False) -> dict:
        """
        Main method to generate common timetable.
        
        Args:
            enable_addons: Whether to include addon subjects
            
        Returns:
            dict: {
                'success': bool,
                'entries': list,
                'errors': list,
                'warnings': list
            }
        """
        # Step 1: Get common subjects
        common_subjects = self._get_common_subjects(enable_addons)
        
        if not common_subjects:
            self.errors.append("No common subjects found. Please create common subjects first.")
            return {
                'success': False,
                'entries': [],
                'errors': self.errors,
                'warnings': self.warnings
            }
        
        # Step 2: Get available timeslots
        available_timeslots = self._get_available_timeslots()
        
        if not available_timeslots:
            self.errors.append("No timeslots found. Please generate timeslots first.")
            return {
                'success': False,
                'entries': [],
                'errors': self.errors,
                'warnings': self.warnings
            }
        
        # Step 3: Distribute subjects
        self._distribute_subjects(common_subjects, available_timeslots)
        
        return {
            'success': len(self.errors) == 0,
            'entries': self.allocated_entries,
            'errors': self.errors,
            'warnings': self.warnings
        }
    
    def _get_common_subjects(self, enable_addons: bool) -> QuerySet:
        """Get all common subjects for the college"""
        subjects = Subject.objects.filter(
            college=self.college,
            is_common=True
        )
        
        if not enable_addons:
            subjects = subjects.exclude(code='ADDON')
        
        return subjects
    
    def _get_available_timeslots(self) -> list:
        """Get all available timeslots for the college"""
        return list(TimeSlot.objects.filter(
            college=self.college
        ).order_by('day_order', 'period_number'))
    
    def _distribute_subjects(self, common_subjects, available_timeslots: list):
        """
        Distribute common subjects evenly across available slots.
        
        Creates entries for each year (1st, 2nd, 3rd year).
        """
        if not available_timeslots:
            self.errors.append("No available timeslots")
            return
        
        subjects_list = list(common_subjects)
        timeslot_list = available_timeslots
        
        # Distribute each subject to a slot
        for i, subject in enumerate(subjects_list):
            # Get slot index (distribute evenly)
            slot_index = i % len(timeslot_list)
            timeslot = timeslot_list[slot_index]
            
            # Create entry for each year
            for year in [1, 2, 3]:
                class_name = self._get_class_name(year)
                
                # Skip EDC and FC for 3rd year
                if year == 3 and subject.code in ['EDC', 'FC']:
                    continue
                
                entry = {
                    'college': self.college.id,
                    'class_name': class_name,
                    'subject': subject.id,
                    'timeslot': timeslot.id,
                    'is_common': True,
                }
                self.allocated_entries.append(entry)
    
    def _get_class_name(self, year: int) -> str:
        """Get class name for the given year"""
        if year == 1:
            return "1st Year"
        elif year == 2:
            return "2nd Year"
        elif year == 3:
            return "3rd Year"
        return f"{year}th Year"
    
    def save_entries(self) -> tuple:
        """
        Save generated entries to database.
        
        Returns:
            tuple: (success, count, errors)
        """
        saved_count = 0
        errors = []
        
        # Delete existing common entries
        TimetableEntry.objects.filter(
            college=self.college,
            is_common=True
        ).delete()
        
        for entry_data in self.allocated_entries:
            try:
                TimetableEntry.objects.create(
                    college=self.college,
                    class_name=entry_data['class_name'],
                    subject_id=entry_data['subject'],
                    timeslot_id=entry_data['timeslot'],
                    is_common=True
                )
                saved_count += 1
            except Exception as e:
                errors.append(f"Error saving entry: {str(e)}")
        
        return (len(errors) == 0, saved_count, errors)


def generate_common_timetable(college_id: int, enable_addons: bool = False) -> dict:
    """
    Convenience function to generate common timetable.
    
    Args:
        college_id: ID of the college
        enable_addons: Whether to include addon subjects
    
    Returns:
        dict: Generation result
    """
    try:
        college = College.objects.get(id=college_id)
    except College.DoesNotExist:
        return {
            'success': False,
            'entries': [],
            'errors': ['College not found'],
            'warnings': []
        }
    
    engine = CommonTimetableEngine(college)
    result = engine.generate(enable_addons)
    
    if result['success']:
        # Save entries
        success, count, errors = engine.save_entries()
        result['saved_count'] = count
        result['save_errors'] = errors
    
    return result
