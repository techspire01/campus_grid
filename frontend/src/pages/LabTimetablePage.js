import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Grid, Alert, Snackbar,
  CircularProgress, Divider, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Card, CardContent,
  FormControl, InputLabel, Select, MenuItem, LinearProgress
} from '@mui/material';
import { PlayArrow, Lock, Refresh, Schedule, Science, Class } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function LabTimetablePage() {
  const { user } = useAuthStore();
  const [labs, setLabs] = useState([]);
  const [labTimetables, setLabTimetables] = useState([]);
  const [entries, setEntries] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedLabFilter, setSelectedLabFilter] = useState('');
  const [generationResult, setGenerationResult] = useState(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (user?.college?.id) {
      fetchLabs();
      fetchTimeslots();
      fetchLabTimetables();
    }
  }, [user?.college?.id]);

  const fetchLabs = async () => {
    try {
      const res = await api.get(`/labs/?college=${user.college.id}`);
      setLabs(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching labs:', error);
      showSnackbar('Error loading labs', 'error');
    }
  };

  const fetchTimeslots = async () => {
    try {
      const res = await api.get(`/timeslots/?college=${user.college.id}`);
      setTimeslots(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching timeslots:', error);
    }
  };

  const fetchLabTimetables = async () => {
    try {
      const res = await api.get(`/lab-timetable/?college=${user.college.id}`);
      setLabTimetables(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching lab timetables:', error);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      let url = '/lab-timetable/entries/';
      if (selectedLabFilter) {
        url += `?lab_id=${selectedLabFilter}`;
      }
      const res = await api.get(url);
      setEntries(res.data.entries || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLabFilter || labTimetables.length > 0) {
      fetchEntries();
    }
  }, [selectedLabFilter, labTimetables]);

  const handleGenerateAll = async () => {
    setGenerating(true);
    setGenerationResult(null);
    try {
      const res = await api.post('/lab-timetable/generate_all/', {
        college_id: user.college.id
      });
      setGenerationResult(res.data);
      showSnackbar(res.data.message || 'All lab timetables generated successfully', 'success');
      fetchLabTimetables();
      fetchEntries();
    } catch (error) {
      console.error('Error generating timetables:', error);
      showSnackbar(error.response?.data?.error || 'Error generating lab timetables', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalizeAll = async () => {
    setFinalizing(true);
    try {
      const res = await api.post('/lab-timetable/finalize_all/', {
        college_id: user.college.id
      });
      showSnackbar(res.data.message || 'All lab timetables finalized successfully', 'success');
      fetchLabTimetables();
    } catch (error) {
      console.error('Error finalizing timetables:', error);
      showSnackbar(error.response?.data?.error || 'Error finalizing lab timetables', 'error');
    } finally {
      setFinalizing(false);
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
      case 'GENERATED': return 'warning';
      case 'FINALIZED': return 'success';
      default: return 'default';
    }
  };

  const getOverallStatus = () => {
    if (labTimetables.length === 0) return 'NOT_GENERATED';
    const allFinalized = labTimetables.every(lt => lt.status === 'FINALIZED');
    const anyGenerated = labTimetables.some(lt => lt.status === 'GENERATED');
    if (allFinalized) return 'FINALIZED';
    if (anyGenerated) return 'GENERATED';
    return 'DRAFT';
  };

  const filteredEntries = selectedLabFilter 
    ? entries.filter(e => e.lab === parseInt(selectedLabFilter))
    : entries;

  const maxDayOrder = Math.max(...timeslots.map(t => t.day_order), 0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Lab Timetable Management
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Generate and manage lab timetables for all labs at once
      </Typography>

      {generating && <LinearProgress sx={{ mb: 2 }} />}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
              onClick={handleGenerateAll}
              disabled={generating}
              fullWidth
              sx={{ py: 1.5 }}
            >
              {generating ? 'Generating All Lab Timetables...' : 'Generate All Lab Timetables'}
            </Button>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Automatically allocates lab hours for all classes based on workload, capacity, and availability
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Filter by Lab</InputLabel>
              <Select
                value={selectedLabFilter}
                label="Filter by Lab"
                onChange={(e) => setSelectedLabFilter(e.target.value)}
              >
                <MenuItem value="">All Labs</MenuItem>
                {labs.map(lab => (
                  <MenuItem key={lab.id} value={lab.id}>
                    {lab.name} ({lab.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

        {generationResult && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Generation Complete:</Typography>
            <Typography variant="body2">
              • {generationResult.entries_count} entries created for {generationResult.labs?.length || 0} labs
            </Typography>
            <Typography variant="body2">
              • {generationResult.available_slots_remaining} slots remaining
            </Typography>
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Science color="primary" />
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Total Labs</Typography>
                    <Typography variant="h5">{labs.length}</Typography>
                  </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Class color="primary" />
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Total Entries</Typography>
                    <Typography variant="h5">{entries.length}</Typography>
                  </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Schedule color="primary" />
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Available Slots</Typography>
                    <Typography variant="h5">
                      {timeslots.filter(t => !t.is_common_locked && !t.is_lab_locked).length}
                    </Typography>
                  </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="textSecondary">Overall Status</Typography>
                <Chip 
                  label={getOverallStatus()} 
                  color={getStatusColor(getOverallStatus())}
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

        {labTimetables.length > 0 && (
          <Box>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>
              Lab Timetable Status
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {labTimetables.map(lt => (
                <Grid item xs={12} sm={6} md={4} key={lt.id}>
                  <Card variant="outlined" sx={{ 
                    borderColor: lt.status === 'FINALIZED' ? 'success.main' : 
                                 lt.status === 'GENERATED' ? 'warning.main' : 'grey.300'
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {lt.lab_name || lt.lab}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {lt.lab_code || ''}
                          </Typography>
                        </Box>
                        <Chip 
                          label={lt.status} 
                          size="small"
                          color={getStatusColor(lt.status)}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {getOverallStatus() === 'GENERATED' && (
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => fetchEntries()}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<Lock />}
              onClick={handleFinalizeAll}
              disabled={finalizing}
            >
              {finalizing ? 'Finalizing...' : 'Finalize All Lab Timetables'}
            </Button>
          </Box>
        )}

        {getOverallStatus() === 'FINALIZED' && (
          <Alert severity="success" sx={{ mt: 2 }}>
            All lab timetables have been finalized. The timetable is now locked and visible in all class timetables.
          </Alert>
        )}
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredEntries.length > 0 ? (
        <Paper sx={{ p: 2, overflowX: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            Lab Timetable {selectedLabFilter ? `- ${labs.find(l => l.id === parseInt(selectedLabFilter))?.name || ''}` : ' (All Labs)'}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Period</TableCell>
                  {days.slice(0, maxDayOrder).map((day, idx) => (
                    <TableCell key={idx} sx={{ fontWeight: 'bold', minWidth: 150 }}>
                      {day}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[...new Set(timeslots.map(t => t.period_number))].sort((a, b) => a - b).map(period => (
                  <TableRow key={period}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Period {period}</TableCell>
                    {days.slice(0, maxDayOrder).map((day, dayIdx) => {
                      const slotEntries = getEntriesForSlot(dayIdx + 1, period);
                      const timeslot = timeslots.find(t => t.day_order === dayIdx + 1 && t.period_number === period);
                      const isLocked = timeslot?.is_common_locked || timeslot?.is_lab_locked;
                      
                      return (
                        <TableCell 
                          key={`${dayIdx}-${period}`}
                          sx={{ 
                            backgroundColor: isLocked ? '#f5f5f5' : 'white',
                            opacity: isLocked ? 0.6 : 1,
                            minHeight: 60
                          }}
                        >
                          {isLocked && (
                            <Chip label="LOCKED" size="small" color="default" sx={{ mb: 0.5 }} />
                          )}
                          {slotEntries.map(entry => (
                            <Box 
                              key={entry.id} 
                              sx={{ 
                                mb: 0.5, 
                                p: 1, 
                                borderRadius: 1,
                                backgroundColor: '#fff3e0',
                                border: '1px solid #ff9800'
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                                {entry.subject_name}
                              </Typography>
                              <Typography variant="caption" display="block" color="textSecondary">
                                {entry.class_name}
                              </Typography>
                              {entry.lab_name && (
                                <Typography variant="caption" display="block" color="info.main">
                                  {entry.lab_name}
                                </Typography>
                              )}
                              {entry.staff_name && (
                                <Typography variant="caption" display="block" color="success.main">
                                  {entry.staff_name}
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
            No lab timetables generated yet
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Click "Generate All Lab Timetables" to automatically create lab schedules for all classes and labs
          </Typography>
        </Paper>
      )}

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

export default LabTimetablePage;
