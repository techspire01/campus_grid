import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function DepartmentEditPage() {
  const { departmentName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [department, setDepartment] = useState(null);
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
  const stateDepartmentId = location.state?.departmentId;
  const isCreateMode = !departmentName;

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const slugify = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  const fetchDepartmentData = useCallback(async () => {
    if (isCreateMode) {
      setDepartment(null);
      setFormData({
        name: '',
        code: '',
        years: { first: true, second: true, third: true },
        sections: { a: true, b: false },
        hod: { first_name: '', last_name: '', email: '', phone: '', password: '' },
        staff: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [departmentRes, usersRes] = await Promise.all([
        collegeId ? api.get(`/departments/?college=${collegeId}`) : api.get('/departments/'),
        collegeId ? api.get(`/users/?college=${collegeId}`) : api.get('/users/'),
      ]);

      const departmentData = departmentRes.data.results || departmentRes.data;
      const usersData = usersRes.data.results || usersRes.data;
      const requestedName = String(departmentName || '').trim().toLowerCase();

      let selectedDepartment = null;
      if (stateDepartmentId) {
        selectedDepartment = departmentData.find((entry) => String(entry.id) === String(stateDepartmentId));
      }
      if (!selectedDepartment) {
        selectedDepartment = departmentData.find(
          (entry) => String(entry.name || '').trim().toLowerCase() === requestedName
            || slugify(entry.name) === requestedName
        );
      }

      if (!selectedDepartment) {
        showSnackbar('Department not found', 'error');
        setDepartment(null);
        return;
      }

      setDepartment(selectedDepartment);

      const departmentUsers = usersData
        .filter((entry) => ['HOD', 'STAFF'].includes(entry.role))
        .filter((entry) => String(entry.department) === String(selectedDepartment.id));

      const existingHod = departmentUsers.find((entry) => entry.role === 'HOD');
      const existingStaff = departmentUsers
        .filter((entry) => entry.role !== 'HOD')
        .map((entry) => ({
          first_name: entry.first_name || '',
          last_name: entry.last_name || '',
          email: entry.email || '',
          phone: entry.phone || '',
          password: '',
          position: entry.role || 'STAFF',
        }));

      const years = { first: false, second: false, third: false };
      const sections = { a: false, b: false };
      try {
        const classRes = await api.get(`/classes/?department=${selectedDepartment.id}`);
        const classData = classRes.data.results || classRes.data;
        years.first = classData.some((entry) => entry.year === 1);
        years.second = classData.some((entry) => entry.year === 2);
        years.third = classData.some((entry) => entry.year === 3);
        sections.a = classData.some((entry) => entry.section === 'A');
        sections.b = classData.some((entry) => entry.section === 'B');
      } catch (error) {
        showSnackbar('Failed to load existing classes for this department', 'warning');
      }

      setFormData({
        name: selectedDepartment.name,
        code: selectedDepartment.code,
        years,
        sections,
        hod: {
          first_name: existingHod?.first_name || '',
          last_name: existingHod?.last_name || '',
          email: existingHod?.email || '',
          phone: existingHod?.phone || '',
          password: '',
        },
        staff: existingStaff,
      });
    } catch (error) {
      showSnackbar('Failed to load department data', 'error');
      setDepartment(null);
    } finally {
      setLoading(false);
    }
  }, [collegeId, departmentName, isCreateMode, stateDepartmentId]);

  useEffect(() => {
    fetchDepartmentData();
  }, [fetchDepartmentData]);

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

  const syncClassesForDepartment = async (departmentId) => {
    const selectedYears = [];
    if (formData.years.first) selectedYears.push(1);
    if (formData.years.second) selectedYears.push(2);
    if (formData.years.third) selectedYears.push(3);

    const selectedSections = [];
    if (formData.sections.a) selectedSections.push('A');
    if (formData.sections.b) selectedSections.push('B');

    try {
      const existingRes = await api.get(`/classes/?department=${departmentId}`);
      const existingClasses = existingRes.data.results || existingRes.data;

      const desiredClasses = [];
      for (const year of selectedYears) {
        for (const section of selectedSections) {
          desiredClasses.push({ year, section });
        }
      }

      const classesToDelete = existingClasses.filter(
        (existing) => !desiredClasses.some(
          (desired) => desired.year === existing.year && desired.section === existing.section
        )
      );

      const classesToCreate = desiredClasses.filter(
        (desired) => !existingClasses.some(
          (existing) => existing.year === desired.year && existing.section === desired.section
        )
      );

      for (const cls of classesToDelete) {
        try {
          await api.delete(`/classes/${cls.id}/`);
        } catch (error) {
          showSnackbar('Error deleting class record', 'warning');
        }
      }

      for (const cls of classesToCreate) {
        try {
          await api.post('/classes/', {
            department: departmentId,
            year: cls.year,
            section: cls.section,
          });
        } catch (error) {
          const duplicateError = error.response?.data?.non_field_errors?.[0]?.toLowerCase().includes('unique');
          if (!duplicateError) {
            showSnackbar('Error creating class record', 'warning');
          }
        }
      }
    } catch (error) {
      showSnackbar('Error syncing classes', 'warning');
    }
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
      } catch (error) {
        const message = error.response?.data?.role?.[0]
          || error.response?.data?.email?.[0]
          || error.response?.data?.detail
          || 'Failed to create one or more staff accounts';
        showSnackbar(message, 'warning');
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      showSnackbar('Department name and code are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
      };

      let departmentId;
      let departmentCollegeId;
      if (isCreateMode) {
        const departmentRes = await api.post('/departments/', payload);
        departmentId = departmentRes.data.id;
        departmentCollegeId = departmentRes.data.college;
        showSnackbar('Department created successfully', 'success');
      } else {
        await api.put(`/departments/${department.id}/`, payload);
        departmentId = department.id;
        departmentCollegeId = department.college;
        showSnackbar('Department updated successfully', 'success');
      }

      await syncClassesForDepartment(departmentId);
      await createAccountsForDepartment(departmentId, departmentCollegeId);
      navigate('/admin');
    } catch (error) {
      showSnackbar(error.response?.data?.detail || 'Unable to save department', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Typography>Loading department...</Typography>;
  }

  if (!isCreateMode && !department) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>Department Not Found</Typography>
        <Button variant="contained" onClick={() => navigate('/admin')}>Back to Admin</Button>
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Edit Department + Add Staff</Typography>
      <Typography color="textSecondary" sx={{ mb: 3 }}>
        {isCreateMode
          ? 'Create department and optionally add HOD/staff accounts.'
          : `Editing: ${department.name} (${department.code})`}
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
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
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Class Years</Typography>
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

        <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>Sections</Typography>
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
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Optional HOD Account (one per department)</Typography>
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

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => navigate('/admin')}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {isCreateMode ? 'Create' : 'Update'}
          </Button>
        </Box>
      </Paper>

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

export default DepartmentEditPage;
