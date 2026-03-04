import api from './api';

// Authentication
export const authService = {
  login: (identifier, password) =>
    api.post('/auth/login/', { identifier, password }),
  logout: () => api.post('/auth/logout/'),
  changePassword: (oldPassword, newPassword) =>
    api.post('/auth/change-password/', { old_password: oldPassword, new_password: newPassword }),
};

// Colleges
export const collegeService = {
  list: (params) => api.get('/colleges/', { params }),
  create: (data) => api.post('/colleges/', data),
  get: (id) => api.get(`/colleges/${id}/`),
  update: (id, data) => api.put(`/colleges/${id}/`, data),
  delete: (id) => api.delete(`/colleges/${id}/`),
  statistics: (id) => api.get(`/colleges/${id}/statistics/`),
};

// Departments
export const departmentService = {
  list: (params) => api.get('/departments/', { params }),
  create: (data) => api.post('/departments/', data),
  get: (id) => api.get(`/departments/${id}/`),
  update: (id, data) => api.put(`/departments/${id}/`, data),
  delete: (id) => api.delete(`/departments/${id}/`),
  staffMembers: (id) => api.get(`/departments/${id}/staff_members/`),
  hodInfo: (id) => api.get(`/departments/${id}/hod_info/`),
};

// Labs
export const labService = {
  list: (params) => api.get('/labs/', { params }),
  create: (data) => api.post('/labs/', data),
  get: (id) => api.get(`/labs/${id}/`),
  update: (id, data) => api.put(`/labs/${id}/`, data),
  delete: (id) => api.delete(`/labs/${id}/`),
};

// Users
export const userService = {
  list: (params) => api.get('/users/', { params }),
  create: (data) => api.post('/users/', data),
  get: (id) => api.get(`/users/${id}/`),
  update: (id, data) => api.put(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
  currentUser: () => api.get('/users/me/'),
  hods: (params) => api.get('/users/hods/', { params }),
};

// Staff
export const staffService = {
  list: (params) => api.get('/staff/', { params }),
  create: (data) => api.post('/staff/', data),
  get: (id) => api.get(`/staff/${id}/`),
  update: (id, data) => api.put(`/staff/${id}/`, data),
  delete: (id) => api.delete(`/staff/${id}/`),
  setWorkload: (id, maxHours) =>
    api.patch(`/staff/${id}/set_workload/`, { max_workload_hours: maxHours }),
  workloadStatus: (id) => api.get(`/staff/${id}/workload_status/`),
};

// Workload
export const workloadService = {
  assignments: {
    list: (params) => api.get('/workload-assignments/', { params }),
    create: (data) => api.post('/workload-assignments/', data),
    get: (id) => api.get(`/workload-assignments/${id}/`),
    update: (id, data) => api.put(`/workload-assignments/${id}/`, data),
    delete: (id) => api.delete(`/workload-assignments/${id}/`),
    byStaff: (staffId) => api.get('/workload-assignments/by_staff/', { params: { staff_id: staffId } }),
    byDepartment: (deptId) => api.get('/workload-assignments/by_department/', { params: { department_id: deptId } }),
  },
  config: {
    list: (params) => api.get('/workload-config/', { params }),
    create: (data) => api.post('/workload-config/', data),
    get: (id) => api.get(`/workload-config/${id}/`),
    update: (id, data) => api.put(`/workload-config/${id}/`, data),
  },
};

export default {
  authService,
  collegeService,
  departmentService,
  labService,
  userService,
  staffService,
  workloadService,
};
