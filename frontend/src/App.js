import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { useAuthStore } from './store';

// Pages
import DashboardPage from './pages/DashboardPage';
import AdminPanelPage from './pages/AdminPanelPage';
import DepartmentEditPage from './pages/DepartmentEditPage';
import TimetableGridPage from './pages/TimetableGridPage';
import ApprovalPage from './pages/ApprovalPage';
import WorkloadPage from './pages/WorkloadPage';
import SubjectsPage from './pages/SubjectsPage';
import LabsPage from './pages/LabsPage';
import ClassesPage from './pages/ClassesPage';
import ClassDetailPage from './pages/ClassDetailPage';
import CommonTimetablePage from './pages/CommonTimetablePage';
import DepartmentTimetablePage from './pages/DepartmentTimetablePage';
import FinalTimetablePage from './pages/FinalTimetablePage';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
  },
});

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/admin" element={<AdminPanelPage />} />
                    <Route path="/admin/department/create" element={<DepartmentEditPage />} />
                    <Route path="/admin/department/:departmentName" element={<DepartmentEditPage />} />
                    <Route path="/subjects" element={<SubjectsPage />} />
                    <Route path="/labs" element={<LabsPage />} />
                    <Route path="/classes" element={<ClassesPage />} />
                    <Route path="/classes/:classId" element={<ClassDetailPage />} />
                    <Route path="/common-timetable" element={<CommonTimetablePage />} />
                    <Route path="/department-timetable" element={<DepartmentTimetablePage />} />
                    <Route path="/timetable" element={<TimetableGridPage />} />
                    <Route path="/final-timetable" element={<FinalTimetablePage />} />
                    <Route path="/approvals" element={<ApprovalPage />} />
                    <Route path="/workload" element={<WorkloadPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
