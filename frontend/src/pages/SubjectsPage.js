import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  Chip, Grid, Alert, Snackbar, Pagination, FormControlLabel
} from '@mui/material';
import { Add, Edit, Delete, FilterList } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function SubjectsPage() {
  const user = useAuthStore((state) => state.user);
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [filters, setFilters] = useState({
    department: '',
    is_common: '',
    is_lab: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    college: user?.college?.id || '',
    department: '',
    is_common: false,
    is_lab: false,
    hours_per_week: 3,
    year: '',
    semester: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [filters, page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.department) params.append('department', filters.department);
      if (filters.is_common !== '') params.append('is_common', filters.is_common);
      if (filters.is_lab !== '') params.append('is_lab', filters.is_lab);
      if (user?.college?.id) params.append('college', user.college.id);
      params.append('page', page);

      const [subjectsRes, deptsRes] = await Promise.all([
        api.get(`/subjects/?${params.toString()}`),
        api.get('/departments/')
      ]);

      setSubjects(subjectsRes.data.results || subjectsRes.data);
      setDepartments(deptsRes.data.results || deptsRes.data);
      setTotalPages(Math.ceil((subjectsRes.data.count || subjectsRes.data.length) / 10) || 1);
    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (subject = null) => {
    if (subject) {
      setEditingSubject(subject);
      setFormData({
        name: subject.name,
        code: subject.code,
        college: subject.college,
        department: subject.department || '',
        is_common: subject.is_common,
        is_lab: subject.is_lab,
        hours_per_week: subject.hours_per_week,
        year: subject.year || '',
        semester: subject.semester || ''
      });
    } else {
      setEditingSubject(null);
      setFormData({
        name: '',
        code: '',
        college: user?.college?.id || '',
        department: '',
        is_common: false,
        is_lab: false,
        hours_per_week: 3,
        year: '',
        semester: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSubject(null);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        ...formData,
        department: formData.department || null,
        year: formData.year || null,
        semester: formData.semester || null
      };

      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}/`, data);
        showSnackbar('Subject updated successfully', 'success');
      } else {
        await api.post('/subjects/', data);
        showSnackbar('Subject created successfully', 'success');
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving subject:', error);
      showSnackbar(error.response?.data?.detail || 'Error saving subject', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) return;
    try {
      await api.delete(`/subjects/${id}/`);
      showSnackbar('Subject deleted successfully', 'success');
      fetchData();
    } catch (error) {
      console.error('Error deleting subject:', error);
      showSnackbar('Error deleting subject', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Subject Management
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Manage common and core subjects
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FilterList sx={{ mr: 1 }} />
            <Typography variant="subtitle1" component="span">Filters:</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={filters.department}
                label="Department"
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {departments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.is_common}
                label="Type"
                onChange={(e) => handleFilterChange('is_common', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Common</MenuItem>
                <MenuItem value="false">Core</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Lab</InputLabel>
              <Select
                value={filters.is_lab}
                label="Lab"
                onChange={(e) => handleFilterChange('is_lab', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Lab</MenuItem>
                <MenuItem value="false">Theory</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Add Button */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Subject
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Hours/Week</TableCell>
              <TableCell>Lab</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">Loading...</TableCell>
              </TableRow>
            ) : subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">No subjects found</TableCell>
              </TableRow>
            ) : (
              subjects.map(subject => (
                <TableRow key={subject.id}>
                  <TableCell>{subject.code}</TableCell>
                  <TableCell>{subject.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={subject.is_common ? 'Common' : 'Core'}
                      color={subject.is_common ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{subject.department_name || 'All'}</TableCell>
                  <TableCell>{subject.hours_per_week}</TableCell>
                  <TableCell>
                    <Chip
                      label={subject.is_lab ? 'Lab' : 'Theory'}
                      color={subject.is_lab ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{subject.year || 'All'}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpenDialog(subject)} size="small">
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(subject.id)} size="small" color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(e, value) => setPage(value)}
          color="primary"
        />
      </Box>

      {/* Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Subject Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Subject Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department}
                  label="Department"
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  disabled={formData.is_common}
                >
                  <MenuItem value="">Select Department</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Hours per Week"
                value={formData.hours_per_week}
                onChange={(e) => setFormData({ ...formData, hours_per_week: parseInt(e.target.value) })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  value={formData.year}
                  label="Year"
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                >
                  <MenuItem value="">All Years</MenuItem>
                  {[1, 2, 3, 4].map(year => (
                    <MenuItem key={year} value={year}>Year {year}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Semester</InputLabel>
                <Select
                  value={formData.semester}
                  label="Semester"
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                >
                  <MenuItem value="">All Semesters</MenuItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <MenuItem key={sem} value={sem}>Semester {sem}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <FormControlLabel
                  control={
                    <input
                      type="checkbox"
                      checked={formData.is_common}
                      onChange={(e) => setFormData({ ...formData, is_common: e.target.checked, department: e.target.checked ? '' : formData.department })}
                    />
                  }
                  label="Common Subject"
                />
                <FormControlLabel
                  control={
                    <input
                      type="checkbox"
                      checked={formData.is_lab}
                      onChange={(e) => setFormData({ ...formData, is_lab: e.target.checked })}
                    />
                  }
                  label="Lab Subject"
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingSubject ? 'Update' : 'Create'}
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

export default SubjectsPage;

