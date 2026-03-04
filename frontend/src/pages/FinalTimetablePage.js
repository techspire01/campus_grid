import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Alert, Snackbar, FormControl, InputLabel,
  Select, MenuItem, Chip, Card, CardContent, Button, Tabs, Tab, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { Print, Download, Person, School, MeetingRoom } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function FinalTimetablePage() {
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [entries, setEntries] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (user?.college?.id) {
      fetchDepartments();
      fetchStaff();
      fetchTimeslots();
      fetchEntries();
    }
  }, [user?.college?.id]);

  useEffect(() => {
    fetchEntries();
  }, [selectedDepartment, selectedStaff, selectedClass, tabValue]);

  const fetchDepartments = async () => {
    if (!user?.college?.id) return;
    try {
      const res = await api.get(`/departments/?college=${user.college.id}`);
      setDepartments(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchStaff = async () => {
    if (!user?.college?.id) return;
    try {
      const res = await api.get(`/staff/?college=${user.college.id}`);
      setStaffList(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchTimeslots = async () => {
    if (!user?.college?.id) return;
    try {
      const res = await api.get(`/timeslots/?college=${user.college.id}`);
      setTimeslots(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching timeslots:', error);
    }
  };

  const fetchEntries = async () => {
    if (!user?.college?.id) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('college', user.college.id);
      if (selectedDepartment) params.append('department', selectedDepartment);
      if (selectedStaff) params.append('staff', selectedStaff);
      if (selectedClass) params.append('class_name', selectedClass);
      
      // Get all entries (both common and department)
      const res = await api.get(`/timetable-entries/?${params.toString()}`);
      let allEntries = res.data.results || res.data;
      
      // Filter based on tab
      if (tabValue === 1) {
        // Student view - filter by class
        if (selectedClass) {
          allEntries = allEntries.filter(e => e.class_name === selectedClass);
        }
      } else if (tabValue === 2) {
        // Staff view - filter by staff
        if (selectedStaff) {
          allEntries = allEntries.filter(e => e.staff === parseInt(selectedStaff));
        }
      }
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEntriesForSlot = (day, period) => {
    const timeslot = timeslots.find(t => t.day_order === day && t.period_number === period);
    if (!timeslot) return [];
    return entries.filter(e => e.timeslot === timeslot.id);
  };

  const getClasses = () => {
    const classes = new Set();
    entries.forEach(e => classes.add(e.class_name));
    return Array.from(classes).sort();
  };

  const getStaffNames = () => {
    const staff = new Map();
    entries.forEach(e => {
      if (e.staff) {
        staff.set(e.staff, e.staff_name);
      }
    });
    return Array.from(staff.entries()).map(([id, name]) => ({ id, name }));
  };

  const uniqueClasses = getClasses();
  const uniqueStaff = getStaffNames();

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handlePrint = () => {
    window.print();
  };

  const renderTimetable = () => {
    const maxDays = Math.max(...timeslots.map(t => t.day_order), 0);
    const maxPeriods = Math.max(...timeslots.map(t => t.period_number), 0);
    
    return (
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 900 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 100, backgroundColor: '#f5f5f5' }}>Period</TableCell>
              {days.slice(0, maxDays).map(day => (
                <TableCell key={day} sx={{ fontWeight: 'bold', minWidth: 150, backgroundColor: '#f5f5f5', textAlign: 'center' }}>
                  {days[day - 1]}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {[...Array(maxPeriods)].map((_, periodIdx) => {
              const period = periodIdx + 1;
              return (
                <TableRow key={period}>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                    Period {period}
                  </TableCell>
                  {days.slice(0, maxDays).map(day => {
                    const slotEntries = getEntriesForSlot(day, period);
                    return (
                      <TableCell key={`${day}-${period}`} sx={{ verticalAlign: 'top', minHeight: 60 }}>
                        {slotEntries.length === 0 ? (
                          <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}>
                            -
                          </Typography>
                        ) : (
                          slotEntries.map(entry => (
                            <Box 
                              key={entry.id} 
                              sx={{ 
                                mb: 0.5, 
                                p: 0.5, 
                                borderRadius: 1,
                                backgroundColor: entry.is_common ? '#e3f2fd' : '#fce4ec',
                                border: `1px solid ${entry.is_common ? '#1976d2' : '#dc004e'}`
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', fontSize: '0.7rem' }}>
                                {entry.subject_name || entry.subject}
                              </Typography>
                              <Typography variant="caption" display="block" color="textSecondary" sx={{ fontSize: '0.65rem' }}>
                                {entry.class_name}
                              </Typography>
                              {entry.staff_name && (
                                <Typography variant="caption" display="block" color="info.main" sx={{ fontSize: '0.65rem' }}>
                                  {entry.staff_name}
                                </Typography>
                              )}
                              {entry.lab_name && (
                                <Typography variant="caption" display="block" color="warning.main" sx={{ fontSize: '0.65rem' }}>
                                  📍 {entry.lab_name}
                                </Typography>
                              )}
                            </Box>
                          ))
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4">
            Final Timetable
          </Typography>
          <Typography color="textSecondary">
            View merged (common + department) timetable
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Print />}
          onClick={handlePrint}
        >
          Print / Export
        </Button>
      </Box>

      {/* View Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<School />} label="By Class" iconPosition="start" />
          <Tab icon={<Person />} label="By Staff" iconPosition="start" />
          <Tab icon={<MeetingRoom />} label="All Entries" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          {tabValue === 0 && (
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Class</InputLabel>
                <Select
                  value={selectedClass}
                  label="Class"
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <MenuItem value="">All Classes</MenuItem>
                  {uniqueClasses.map(cls => (
                    <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          
          {tabValue === 1 && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Staff</InputLabel>
                <Select
                  value={selectedStaff}
                  label="Staff"
                  onChange={(e) => setSelectedStaff(e.target.value)}
                >
                  <MenuItem value="">All Staff</MenuItem>
                  {uniqueStaff.map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                  {staffList.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.user?.first_name} {s.user?.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={selectedDepartment}
                label="Department"
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <MenuItem value="">All Departments</MenuItem>
                {departments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Summary */}
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1 }}>
                <Typography variant="caption" color="textSecondary">Total Entries</Typography>
                <Typography variant="h5">{entries.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1 }}>
                <Typography variant="caption" color="textSecondary">Common Slots</Typography>
                <Typography variant="h5">{entries.filter(e => e.is_common).length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1 }}>
                <Typography variant="caption" color="textSecondary">Department Slots</Typography>
                <Typography variant="h5">{entries.filter(e => !e.is_common).length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1 }}>
                <Typography variant="caption" color="textSecondary">Classes</Typography>
                <Typography variant="h5">{uniqueClasses.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Timetable Display */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <Typography>Loading...</Typography>
        </Box>
      ) : entries.length > 0 ? (
        renderTimetable()
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            No timetable entries found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Generate common and department timetables first
          </Typography>
        </Paper>
      )}

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Legend:</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 1 }} />
            <Typography variant="caption">Common Subject</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#fce4ec', border: '1px solid #dc004e', borderRadius: 1 }} />
            <Typography variant="caption">Department Subject</Typography>
          </Box>
        </Box>
      </Paper>

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

export default FinalTimetablePage;

