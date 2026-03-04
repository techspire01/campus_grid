import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store';

function ClassesPage() {
  const user = useAuthStore((state) => state.user);
  const collegeId = useMemo(() => user?.college?.id || user?.college || null, [user]);

  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchDepartments();
  }, [collegeId]);

  useEffect(() => {
    fetchClasses();
  }, [collegeId, departmentFilter]);

  const fetchDepartments = async () => {
    try {
      const params = new URLSearchParams();
      if (collegeId) params.append('college', collegeId);
      const response = await api.get(`/departments/?${params.toString()}`);
      setDepartments(response.data.results || response.data);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load departments', severity: 'error' });
    }
  };

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (departmentFilter) params.append('department', departmentFilter);
      const response = await api.get(`/classes/?${params.toString()}`);
      setClasses(response.data.results || response.data);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load classes', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Classes
      </Typography>
      <Typography color="textSecondary" sx={{ mb: 3 }}>
        View classes and filter by department.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                label="Department"
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                <MenuItem value="">All Departments</MenuItem>
                {departments.map((department) => (
                  <MenuItem key={department.id} value={department.id}>
                    {department.code} - {department.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Class</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Subject Codes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Loading...</TableCell>
              </TableRow>
            ) : classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">No classes found</TableCell>
              </TableRow>
            ) : (
              classes.map((entry) => {
                const subjectCodes = (entry.assigned_subjects || [])
                  .filter((subject) => subject.code)
                  .map((subject) => subject.code)
                  .join(', ');
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Typography
                        component={Link}
                        to={`/classes/${entry.id}`}
                        sx={{ textDecoration: 'none' }}
                      >
                        {entry.department_code} - {entry.year_display || `Year ${entry.year}`} - {entry.section_display || entry.section}
                      </Typography>
                    </TableCell>
                    <TableCell>{entry.department_code} - {entry.department_name}</TableCell>
                    <TableCell>{entry.year_display || `Year ${entry.year}`}</TableCell>
                    <TableCell>{entry.section_display || entry.section}</TableCell>
                    <TableCell>{subjectCodes || '-'}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ClassesPage;
