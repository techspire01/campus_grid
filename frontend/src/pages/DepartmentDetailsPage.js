import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
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
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack, Edit } from '@mui/icons-material';
import api from '../services/api';
import { departmentService } from '../services';

function DepartmentDetailsPage() {
  const { departmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [department, setDepartment] = useState(null);
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    max_workload_hours: 20,
  });

  useEffect(() => {
    fetchDepartmentData();
  }, [departmentId]);

  const fetchDepartmentData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch department details
      const deptRes = await departmentService.get(departmentId);
      setDepartment(deptRes.data);

      // Fetch classes for this department
      const classesRes = await api.get(`/classes/?department=${departmentId}`);
      const classesData = classesRes.data.results || classesRes.data;
      setClasses(Array.isArray(classesData) ? classesData : []);

      // Fetch staff for this department
      const staffRes = await departmentService.staffMembers(departmentId);
      const staffData = staffRes.data.results || staffRes.data;
      setStaff(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      console.error('Error fetching department data:', err);
      setError('Failed to load department data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStaff = (staffMember) => {
    setEditingStaff(staffMember);
    
    // Parse the user name to get first and last name
    const fullName = staffMember.user_name || '';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    setFormData({
      first_name: firstName,
      last_name: lastName,
      email: staffMember.user_email || '',
      phone: staffMember.user_phone || '',
      role: staffMember.user_role || 'STAFF',
      max_workload_hours: staffMember.max_workload_hours || 20,
    });
    setEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setEditingStaff(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: '',
      max_workload_hours: 20,
    });
  };

  const handleSaveStaff = async () => {
    if (!editingStaff) return;

    setSaving(true);
    try {
      // Update staff workload hours
      await api.patch(`/staff/${editingStaff.id}/`, {
        max_workload_hours: formData.max_workload_hours,
      });

      // Update user details
      await api.patch(`/users/${editingStaff.user}/`, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
      });

      setSnackbar({ open: true, message: 'Staff updated successfully', severity: 'success' });
      handleCloseDialog();
      fetchDepartmentData();
    } catch (err) {
      console.error('Error updating staff:', err);
      const errorMessage = err.response?.data?.error || 'Failed to update staff';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">
          Department Details
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Department Details Card */}
      {department && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary" gutterBottom>
                  Department Name
                </Typography>
                <Typography variant="h6">{department.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary" gutterBottom>
                  Department Code
                </Typography>
                <Typography variant="h6">{department.code}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Classes Section */}
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
        Classes
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Class</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Section</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  No classes found
                </TableCell>
              </TableRow>
            ) : (
              classes.map((classItem) => (
                <TableRow
                  key={classItem.id}
                  onClick={() => navigate(`/classes/${classItem.id}`)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                >
                  <TableCell>
                    {classItem.department_code} - {classItem.year_display || `Year ${classItem.year}`} -{' '}
                    {classItem.section_display || classItem.section}
                  </TableCell>
                  <TableCell>{classItem.year_display || `Year ${classItem.year}`}</TableCell>
                  <TableCell>{classItem.section_display || classItem.section}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Staff Section */}
      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Staff Members
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Workload (Hours)</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No staff members found
                </TableCell>
              </TableRow>
            ) : (
              staff.map((staffMember) => {
                const name = staffMember.user_name || '-';
                const email = staffMember.user_email || '-';
                const phone = staffMember.user_phone || '-';
                const role = staffMember.user_role || 'Staff';
                const currentHours = staffMember.current_workload_hours || 0;
                const maxHours = staffMember.max_workload_hours || 20;
                const workload = `${currentHours} / ${maxHours}`;
                return (
                  <TableRow key={staffMember.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{email}</TableCell>
                    <TableCell>{phone}</TableCell>
                    <TableCell>{role}</TableCell>
                    <TableCell>{workload}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEditStaff(staffMember)}
                      >
                        <Edit />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Edit Staff Member</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                  <MenuItem value="COLLEGE_ADMIN">College Admin</MenuItem>
                  <MenuItem value="HOD">Head of Department</MenuItem>
                  <MenuItem value="LAB_INCHARGE">Lab Incharge</MenuItem>
                  <MenuItem value="COMMON_SUBJECT_HEAD">Common Subject Head</MenuItem>
                  <MenuItem value="STAFF">Staff</MenuItem>
                  <MenuItem value="STUDENT">Student</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Workload Hours"
                type="number"
                value={formData.max_workload_hours}
                onChange={(e) => setFormData({ ...formData, max_workload_hours: parseInt(e.target.value) || 0 })}
                inputProps={{ min: 0, max: 40 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveStaff} 
            variant="contained" 
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default DepartmentDetailsPage;
