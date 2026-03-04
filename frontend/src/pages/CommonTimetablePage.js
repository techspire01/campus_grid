import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Grid, Alert, Snackbar, Switch,
  FormControlLabel, CircularProgress, Divider, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card, CardContent
} from '@mui/material';
import { PlayArrow, Send, Lock, Preview, Refresh } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function CommonTimetablePage() {
  const { user } = useAuthStore();
  const [commonTimetable, setCommonTimetable] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [enableAddons, setEnableAddons] = useState(false);
  const [timeslots, setTimeslots] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (user?.college?.id) {
      fetchCommonTimetable();
      fetchTimeslots();
    }
  }, [user]);

  const fetchCommonTimetable = async () => {
    if (!user?.college?.id) return;
    
    setLoading(true);
    try {
      const res = await api.get(`/common-timetable/?college=${user.college.id}`);
      const data = res.data.results || res.data;
      if (data.length > 0) {
        setCommonTimetable(data[0]);
        fetchEntries();
      } else {
        setCommonTimetable(null);
        setEntries([]);
      }
    } catch (error) {
      console.error('Error fetching common timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    if (!user?.college?.id) return;
    
    try {
      const res = await api.get(`/timetable-entries/?college=${user.college.id}&is_common=true`);
      setEntries(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching entries:', error);
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

  const handleGenerate = async () => {
    if (!user?.college?.id) {
      showSnackbar('College not configured for your account', 'error');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post('/common-timetable/generate/', {
        college_id: user.college.id,
        enable_addons: enableAddons
      });
      showSnackbar(res.data.message || 'Timetable generated successfully', 'success');
      fetchCommonTimetable();
    } catch (error) {
      console.error('Error generating timetable:', error);
      showSnackbar(error.response?.data?.error || 'Error generating timetable', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!commonTimetable) {
      showSnackbar('Generate timetable first', 'warning');
      return;
    }

    try {
      const res = await api.post('/common-timetable/submit/', {
        college_id: user.college.id
      });
      showSnackbar(res.data.message || 'Submitted for approval', 'success');
      fetchCommonTimetable();
    } catch (error) {
      console.error('Error submitting:', error);
      showSnackbar(error.response?.data?.error || 'Error submitting for approval', 'error');
    }
  };

  const handleLock = async () => {
    if (!commonTimetable) return;

    try {
      const res = await api.post('/common-timetable/lock/', {
        college_id: user.college.id
      });
      showSnackbar(res.data.message || 'Timetable locked successfully', 'success');
      fetchCommonTimetable();
    } catch (error) {
      console.error('Error locking:', error);
      showSnackbar(error.response?.data?.error || 'Error locking timetable', 'error');
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
      case 'APPROVED': return 'info';
      case 'LOCKED': return 'success';
      case 'REJECTED': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Common Timetable Management
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Generate and manage common timetable
      </Typography>

      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={enableAddons}
                  onChange={(e) => setEnableAddons(e.target.checked)}
                />
              }
              label="Include Add-on Courses"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
              onClick={handleGenerate}
              disabled={generating}
              fullWidth
            >
              {generating ? 'Generating...' : 'Generate Timetable'}
            </Button>
          </Grid>
        </Grid>

        {commonTimetable && (
          <>
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                    <Chip 
                      label={commonTimetable.status} 
                      color={getStatusColor(commonTimetable.status)}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={9}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={fetchCommonTimetable}
                  >
                    Refresh
                  </Button>
                  {commonTimetable.status === 'DRAFT' && (
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={<Send />}
                      onClick={handleSubmitForApproval}
                    >
                      Submit for Approval
                    </Button>
                  )}
                  {commonTimetable.status === 'PENDING_APPROVAL' && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<Lock />}
                      onClick={handleLock}
                    >
                      Lock Timetable
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
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
          <Typography variant="h6" gutterBottom>Timetable Preview</Typography>
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
                      return (
                        <TableCell key={`${day}-${period}`}>
                          {slotEntries.map(entry => (
                            <Box key={entry.id} sx={{ mb: 0.5 }}>
                              <Chip
                                label={entry.subject_name || entry.subject}
                                size="small"
                                color={entry.subject_is_lab ? 'warning' : 'default'}
                                sx={{ fontSize: '0.75rem' }}
                              />
                              <Typography variant="caption" display="block" color="textSecondary">
                                {entry.class_name}
                              </Typography>
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
            No common timetable generated yet
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Select a college and click Generate to create the common timetable
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

export default CommonTimetablePage;

