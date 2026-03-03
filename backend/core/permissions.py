from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    """Allow access only to Super Admins"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_super_admin()


class IsCollegeAdmin(permissions.BasePermission):
    """Allow access only to College Admins"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_college_admin()


class IsHOD(permissions.BasePermission):
    """Allow access only to HODs"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_hod()


class IsLabIncharge(permissions.BasePermission):
    """Allow access only to Lab Incharge"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_lab_incharge()


class IsCommonSubjectHead(permissions.BasePermission):
    """Allow access only to Common Subject Heads"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_common_subject_head()


class IsStaff(permissions.BasePermission):
    """Allow access only to Staff"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'STAFF'


class IsStudent(permissions.BasePermission):
    """Allow access only to Students"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'STUDENT'


class IsSuperAdminOrCollegeAdmin(permissions.BasePermission):
    """Allow access to Super Admins or College Admins"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (request.user.is_super_admin() or request.user.is_college_admin())


class CanAccessCollege(permissions.BasePermission):
    """Allow access to users of the same college"""
    def has_object_permission(self, request, view, obj):
        if request.user.is_super_admin():
            return True
        return request.user.college_id == obj.college_id


class CanAccessDepartment(permissions.BasePermission):
    """Allow access to department based on user's college"""
    def has_object_permission(self, request, view, obj):
        if request.user.is_super_admin():
            return True
        return request.user.college_id == obj.college_id
