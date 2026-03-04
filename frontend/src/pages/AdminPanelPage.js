import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { Add, Delete, Edit, Refresh } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function AdminPanelPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [departments, setDepartments] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openStaffDialog, setOpenStaffDialog] = useState(false);
  const [staffEditForm, setStaffEditForm] = useState({
    id: null,
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'STAFF',
    department: '',
    password: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const collegeId = useMemo(() => user?.college?.id || user?.college || null, [user]);

  useEffect(() => {
    fetchData();
  }, [collegeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const departmentRes = collegeId
        ? await api.get(`/departments/?college=${collegeId}`)
        : await api.get('/departments/');

      const departmentData = departmentRes.data.results || departmentRes.data;
      setDepartments(departmentData);

      const usersRes = collegeId
        ? await api.get(`/users/?college=${collegeId}`)
        : await api.get('/users/');
      const usersData = usersRes.data.results || usersRes.data;
      setStaffUsers(usersData.filter((entry) => ['HOD', 'STAFF'].includes(entry.role)));

      const staffRes = await api.get('/staff/');
      const staffData = staffRes.data.results || staffRes.data;
      setStaffProfiles(staffData);
    } catch (error) {
      showSnackbar('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (department) => {
    if (!window.confirm(`Delete department ${department.name}?`)) {
      return;
    }

    try {
      await api.delete(`/departments/${department.id}/`);
      showSnackbar('Department deleted successfully', 'success');
      fetchData();
    } catch (error) {
      showSnackbar('Unable to delete department', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenStaffEdit = (entry) => {
    setStaffEditForm({
      id: entry.id,
      first_name: entry.first_name || '',
      last_name: entry.last_name || '',
      email: entry.email || '',
      phone: entry.phone || '',
      role: entry.role || 'STAFF',
      department: entry.department || '',
      password: '',
    });
    setOpenStaffDialog(true);
  };

  const handleSaveStaffEdit = async () => {
    if (!staffEditForm.id) {
      showSnackbar('Invalid staff account', 'error');
      return;
    }

    try {
      const departmentValue = staffEditForm.department || null;
      await api.patch(`/users/${staffEditForm.id}/`, {
        first_name: staffEditForm.first_name,
        last_name: staffEditForm.last_name,
        email: staffEditForm.email,
        phone: staffEditForm.phone,
        role: staffEditForm.role,
        department: departmentValue,
        ...(staffEditForm.password ? { password: staffEditForm.password } : {}),
      });

      const existingProfile = staffProfiles.find((profile) => profile.user === staffEditForm.id);
      if (existingProfile) {
        await api.patch(`/staff/${existingProfile.id}/`, {
          department: departmentValue,
        });
      } else if (departmentValue) {
        await api.post('/staff/', {
          user: staffEditForm.id,
          department: departmentValue,
        });
      }

      setOpenStaffDialog(false);
      showSnackbar('Staff profile updated successfully', 'success');
      fetchData();
    } catch (error) {
      const message = error.response?.data?.department?.[0]
        || error.response?.data?.role?.[0]
        || error.response?.data?.email?.[0]
        || error.response?.data?.detail
        || 'Failed to update staff profile';
      showSnackbar(message, 'error');
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>
      <Typography color="textSecondary" sx={{ mb: 3 }}>
        Create and manage departments and staff accounts.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary">Total Departments</Typography>
              <Typography variant="h5">{departments.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary">Total Staff + HOD Accounts</Typography>
              <Typography variant="h5">{staffUsers.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchData}>
          Refresh
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/department/create')}>
          Add Department
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Department Code</TableCell>
              <TableCell>Department Name</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center">Loading...</TableCell>
              </TableRow>
            ) : departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">No departments found</TableCell>
              </TableRow>
            ) : (
              departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell>{department.code}</TableCell>
                  <TableCell>{department.name}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(
                        `/admin/department/${encodeURIComponent(department.name)}`,
                        { state: { departmentId: department.id } }
                      )}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(department)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Department Staff Accounts
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Position</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staffUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">No staff accounts found</TableCell>
              </TableRow>
            ) : (
              staffUsers.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{`${entry.first_name || ''} ${entry.last_name || ''}`.trim() || entry.username}</TableCell>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>{entry.department_name || '-'}</TableCell>
                  <TableCell>{entry.role === 'HOD' ? 'HOD' : 'Staff'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenStaffEdit(entry)}>
                      <Edit />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openStaffDialog} onClose={() => setOpenStaffDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Staff Account</DialogTitle>
        <DialogContent>
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="First Name"
                fullWidth
                value={staffEditForm.first_name}
                onChange={(e) => setStaffEditForm((prev) => ({ ...prev, first_name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="Last Name"
                fullWidth
                value={staffEditForm.last_name}
                onChange={(e) => setStaffEditForm((prev) => ({ ...prev, last_name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="Email"
                fullWidth
                value={staffEditForm.email}
                onChange={(e) => setStaffEditForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="Phone"
                fullWidth
                value={staffEditForm.phone}
                onChange={(e) => setStaffEditForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="dense">
                <InputLabel>Position</InputLabel>
                <Select
                  label="Position"
                  value={staffEditForm.role}
                  onChange={(e) => setStaffEditForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <MenuItem value="STAFF">Staff</MenuItem>
                  <MenuItem value="HOD">HOD</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="dense">
                <InputLabel>Department</InputLabel>
                <Select
                  label="Department"
                  value={staffEditForm.department}
                  onChange={(e) => setStaffEditForm((prev) => ({ ...prev, department: e.target.value }))}
                >
                  <MenuItem value="">No Department</MenuItem>
                  {departments.map((department) => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.code} - {department.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="dense"
                label="New Password (optional)"
                type="password"
                fullWidth
                value={staffEditForm.password}
                onChange={(e) => setStaffEditForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStaffDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveStaffEdit}>Save</Button>
        </DialogActions>
      </Dialog>

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

export default AdminPanelPage;
