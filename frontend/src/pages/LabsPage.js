import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  Chip, Grid, Alert, Snackbar, Pagination, Switch, FormControlLabel
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function LabsPage() {
  const user = useAuthStore((state) => state.user);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    college: user?.college?.id || '',
    capacity: 30,
    is_available: true,
    equipment_details: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (user?.college?.id) params.append('college', user.college.id);
      params.append('page', page);

      const labsRes = await api.get(`/labs/?${params.toString()}`);

      setLabs(labsRes.data.results || labsRes.data);
      setTotalPages(Math.ceil((labsRes.data.count || labsRes.data.length) / 10) || 1);
    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (lab = null) => {
    if (lab) {
      setEditingLab(lab);
      setFormData({
        name: lab.name,
        college: lab.college,
        capacity: lab.capacity,
        is_available: lab.is_available,
        equipment_details: lab.equipment_details || ''
      });
    } else {
      setEditingLab(null);
      setFormData({
        name: '',
        college: user?.college?.id || '',
        capacity: 30,
        is_available: true,
        equipment_details: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingLab(null);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name) {
      showSnackbar('Please fill in all required fields (Name)', 'error');
      return;
    }

    try {
      const data = {
        name: formData.name,
        capacity: formData.capacity,
        is_available: formData.is_available
      };

      if (formData.college) {
        data.college = formData.college;
      }

      if (editingLab) {
        await api.put(`/labs/${editingLab.id}/`, data);
        showSnackbar('Lab updated successfully', 'success');
      } else {
        await api.post('/labs/', data);
        showSnackbar('Lab created successfully', 'success');
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving lab:', error);
      const errorMsg = error.response?.data?.code?.[0] || error.response?.data?.detail || 'Error saving lab';
      showSnackbar(errorMsg, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lab?')) return;
    try {
      await api.delete(`/labs/${id}/`);
      showSnackbar('Lab deleted successfully', 'success');
      fetchData();
    } catch (error) {
      console.error('Error deleting lab:', error);
      showSnackbar('Error deleting lab', 'error');
    }
  };

  const handleToggleAvailability = async (lab) => {
    try {
      await api.patch(`/labs/${lab.id}/`, { is_available: !lab.is_available });
      showSnackbar(`Lab ${lab.is_available ? 'disabled' : 'enabled'} successfully`, 'success');
      fetchData();
    } catch (error) {
      console.error('Error toggling lab:', error);
      showSnackbar('Error updating lab', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };



  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Lab Management
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Manage labs and their availability
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            
          </Grid>
          <Grid item xs={12} md={8}>
            
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
          Add Lab
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Lab Name</TableCell>
              <TableCell>Capacity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Equipment</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Loading...</TableCell>
              </TableRow>
            ) : labs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">No labs found</TableCell>
              </TableRow>
            ) : (
              labs.map(lab => (
                <TableRow key={lab.id}>
                  <TableCell>{lab.name}</TableCell>
                  <TableCell>{lab.capacity} students</TableCell>
                  <TableCell>
                    <Chip
                      label={lab.is_available ? 'Available' : 'Unavailable'}
                      color={lab.is_available ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {lab.equipment_details ? 
                      (lab.equipment_details.length > 50 ? 
                        lab.equipment_details.substring(0, 50) + '...' : 
                        lab.equipment_details) 
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpenDialog(lab)} size="small">
                      <Edit />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleToggleAvailability(lab)} 
                      size="small"
                      color={lab.is_available ? 'error' : 'success'}
                    >
                      <Switch checked={lab.is_available} size="small" />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(lab.id)} size="small" color="error">
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
        <DialogTitle>{editingLab ? 'Edit Lab' : 'Add Lab'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Lab Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Capacity"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                inputProps={{ min: 10, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_available}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  />
                }
                label="Available for Booking"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Equipment Details"
                value={formData.equipment_details}
                onChange={(e) => setFormData({ ...formData, equipment_details: e.target.value })}
                placeholder="List main equipment in the lab..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingLab ? 'Update' : 'Create'}
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

export default LabsPage;

