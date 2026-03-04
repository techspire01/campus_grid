import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Grid, Alert, Snackbar, Switch,
  FormControlLabel, CircularProgress, Divider, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card, CardContent,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { PlayArrow, Publish, Preview, Refresh, LockOpen } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function DepartmentTimetablePage() {
  const { user } = useAuthStore();
  const isHOD = user?.role === 'HOD';
  const userDepartmentId = user?.department?.id || user?.department || null;
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departmentTimetable, setDepartmentTimetable] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [timeslots, setTimeslots] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchDepartmentTimetable();
      fetchTimeslots();
    }
  }, [selectedDepartment]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments/');
      const deptsData = res.data.results || res.data;
      setDepartments(deptsData);
      
      if (deptsData.length > 0) {
        if (isHOD && userDepartmentId) {
          setSelectedDepartment(userDepartmentId);
        } else if (deptsData.length > 0) {
          setSelectedDepartment(deptsData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      showSnackbar('Error loading departments', 'error');
    }
  };

  const fetchDepartmentTimetable = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/department-timetable/?department=${selectedDepartment}`);
      const data = res.data.results || res.data;
      if (data.length > 0) {
        setDepartmentTimetable(data[0]);
        fetchEntries();
      } else {
        setDepartmentTimetable(null);
        setEntries([]);
      }
    } catch (error) {
      console.error('Error fetching department timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    try {
      const res = await api.get(`/timetable-entries/?department=${selectedDepartment}&is_common=false`);
      setEntries(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching entries:', error);
    }
  };

  const fetchTimeslots = async () => {
    try {
      const collegeId = departments.find(d => d.id === selectedDepartment)?.college;
      if (collegeId) {
        const res = await api.get(`/timeslots/?college=${collegeId}`);
        setTimeslots(res.data.results || res.data);
      }
    } catch (error) {
      console.error('Error fetching timeslots:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDepartment) {
      showSnackbar('Please select a department', 'warning');
      return;
    }

    // Check if user is HOD of this department
    if (isHOD && userDepartmentId !== parseInt(selectedDepartment)) {
      showSnackbar('You can only generate timetable for your department', 'error');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post('/department-timetable/generate/', {
        department_id: selectedDepartment
      });
      showSnackbar(res.data.message || 'Timetable generated successfully', 'success');
      fetchDepartmentTimetable();
    } catch (error) {
      console.error('Error generating timetable:', error);
      showSnackbar(error.response?.data?.error || 'Error generating timetable', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!departmentTimetable) return;

    try {
      const res = await api.post('/department-timetable/publish/', {
        department_id: selectedDepartment
      });
      showSnackbar(res.data.message || 'Timetable published successfully', 'success');
      fetchDepartmentTimetable();
    } catch (error) {
      console.error('Error publishing:', error);
      showSnackbar(error.response?.data?.error || 'Error publishing timetable', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const getEntriesForSlot = (day, period) => {
    const timeslot = timeslots.find(t => t.day_order === day && t.period_number === period);
    if (!timeslot) return [];
    return entries.filter(e => e.timeslot === timeslot.id);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT': return 'default';
      case 'PENDING_APPROVAL': return 'warning';
      case 'PUBLISHED': return 'success';
      default: return 'default';
    }
  };

  const canGenerate = () => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'COLLEGE_ADMIN') return true;
    if (isHOD && userDepartmentId === parseInt(selectedDepartment)) return true;
    return false;
  };

  const getCommonSlotCount = () => {
    return timeslots.filter(t => t.is_common_locked).length;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Department Timetable Management
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Generate and manage department-specific timetable
      </Typography>

      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1">Select Department:</Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={selectedDepartment}
                label="Department"
                onChange={(e) => setSelectedDepartment(e.target.value)}
                disabled={isHOD}
              >
                {departments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
              onClick={handleGenerate}
              disabled={generating || !selectedDepartment || !canGenerate()}
              fullWidth
            >
              {generating ? 'Generating...' : 'Generate Timetable'}
            </Button>
          </Grid>
        </Grid>

        {/* Info Cards */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Common Slots</Typography>
                <Typography variant="h5">
                  {getCommonSlotCount()} / {timeslots.length}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Locked by common timetable
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Available Slots</Typography>
                <Typography variant="h5">
                  {timeslots.length - getCommonSlotCount()}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  For department timetable
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                {departmentTimetable ? (
                  <Chip 
                    label={departmentTimetable.status} 
                    color={getStatusColor(departmentTimetable.status)}
                    sx={{ mt: 1 }}
                  />
                ) : (
                  <Typography variant="body2" sx={{ mt: 1 }}>Not Generated</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {departmentTimetable && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={fetchDepartmentTimetable}
              >
                Refresh
              </Button>
              {departmentTimetable.status === 'DRAFT' && canGenerate() && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Publish />}
                  onClick={handlePublish}
                >
                  Publish Timetable
                </Button>
              )}
            </Box>
          </>
        )}
      </Paper>

      {/* Timetable Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : entries.length > 0 ? (
        <Paper sx={{ p: 2, overflowX: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            Department Timetable Preview
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Period</TableCell>
                  {days.slice(0, Math.max(...timeslots.map(t => t.day_order), 0)).map(day => (
                    <TableCell key={day} sx={{ fontWeight: 'bold', minWidth: 150 }}>
                      {days[day - 1]}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[...new Set(timeslots.map(t => t.period_number))].sort((a, b) => a - b).map(period => (
                  <TableRow key={period}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Period {period}</TableCell>
                    {days.slice(0, Math.max(...timeslots.map(t => t.day_order), 0)).map(day => {
                      const slotEntries = getEntriesForSlot(day, period);
                      const isLocked = timeslots.find(t => t.day_order === day && t.period_number === period)?.is_common_locked;
                      return (
                        <TableCell 
                          key={`${day}-${period}`}
                          sx={{ 
                            backgroundColor: isLocked ? '#f5f5f5' : 'white',
                            opacity: isLocked ? 0.6 : 1
                          }}
                        >
                          {isLocked && (
                            <Chip label="LOCKED" size="small" color="default" sx={{ mb: 0.5 }} />
                          )}
                          {slotEntries.map(entry => (
                            <Box key={entry.id} sx={{ mb: 0.5 }}>
                              <Chip
                                label={entry.subject_name || entry.subject}
                                size="small"
                                color={entry.subject_is_lab ? 'warning' : 'primary'}
                                variant={entry.lab ? 'outlined' : 'filled'}
                                sx={{ fontSize: '0.75rem' }}
                              />
                              <Typography variant="caption" display="block" color="textSecondary">
                                {entry.class_name}
                              </Typography>
                              {entry.staff_name && (
                                <Typography variant="caption" display="block" color="info.main">
                                  {entry.staff_name}
                                </Typography>
                              )}
                              {entry.lab_name && (
                                <Typography variant="caption" display="block" color="warning.main">
                                  📍 {entry.lab_name}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            No department timetable generated yet
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Select a department and click Generate to create the department timetable
          </Typography>
        </Paper>
      )}

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

export default DepartmentTimetablePage;

