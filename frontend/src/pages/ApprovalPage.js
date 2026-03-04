import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Grid, Alert, Snackbar, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Chip, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, CircularProgress, Divider
} from '@mui/material';
import { Check, Close, History, Visibility } from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store';

function ApprovalPage() {
  const { user } = useAuthStore();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [actionType, setActionType] = useState('');
  const [comment, setComment] = useState('');
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchApprovals();
  }, [tabValue]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      let url = '/approvals/';
      if (tabValue === 0) {
        url = '/approvals/pending/';
      }
      const res = await api.get(url);
      setApprovals(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      showSnackbar('Error loading approvals', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAction = (approval, type) => {
    setSelectedApproval(approval);
    setActionType(type);
    setComment('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedApproval(null);
    setComment('');
  };

  const handleSubmitAction = async () => {
    if (actionType === 'reject' && !comment.trim()) {
      showSnackbar('Comment is required for rejection', 'warning');
      return;
    }

    try {
      const endpoint = actionType === 'approve' ? 'approve' : 'reject';
      await api.patch(`/approvals/${selectedApproval.id}/${endpoint}/`, { comment });
      showSnackbar(
        actionType === 'approve' ? 'Approval granted successfully' : 'Approval rejected',
        actionType === 'approve' ? 'success' : 'info'
      );
      handleCloseDialog();
      fetchApprovals();
    } catch (error) {
      console.error('Error processing approval:', error);
      showSnackbar(error.response?.data?.error || 'Error processing approval', 'error');
    }
  };

  const handleViewLogs = async (approval) => {
    setSelectedApproval(approval);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/approvals/${approval.id}/logs/`);
      setLogs(res.data.results || res.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
      showSnackbar('Error loading approval history', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      default: return 'default';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'LAB_INCHARGE': return 'Lab Incharge';
      case 'COMMON_SUBJECT_HEAD': return 'Common Subject Head';
      default: return role;
    }
  };

  const canApprove = () => {
    if (!user) return false;
    return user.role === 'LAB_INCHARGE' || user.role === 'COMMON_SUBJECT_HEAD' || 
           user.role === 'COLLEGE_ADMIN' || user.role === 'SUPER_ADMIN';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Approval Dashboard
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Review and approve/reject common timetable schedules
      </Typography>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Pending Approvals" />
          <Tab label="All Approvals" />
        </Tabs>
      </Paper>

      {/* Approvals List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : approvals.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            No approvals found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {tabValue === 0 ? 'No pending approvals at the moment' : 'No approvals available'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {approvals.map(approval => (
            <Grid item xs={12} md={6} key={approval.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6">
                        {approval.common_timetable_college || 'Common Timetable'}
                      </Typography>
                      <Chip 
                        label={getRoleLabel(approval.approver_role)} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    <Chip 
                      label={approval.status} 
                      color={getStatusColor(approval.status)} 
                    />
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">Created</Typography>
                      <Typography variant="body2">
                        {new Date(approval.created_at).toLocaleDateString()}
                      </Typography>
                    </Grid>
                    {approval.approved_by && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">Processed By</Typography>
                        <Typography variant="body2">
                          {approval.approved_by_name || approval.approved_by}
                        </Typography>
                      </Grid>
                    )}
                    {approval.comment && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="textSecondary">Comment</Typography>
                        <Typography variant="body2">{approval.comment}</Typography>
                      </Grid>
                    )}
                  </Grid>

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    {approval.status === 'PENDING' && canApprove() && (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<Check />}
                          onClick={() => handleOpenAction(approval, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          startIcon={<Close />}
                          onClick={() => handleOpenAction(approval, 'reject')}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<History />}
                      onClick={() => handleViewLogs(approval)}
                    >
                      History
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Action Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionType === 'approve' ? 'Approve' : 'Reject'} Common Timetable
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {actionType === 'approve' 
              ? 'Are you sure you want to approve this common timetable?' 
              : 'Please provide a reason for rejection:'}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={actionType === 'approve' ? 'Optional comment...' : 'Reason for rejection...'}
            required={actionType === 'reject'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmitAction} 
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
          >
            {actionType === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog 
        open={Boolean(selectedApproval && logs.length > 0)} 
        onClose={() => setSelectedApproval(null)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Approval History</DialogTitle>
        <DialogContent>
          {loadingLogs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress />
            </Box>
          ) : logs.length === 0 ? (
            <Typography color="textSecondary">No history available</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Action</TableCell>
                    <TableCell>By</TableCell>
                    <TableCell>Comment</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Chip 
                          label={log.action} 
                          size="small"
                          color={log.action === 'APPROVED' ? 'success' : log.action === 'REJECTED' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{log.changed_by_name || log.changed_by}</TableCell>
                      <TableCell>{log.comment || '-'}</TableCell>
                      <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedApproval(null)}>Close</Button>
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

export default ApprovalPage;

