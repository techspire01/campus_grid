import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  Chip, Grid, Alert, Snackbar, LinearProgress, Card, CardContent, Tabs, Tab
} from '@mui/material';
import { Add, Edit, Delete, Person, AccessTime, School } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function WorkloadPage() {
  const { user } = useAuthStore();
  const isHOD = user?.role === 'HOD';
  const userDepartmentId = user?.department?.id || user?.department || null;
  const [assignments, setAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    staff: '',
    subject: '',
    department: '',
    class_name: '',
    hours_assigned: 3,
    is_approved: false
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (isHOD && userDepartmentId) {
        params.append('department', userDepartmentId);
      }

      const [assignmentsRes, staffRes, subjectsRes, deptsRes] = await Promise.all([
        api.get(`/workload-assignments/?${params.toString()}`),
        api.get('/staff/'),
        api.get('/subjects/'),
        api.get('/departments/')
      ]);

      setAssignments(assignmentsRes.data.results || assignmentsRes.data);
      setStaffList(staffRes.data.results || staffRes.data);
      setSubjects(subjectsRes.data.results || subjectsRes.data);
      setDepartments(deptsRes.data.results || deptsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (assignment = null) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setFormData({
        staff: assignment.staff,
        subject: assignment.subject,
        department: assignment.department,
        class_name: assignment.class_name,
        hours_assigned: assignment.hours_assigned,
        is_approved: assignment.is_approved
      });
    } else {
      setEditingAssignment(null);
      setFormData({
        staff: '',
        subject: '',
        department: user?.department?.id || '',
        class_name: '',
        hours_assigned: 3,
        is_approved: false
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAssignment(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingAssignment) {
        await api.put(`/workload-assignments/${editingAssignment.id}/`, formData);
        showSnackbar('Workload assignment updated successfully', 'success');
      } else {
        await api.post('/workload-assignments/', formData);
        showSnackbar('Workload assignment created successfully', 'success');
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving assignment:', error);
      showSnackbar(error.response?.data?.detail || Object.values(error.response?.data || {}).flat().join(', ') || 'Error saving assignment', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await api.delete(`/workload-assignments/${id}/`);
      showSnackbar('Assignment deleted successfully', 'success');
      fetchData();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      showSnackbar('Error deleting assignment', 'error');
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/workload-assignments/${id}/`, { is_approved: true });
      showSnackbar('Assignment approved', 'success');
      fetchData();
    } catch (error) {
      console.error('Error approving:', error);
      showSnackbar('Error approving assignment', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const getStaffWorkload = (staffId) => {
    const staffAssignments = assignments.filter(a => a.staff === staffId && a.is_approved);
    const totalHours = staffAssignments.reduce((sum, a) => sum + a.hours_assigned, 0);
    const staff = staffList.find(s => s.id === staffId);
    return {
      assigned: totalHours,
      max: staff?.max_workload_hours || 20,
      remaining: (staff?.max_workload_hours || 20) - totalHours
    };
  };

  const filteredAssignments = assignments.filter(a => {
    if (tabValue === 0) return !a.is_approved;
    if (tabValue === 1) return a.is_approved;
    return true;
  });

  // Group by staff
  const staffWorkloadMap = {};
  assignments.forEach(a => {
    if (!staffWorkloadMap[a.staff]) {
      const staff = staffList.find(s => s.id === a.staff);
      staffWorkloadMap[a.staff] = {
        staff,
        assignments: [],
        totalHours: 0,
        maxHours: staff?.max_workload_hours || 20
      };
    }
    staffWorkloadMap[a.staff].assignments.push(a);
    if (a.is_approved) {
      staffWorkloadMap[a.staff].totalHours += a.hours_assigned;
    }
  });

  const canManageWorkload =
    user?.role === 'HOD' || user?.role === 'SUPER_ADMIN' || user?.role === 'COLLEGE_ADMIN';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Workload Management
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Assign subjects and manage staff workload allocations
      </Typography>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Pending Assignments" />
          <Tab label="Approved Assignments" />
          <Tab label="All Assignments" />
        </Tabs>
      </Paper>

      {/* Workload Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {Object.values(staffWorkloadMap).map(sw => (
          <Grid item xs={12} md={4} key={sw.staff?.id}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Person sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    {sw.staff?.user?.first_name} {sw.staff?.user?.last_name || 'Staff'}
                  </Typography>
                </Box>
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Workload</Typography>
                    <Typography variant="body2">{sw.totalHours} / {sw.maxHours} hours</Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(sw.totalHours / sw.maxHours) * 100}
                    color={sw.totalHours > sw.maxHours ? 'error' : sw.totalHours > sw.maxHours * 0.8 ? 'warning' : 'primary'}
                  />
                </Box>
                <Typography variant="caption" color="textSecondary">
                  {sw.maxHours - sw.totalHours} hours remaining
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add Button */}
      {canManageWorkload && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Workload Assignment
          </Button>
        </Box>
      )}

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Staff</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Hours</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">Loading...</TableCell>
              </TableRow>
            ) : filteredAssignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">No assignments found</TableCell>
              </TableRow>
            ) : (
              filteredAssignments.map(assignment => {
                const staff = staffList.find(s => s.id === assignment.staff);
                const subject = subjects.find(s => s.id === assignment.subject);
                const dept = departments.find(d => d.id === assignment.department);
                return (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      {staff?.user?.first_name} {staff?.user?.last_name}
                    </TableCell>
                    <TableCell>{subject?.name || assignment.subject}</TableCell>
                    <TableCell>{dept?.name || assignment.department}</TableCell>
                    <TableCell>{assignment.class_name}</TableCell>
                    <TableCell>{assignment.hours_assigned} hrs</TableCell>
                    <TableCell>
                      <Chip
                        label={assignment.is_approved ? 'Approved' : 'Pending'}
                        color={assignment.is_approved ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {canManageWorkload && !assignment.is_approved && (
                        <IconButton 
                          onClick={() => handleApprove(assignment.id)} 
                          size="small" 
                          color="success"
                        >
                          <Person />
                        </IconButton>
                      )}
                      {canManageWorkload && (
                        <>
                          <IconButton onClick={() => handleOpenDialog(assignment)} size="small">
                            <Edit />
                          </IconButton>
                          <IconButton onClick={() => handleDelete(assignment.id)} size="small" color="error">
                            <Delete />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAssignment ? 'Edit Workload Assignment' : 'Add Workload Assignment'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Staff Member</InputLabel>
                <Select
                  value={formData.staff}
                  label="Staff Member"
                  onChange={(e) => setFormData({ ...formData, staff: e.target.value })}
                >
                  {staffList
                    .filter(s => (isHOD && userDepartmentId ? s.department === userDepartmentId : true))
                    .map(staff => (
                      <MenuItem key={staff.id} value={staff.id}>
                        {staff.user?.first_name} {staff.user?.last_name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Subject</InputLabel>
                <Select
                  value={formData.subject}
                  label="Subject"
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                >
                  {subjects.map(subject => (
                    <MenuItem key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department}
                  label="Department"
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Class Name"
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                placeholder="e.g., CSE-A Year 1"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Hours"
                value={formData.hours_assigned}
                onChange={(e) => setFormData({ ...formData, hours_assigned: parseInt(e.target.value) })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.is_approved}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, is_approved: e.target.value })}
                >
                  <MenuItem value={false}>Pending</MenuItem>
                  <MenuItem value={true}>Approved</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingAssignment ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default WorkloadPage;

