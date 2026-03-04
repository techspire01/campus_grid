import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CardContent,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
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
  const user = useAuthStore((state) => state.user);
  const [departments, setDepartments] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    years: { first: false, second: false, third: false },
    sections: { a: false, b: false },
    hod: { first_name: '', last_name: '', email: '', phone: '', password: '' },
    staff: [],
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
    } catch (error) {
      showSnackbar('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingDepartment(null);
    setFormData({
      name: '',
      code: '',
      years: { first: false, second: false, third: false },
      sections: { a: false, b: false },
      hod: { first_name: '', last_name: '', email: '', phone: '', password: '' },
      staff: [],
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      code: department.code,
      years: { first: false, second: false, third: false },
      sections: { a: false, b: false },
      hod: { first_name: '', last_name: '', email: '', phone: '', password: '' },
      staff: [],
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDepartment(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      showSnackbar('Department name and code are required', 'warning');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
      };

      let departmentId;
      let departmentCollegeId;
      if (editingDepartment) {
        await api.put(`/departments/${editingDepartment.id}/`, payload);
        departmentId = editingDepartment.id;
        departmentCollegeId = editingDepartment.college;
        showSnackbar('Department updated successfully', 'success');
      } else {
        const departmentRes = await api.post('/departments/', payload);
        departmentId = departmentRes.data.id;
        departmentCollegeId = departmentRes.data.college;
        await createClassesForDepartment(departmentId);
        showSnackbar('Department created successfully', 'success');
      }

      await createAccountsForDepartment(departmentId, departmentCollegeId);

      handleCloseDialog();
      fetchData();
    } catch (error) {
      showSnackbar(error.response?.data?.detail || 'Unable to save department', 'error');
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

  const createAccountsForDepartment = async (departmentId, departmentCollegeId) => {
    const requests = [];

    const hod = formData.hod;
    const hasHodData = hod.email.trim() && hod.password.trim() && hod.first_name.trim();
    if (hasHodData) {
      requests.push({
        first_name: hod.first_name.trim(),
        last_name: hod.last_name.trim(),
        email: hod.email.trim().toLowerCase(),
        phone: hod.phone.trim(),
        password: hod.password,
        role: 'HOD',
      });
    }

    formData.staff.forEach((row) => {
      if (row.email.trim() && row.password.trim() && row.first_name.trim()) {
        requests.push({
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          email: row.email.trim().toLowerCase(),
          phone: row.phone.trim(),
          password: row.password,
          role: row.position,
        });
      }
    });

    if (requests.length === 0) {
      return;
    }

    let successCount = 0;
    for (const account of requests) {
      try {
        const userRes = await api.post('/users/', {
          username: account.email,
          email: account.email,
          first_name: account.first_name,
          last_name: account.last_name,
          phone: account.phone,
          role: account.role,
          college: departmentCollegeId,
          department: departmentId,
          password: account.password,
          is_active: true,
        });

        await api.post('/staff/', {
          user: userRes.data.id,
          department: departmentId,
        });

        successCount += 1;
      } catch (error) {
        const message = error.response?.data?.role?.[0]
          || error.response?.data?.email?.[0]
          || error.response?.data?.detail
          || 'Failed to create one or more staff accounts';
        showSnackbar(message, 'warning');
      }
    }

    if (successCount > 0) {
      showSnackbar(`${successCount} staff account(s) created`, 'success');
    }
  };

  const addStaffRow = () => {
    setFormData((prev) => ({
      ...prev,
      staff: [...prev.staff, { first_name: '', last_name: '', email: '', phone: '', password: '', position: 'STAFF' }],
    }));
  };

  const updateStaffRow = (index, key, value) => {
    setFormData((prev) => ({
      ...prev,
      staff: prev.staff.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [key]: value } : entry)),
    }));
  };

  const removeStaffRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      staff: prev.staff.filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const createClassesForDepartment = async (departmentId) => {
    const selectedYears = [];
    if (formData.years.first) selectedYears.push(1);
    if (formData.years.second) selectedYears.push(2);
    if (formData.years.third) selectedYears.push(3);

    const selectedSections = [];
    if (formData.sections.a) selectedSections.push('A');
    if (formData.sections.b) selectedSections.push('B');

    if (selectedYears.length === 0 || selectedSections.length === 0) {
      return;
    }

    let createdCount = 0;
    for (const year of selectedYears) {
      for (const section of selectedSections) {
        try {
          await api.post('/classes/', {
            department: departmentId,
            year,
            section,
          });
          createdCount += 1;
        } catch (error) {
          const duplicateError = error.response?.data?.non_field_errors?.[0]?.toLowerCase().includes('unique');
          if (!duplicateError) {
            showSnackbar('Some classes could not be created', 'warning');
          }
        }
      }
    }

    if (createdCount > 0) {
      showSnackbar(`${createdCount} class(es) created`, 'success');
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
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
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
                    <IconButton size="small" onClick={() => handleOpenEdit(department)}>
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
            </TableRow>
          </TableHead>
          <TableBody>
            {staffUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">No staff accounts found</TableCell>
              </TableRow>
            ) : (
              staffUsers.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{`${entry.first_name || ''} ${entry.last_name || ''}`.trim() || entry.username}</TableCell>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>{entry.department_name || '-'}</TableCell>
                  <TableCell>{entry.role === 'HOD' ? 'HOD' : 'Staff'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingDepartment ? 'Edit Department + Add Staff' : 'Create Department + Add Staff'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Department Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Department Code"
            fullWidth
            value={formData.code}
            onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
          />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Class Years
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={formData.years.first}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      years: { ...prev.years, first: e.target.checked },
                    }))}
                  />
                )}
                label="1st Year"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={formData.years.second}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      years: { ...prev.years, second: e.target.checked },
                    }))}
                  />
                )}
                label="2nd Year"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={formData.years.third}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      years: { ...prev.years, third: e.target.checked },
                    }))}
                  />
                )}
                label="3rd Year"
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
            Sections
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={formData.sections.a}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, a: e.target.checked },
                    }))}
                  />
                )}
                label="Section A"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={formData.sections.b}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, b: e.target.checked },
                    }))}
                  />
                )}
                label="Section B"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Optional HOD Account (one per department)
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="HOD First Name"
                fullWidth
                value={formData.hod.first_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, hod: { ...prev.hod, first_name: e.target.value } }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="HOD Last Name"
                fullWidth
                value={formData.hod.last_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, hod: { ...prev.hod, last_name: e.target.value } }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="HOD Email"
                fullWidth
                value={formData.hod.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, hod: { ...prev.hod, email: e.target.value } }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="HOD Password"
                type="password"
                fullWidth
                value={formData.hod.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, hod: { ...prev.hod, password: e.target.value } }))}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">Additional Staff Accounts</Typography>
            <Button size="small" startIcon={<Add />} onClick={addStaffRow}>Add Staff Row</Button>
          </Box>

          {formData.staff.map((entry, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 1.5, mt: 1.5 }}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="dense"
                    label="First Name"
                    fullWidth
                    value={entry.first_name}
                    onChange={(e) => updateStaffRow(index, 'first_name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="dense"
                    label="Last Name"
                    fullWidth
                    value={entry.last_name}
                    onChange={(e) => updateStaffRow(index, 'last_name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="dense"
                    label="Email"
                    fullWidth
                    value={entry.email}
                    onChange={(e) => updateStaffRow(index, 'email', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    margin="dense"
                    label="Password"
                    type="password"
                    fullWidth
                    value={entry.password}
                    onChange={(e) => updateStaffRow(index, 'password', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth margin="dense">
                    <InputLabel>Position</InputLabel>
                    <Select
                      label="Position"
                      value={entry.position}
                      onChange={(e) => updateStaffRow(index, 'position', e.target.value)}
                    >
                      <MenuItem value="STAFF">Staff</MenuItem>
                      <MenuItem value="HOD">HOD</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Button color="error" onClick={() => removeStaffRow(index)}>Remove</Button>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingDepartment ? 'Update' : 'Create'}
          </Button>
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
