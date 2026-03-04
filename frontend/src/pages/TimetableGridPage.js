import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Alert, Snackbar, FormControl, InputLabel,
  Select, MenuItem, Chip, Card, CardContent, Button, Divider, Table
} from '@mui/material';
import { Refresh, SwapHoriz, DragIndicator } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function TimetableGridPage() {
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [entries, setEntries] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [moveMode, setMoveMode] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (user?.college?.id) {
      fetchDepartments();
      fetchTimeslots();
      fetchEntries();
    }
  }, [user?.college?.id]);

  useEffect(() => {
    if (selectedDepartment || selectedClass) {
      fetchEntries();
    }
  }, [selectedDepartment, selectedClass]);

  const fetchDepartments = async () => {
    if (!user?.college?.id) return;
    try {
      const res = await api.get(`/departments/?college=${user.college.id}`);
      setDepartments(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
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
      if (selectedClass) params.append('class_name', selectedClass);
      
      const res = await api.get(`/timetable-entries/?${params.toString()}`);
      setEntries(res.data.results || res.data);
      
      // Check for conflicts
      checkConflicts(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConflicts = (entryData) => {
    const newConflicts = [];
    const seen = new Map();

    entryData.forEach(entry => {
      const key = `${entry.timeslot}_${entry.class_name}`;
      if (seen.has(key)) {
        newConflicts.push({
          type: 'CLASS_CLASH',
          timeslot: entry.timeslot,
          className: entry.class_name,
          entries: [seen.get(key), entry.id]
        });
      } else {
        seen.set(key, entry.id);
      }

      if (entry.staff) {
        const staffKey = `${entry.timeslot}_staff_${entry.staff}`;
        if (seen.has(staffKey)) {
          newConflicts.push({
            type: 'STAFF_CLASH',
            timeslot: entry.timeslot,
            staff: entry.staff,
            entries: [seen.get(staffKey), entry.id]
          });
        } else {
          seen.set(staffKey, entry.id);
        }
      }

      if (entry.lab) {
        const labKey = `${entry.timeslot}_lab_${entry.lab}`;
        if (seen.has(labKey)) {
          newConflicts.push({
            type: 'LAB_CLASH',
            timeslot: entry.timeslot,
            lab: entry.lab,
            entries: [seen.get(labKey), entry.id]
          });
        } else {
          seen.set(labKey, entry.id);
        }
      }
    });

    setConflicts(newConflicts);
  };

  const handleMoveEntry = async (entryId, newTimeslotId) => {
    try {
      const res = await api.patch(`/timetable-entries/${entryId}/move/`, {
        timeslot_id: newTimeslotId
      });
      
      if (res.data.valid) {
        showSnackbar('Entry moved successfully', 'success');
        fetchEntries();
      } else {
        showSnackbar(res.data.errors?.join(', ') || 'Move failed', 'error');
      }
    } catch (error) {
      console.error('Error moving entry:', error);
      showSnackbar(error.response?.data?.error || 'Error moving entry', 'error');
    }
    setSelectedEntry(null);
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const getEntriesForSlot = (day, period) => {
    const timeslot = timeslots.find(t => t.day_order === day && t.period_number === period);
    if (!timeslot) return [];
    return entries.filter(e => e.timeslot === timeslot.id);
  };

  const isLocked = (day, period) => {
    const timeslot = timeslots.find(t => t.day_order === day && t.period_number === period);
    return timeslot?.is_common_locked || false;
  };

  const hasConflict = (entry) => {
    return conflicts.some(c => c.entries.includes(entry.id));
  };

  const getClasses = () => {
    const classes = new Set();
    entries.forEach(e => classes.add(e.class_name));
    return Array.from(classes);
  };

  const uniqueClasses = getClasses();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Timetable Grid
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        View and manage timetable with drag & drop support
      </Typography>

      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
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
          <Grid item xs={12} md={4}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchEntries}
              fullWidth
            >
              Refresh
            </Button>
          </Grid>
        </Grid>

        {/* Conflict Alert */}
        {conflicts.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {conflicts.length} conflict(s) detected in the timetable!
          </Alert>
        )}
      </Paper>

      {/* Timetable Grid */}
      <Paper sx={{ p: 2, overflowX: 'auto' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th sx={{ fontWeight: 'bold', minWidth: 100, position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>
                  Period
                </th>
                {days.slice(0, Math.max(...timeslots.map(t => t.day_order), 0)).map(day => (
                  <th key={day} sx={{ fontWeight: 'bold', minWidth: 180, textAlign: 'center' }}>
                    {days[day - 1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...new Set(timeslots.map(t => t.period_number))].sort((a, b) => a - b).map(period => (
                <tr key={period}>
                  <td sx={{ fontWeight: 'bold', position: 'sticky', left: 0, backgroundColor: '#f5f5f5' }}>
                    Period {period}
                  </td>
                  {days.slice(0, Math.max(...timeslots.map(t => t.day_order), 0)).map(day => {
                    const slotEntries = getEntriesForSlot(day, period);
                    const locked = isLocked(day, period);
                    return (
                      <td 
                        key={`${day}-${period}`}
                        sx={{ 
                          minWidth: 180,
                          backgroundColor: locked ? '#f5f5f5' : 'white',
                          verticalAlign: 'top',
                          border: hasConflict(slotEntries[0]) ? '2px solid red' : '1px solid #eee'
                        }}
                      >
                        {locked && (
                          <Chip 
                            label="LOCKED" 
                            size="small" 
                            color="default" 
                            sx={{ mb: 0.5, fontSize: '0.65rem' }} 
                          />
                        )}
                        {slotEntries.length === 0 ? (
                          <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                            Free
                          </Typography>
                        ) : (
                          slotEntries.map(entry => (
                            <Card 
                              key={entry.id}
                              variant="outlined"
                              sx={{ 
                                mb: 0.5, 
                                p: 0.5,
                                cursor: 'pointer',
                                borderColor: hasConflict(entry) ? 'red' : entry.is_common ? 'primary.main' : 'secondary.main',
                                backgroundColor: hasConflict(entry) ? '#ffebee' : entry.is_common ? '#e3f2fd' : '#fce4ec',
                                '&:hover': { backgroundColor: '#eee' }
                              }}
                              onClick={() => {
                                if (!locked && !entry.is_common) {
                                  setSelectedEntry(entry);
                                  setMoveMode(true);
                                }
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                                {entry.subject_name || entry.subject}
                              </Typography>
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
                              {entry.is_common && (
                                <Chip label="Common" size="tiny" color="primary" sx={{ mt: 0.5, height: 16 }} />
                              )}
                            </Card>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      </Paper>

      {/* Move Dialog */}
      {moveMode && selectedEntry && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Move Entry: {selectedEntry.subject_name || selectedEntry.subject}
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Current: {selectedEntry.class_name}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>Select new time slot:</Typography>
          <Grid container spacing={2}>
            {timeslots.filter(t => !t.is_common_locked).map(slot => (
              <Grid item xs={6} sm={4} md={3} key={slot.id}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => handleMoveEntry(selectedEntry.id, slot.id)}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Day {slot.day_order} - Period {slot.period_number}
                </Button>
              </Grid>
            ))}
          </Grid>
          <Button 
            sx={{ mt: 2 }} 
            onClick={() => { setMoveMode(false); setSelectedEntry(null); }}
          >
            Cancel
          </Button>
        </Paper>
      )}

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Legend:</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label="Common Subject" color="primary" variant="outlined" />
          <Chip label="Department Subject" color="secondary" variant="outlined" />
          <Chip label="Locked Slot" color="default" variant="outlined" />
          <Chip label="Conflict" color="error" variant="outlined" />
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

export default TimetableGridPage;

