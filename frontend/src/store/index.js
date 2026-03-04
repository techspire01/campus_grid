import { create } from 'zustand';

const defaultUser = {
  username: 'localadmin',
  email: 'localadmin@campus.local',
  first_name: 'Local',
  last_name: 'Admin',
  role: 'SUPER_ADMIN',
  college: 1,
  is_active: true,
};

export const useAuthStore = create((set) => ({
  user: defaultUser,
  token: null,
  isAuthenticated: true,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    set({ user: defaultUser, token: null, isAuthenticated: true });
  },

  initializeAuth: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      set({ token, user: JSON.parse(user), isAuthenticated: true });
      return;
    }

    set({ token: null, user: defaultUser, isAuthenticated: true });
  },

  canAccess: (requiredRole) => (state) => {
    if (!state.user) return false;
    if (state.user.role === 'SUPER_ADMIN') return true;
    return state.user.role === requiredRole;
  },
}));

export const useCollegeStore = create((set) => ({
  college: null,
  colleges: [],
  loading: false,
  error: null,

  setCollege: (college) => set({ college }),
  setColleges: (colleges) => set({ colleges }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export const useTimetableStore = create((set) => ({
  commonTimetable: null,
  departmentTimetable: null,
  entries: [],
  loading: false,

  setCommonTimetable: (timetable) => set({ commonTimetable: timetable }),
  setDepartmentTimetable: (timetable) => set({ departmentTimetable: timetable }),
  setEntries: (entries) => set({ entries }),
  setLoading: (loading) => set({ loading }),
}));

export const useWorkloadStore = create((set) => ({
  assignments: [],
  config: null,
  loading: false,

  setAssignments: (assignments) => set({ assignments }),
  setConfig: (config) => set({ config }),
  setLoading: (loading) => set({ loading }),
}));
