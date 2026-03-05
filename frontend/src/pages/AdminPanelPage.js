import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
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
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import api from '../services/api';
import { useAuthStore } from '../store';

function AdminPanelPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [departments, setDepartments] = useState([]);
  const [subjectTypes, setSubjectTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openSubjectTypeDialog, setOpenSubjectTypeDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [timingId, setTimingId] = useState(null);
  const [periodRows, setPeriodRows] = useState([{ id: 'row-1', start_time: null, end_time: null }]);
  const [savingTiming, setSavingTiming] = useState(false);
  const [workingDays, setWorkingDays] = useState(6);
  const [subjectTypeForm, setSubjectTypeForm] = useState({
    id: null,
    name: '',
    code: '',
    description: '',
    is_active: true,
  });

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

      const subjectTypeRes = await api.get('/subject-types/');
      const subjectTypeData = subjectTypeRes.data.results || subjectTypeRes.data;
      setSubjectTypes(subjectTypeData);

      if (collegeId) {
        const collegeRes = await api.get(`/colleges/${collegeId}/`);
        const collegeData = collegeRes.data;
        setWorkingDays(collegeData.working_days || 6);
        const timingRes = await api.get(`/college-timings/?college=${collegeId}`);
        const timingData = timingRes.data.results || timingRes.data;
        const activeTiming = timingData[0] || null;

        if (activeTiming) {
          setTimingId(activeTiming.id);
          const loadedRows = (activeTiming.split_hours || []).map((row, index) => ({
            id: `loaded-${index + 1}`,
            start_time: row.start_time ? dayjs(`2000-01-01T${row.start_time}`) : null,
            end_time: row.end_time ? dayjs(`2000-01-01T${row.end_time}`) : null,
          }));

          setPeriodRows(loadedRows.length ? loadedRows : [{ id: 'row-1', start_time: null, end_time: null }]);
        } else {
          setTimingId(null);
          setPeriodRows([{ id: 'row-1', start_time: null, end_time: null }]);
        }
      }
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

  const toTimeString = (value) => (value && dayjs(value).isValid() ? dayjs(value).format('HH:mm') : null);

  const handleAddPeriodRow = () => {
    setPeriodRows((prev) => [...prev, { id: `row-${Date.now()}`, start_time: null, end_time: null }]);
  };

  const handleRemovePeriodRow = (rowId) => {
    setPeriodRows((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handlePeriodTimeChange = (rowId, field, value) => {
    setPeriodRows((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, [field]: value } : row
    )));
  };

  const handleSaveCollegeTiming = async () => {
    if (!collegeId) {
      showSnackbar('College is not configured for your account', 'error');
      return;
    }

    if (!periodRows.length) {
      showSnackbar('Add at least one period timing', 'error');
      return;
    }

    const normalizedPeriods = periodRows.map((row, index) => ({
      period_number: index + 1,
      start_time: toTimeString(row.start_time),
      end_time: toTimeString(row.end_time),
    }));

    const hasEmpty = normalizedPeriods.some((period) => !period.start_time || !period.end_time);
    if (hasEmpty) {
      showSnackbar('Select start and end time for each period', 'error');
      return;
    }

    for (let i = 0; i < normalizedPeriods.length; i += 1) {
      const current = normalizedPeriods[i];
      if (current.start_time >= current.end_time) {
        showSnackbar(`Period ${i + 1}: end time must be later than start time`, 'error');
        return;
      }

      if (i > 0) {
        const previous = normalizedPeriods[i - 1];
        if (current.start_time < previous.end_time) {
          showSnackbar(`Period ${i + 1} overlaps with previous period`, 'error');
          return;
        }
      }
    }

    const firstStart = normalizedPeriods[0].start_time;
    const lastEnd = normalizedPeriods[normalizedPeriods.length - 1].end_time;
    if (!firstStart || !lastEnd) {
      showSnackbar('Invalid period timing values', 'error');
      return;
    }

    setSavingTiming(true);
    try {
      const saveRes = await api.post('/college-timings/', {
        college: collegeId,
        start_time: firstStart,
        end_time: lastEnd,
      });

      const savedTiming = saveRes.data;
      const activeId = savedTiming.id || timingId;
      setTimingId(activeId);

      if (!activeId) {
        throw new Error('Invalid timing configuration response');
      }

      const applyRes = await api.post(`/college-timings/${activeId}/apply/`, {
        working_days: workingDays,
        periods: normalizedPeriods.map((period) => ({
          start_time: period.start_time,
          end_time: period.end_time,
        })),
      });

      const savedRows = (applyRes.data.split_table || []).map((row, index) => ({
        id: `saved-${index + 1}`,
        start_time: row.start_time ? dayjs(`2000-01-01T${row.start_time}`) : null,
        end_time: row.end_time ? dayjs(`2000-01-01T${row.end_time}`) : null,
      }));
      setPeriodRows(savedRows.length ? savedRows : [{ id: 'row-1', start_time: null, end_time: null }]);

      showSnackbar('College timing saved and slots generated successfully', 'success');
      fetchData();
    } catch (error) {
      const message = error.response?.data?.end_time?.[0]
        || error.response?.data?.error
        || 'Failed to save college timing';
      showSnackbar(message, 'error');
    } finally {
      setSavingTiming(false);
    }
  };

  const handleOpenSubjectTypeDialog = (type = null) => {
    if (type) {
      setSubjectTypeForm({
        id: type.id,
        name: type.name || '',
        code: type.code || '',
        description: type.description || '',
        is_active: type.is_active !== false,
      });
    } else {
      setSubjectTypeForm({
        id: null,
        name: '',
        code: '',
        description: '',
        is_active: true,
      });
    }
    setOpenSubjectTypeDialog(true);
  };

  const handleSaveSubjectType = async () => {
    if (!subjectTypeForm.name.trim() || !subjectTypeForm.code.trim()) {
      showSnackbar('Name and Code are required', 'error');
      return;
    }

    try {
      const payload = {
        name: subjectTypeForm.name,
        code: subjectTypeForm.code.toUpperCase(),
        description: subjectTypeForm.description,
        is_active: subjectTypeForm.is_active,
      };

      if (subjectTypeForm.id) {
        await api.patch(`/subject-types/${subjectTypeForm.id}/`, payload);
        showSnackbar('Subject Type updated successfully', 'success');
      } else {
        await api.post('/subject-types/', payload);
        showSnackbar('Subject Type created successfully', 'success');
      }

      setOpenSubjectTypeDialog(false);
      fetchData();
    } catch (error) {
      const message = error.response?.data?.name?.[0]
        || error.response?.data?.code?.[0]
        || error.response?.data?.detail
        || 'Failed to save subject type';
      showSnackbar(message, 'error');
    }
  };

  const handleDeleteSubjectType = async (type) => {
    if (!window.confirm(`Delete subject type ${type.name}?`)) {
      return;
    }

    try {
      await api.delete(`/subject-types/${type.id}/`);
      showSnackbar('Subject Type deleted successfully', 'success');
      fetchData();
    } catch (error) {
      showSnackbar('Failed to delete subject type', 'error');
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>
      <Typography color="textSecondary" sx={{ mb: 3 }}>
        Configure college settings, departments, and subject types.
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

              <Typography color="textSecondary">Periods Per Day</Typography>
              <Typography variant="h5">{periodRows.length || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary">Working Days Per Week</Typography>
              <Typography variant="h5">{workingDays || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary">Total Subject Types</Typography>
              <Typography variant="h5">{subjectTypes.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            College Timings
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            Add each period manually and pick times from the clock selector.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Working Days Per Week"
                type="number"
                fullWidth
                value={workingDays}
                onChange={(e) => setWorkingDays(Math.max(1, Math.min(7, Number(e.target.value))))}
                inputProps={{ min: 1, max: 7 }}
                helperText="1-7 days. Timetable will loop across these days."
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="outlined" startIcon={<Add />} onClick={handleAddPeriodRow}>
              Add Period
            </Button>
            <Button variant="contained" onClick={handleSaveCollegeTiming} disabled={savingTiming}>
              {savingTiming ? 'Saving...' : 'Save Timings'}
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {periodRows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <TimePicker
                          value={row.start_time}
                          onChange={(value) => handlePeriodTimeChange(row.id, 'start_time', value)}
                          ampm
                          minutesStep={5}
                          slotProps={{ textField: { size: 'small', fullWidth: true } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TimePicker
                          value={row.end_time}
                          onChange={(value) => handlePeriodTimeChange(row.id, 'end_time', value)}
                          ampm
                          minutesStep={5}
                          slotProps={{ textField: { size: 'small', fullWidth: true } }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemovePeriodRow(row.id)}
                          disabled={periodRows.length === 1}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </LocalizationProvider>
          </TableContainer>
        </CardContent>
      </Card>

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
        Subject Types
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenSubjectTypeDialog()}>
          Add Subject Type
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subjectTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">No subject types found</TableCell>
              </TableRow>
            ) : (
              subjectTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>{type.code}</TableCell>
                  <TableCell>{type.name}</TableCell>
                  <TableCell>{type.description || '-'}</TableCell>
                  <TableCell>{type.is_active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenSubjectTypeDialog(type)}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteSubjectType(type)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openSubjectTypeDialog} onClose={() => setOpenSubjectTypeDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{subjectTypeForm.id ? 'Edit Subject Type' : 'Add Subject Type'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="Name"
                fullWidth
                value={subjectTypeForm.name}
                onChange={(e) => setSubjectTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Theory"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                label="Code"
                fullWidth
                value={subjectTypeForm.code}
                onChange={(e) => setSubjectTypeForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g., THY"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="dense"
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={subjectTypeForm.description}
                onChange={(e) => setSubjectTypeForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth margin="dense">
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={subjectTypeForm.is_active}
                  onChange={(e) => setSubjectTypeForm((prev) => ({ ...prev, is_active: e.target.value }))}
                >
                  <MenuItem value={true}>Active</MenuItem>
                  <MenuItem value={false}>Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSubjectTypeDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSubjectType}>Save</Button>
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
