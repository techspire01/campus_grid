import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Chip,
  FormControlLabel,
  Grid,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store';

const SPECIAL_SUBJECT_OPTIONS = [
  { code: 'PT', label: 'PT' },
  { code: 'ADDON', label: 'Addon Course' },
  { code: 'PLACEMENT', label: 'Placement Training' },
  { code: 'EDC', label: 'EDC' },
  { code: 'FC', label: 'FC' },
  { code: 'LIB', label: 'Library' },
];

function ClassDetailPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const collegeId = useMemo(() => user?.college?.id || user?.college || null, [user]);

  const [classData, setClassData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subjectInputValue, setSubjectInputValue] = useState('');
  const [selectedSubjectOption, setSelectedSubjectOption] = useState(null);
  const [selectedSpecialCodes, setSelectedSpecialCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);
  const [savingSpecial, setSavingSpecial] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSubjectName, setDialogSubjectName] = useState('');
  const [dialogSubjectCode, setDialogSubjectCode] = useState('');
  const [dialogSubjectId, setDialogSubjectId] = useState(null);

  useEffect(() => {
    if (classId) {
      fetchClassData();
      fetchSubjects();
    }
  }, [classId, collegeId]);

  const fetchClassData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/classes/${classId}/`);
      const classEntry = response.data;
      setClassData(classEntry);

      const selectedCodes = (classEntry.assigned_subjects || [])
        .map((subject) => String(subject.code || '').toUpperCase())
        .filter((code) => SPECIAL_SUBJECT_OPTIONS.some((option) => option.code === code));
      setSelectedSpecialCodes(selectedCodes);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load class details', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const params = new URLSearchParams();
      if (collegeId) params.append('college', collegeId);

      let nextUrl = `/subjects/?${params.toString()}`;
      const collectedSubjects = [];

      while (nextUrl) {
        const response = await api.get(nextUrl);
        const payload = response.data;

        if (Array.isArray(payload)) {
          setSubjects(payload);
          return;
        }

        collectedSubjects.push(...(payload.results || []));
        nextUrl = payload.next ? payload.next.replace('http://localhost:8000/api', '') : null;
      }

      setSubjects(collectedSubjects);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load subjects', severity: 'error' });
    }
  };

  const assignedSubjectIds = useMemo(
    () => new Set((classData?.assigned_subjects || []).map((subject) => subject.id)),
    [classData]
  );

  const availableSubjects = useMemo(() => {
    if (!classData) return [];

    return subjects.filter((subject) => {
      const isDepartmentMatch = subject.is_common || subject.department === classData.department;
      const isYearMatch = !subject.year || subject.year === classData.year;
      const isNotAssigned = !assignedSubjectIds.has(subject.id);
      return isDepartmentMatch && isYearMatch && isNotAssigned;
    });
  }, [subjects, classData, assignedSubjectIds]);

  const dialogSubjectSuggestions = useMemo(() => {
    if (!classData || (!dialogSubjectName.trim() && !dialogSubjectCode.trim())) {
      return availableSubjects.slice(0, 10);
    }

    const nameLower = dialogSubjectName.toLowerCase();
    const codeLower = dialogSubjectCode.toLowerCase();

    return availableSubjects.filter((subject) => {
      const nameMatch = subject.name?.toLowerCase().includes(nameLower);
      const codeMatch = subject.code?.toLowerCase().includes(codeLower);
      return nameMatch || codeMatch;
    });
  }, [availableSubjects, classData, dialogSubjectName, dialogSubjectCode]);

  const handleAssignSubject = async () => {
    const typedName = dialogSubjectName.trim();
    const typedCode = dialogSubjectCode.trim();
    const selectedId = dialogSubjectId;

    if (!selectedId && !typedName && !typedCode) {
      setSnackbar({ open: true, message: 'Type a subject name or code or pick a suggestion', severity: 'warning' });
      return;
    }

    setAddingSubject(true);
    try {
      await api.post(`/classes/${classId}/add_subject/`, {
        subject_id: selectedId || null,
        name: typedName || null,
        code: typedCode || null,
      });

      setDialogSubjectName('');
      setDialogSubjectCode('');
      setDialogSubjectId(null);
      setDialogOpen(false);
      setSnackbar({ open: true, message: 'Subject added to class', severity: 'success' });
      fetchClassData();
      fetchSubjects();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to add subject';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setAddingSubject(false);
    }
  };

  const handleDialogSubjectSelect = (subject) => {
    setDialogSubjectName(subject.name || '');
    setDialogSubjectCode(subject.code || '');
    setDialogSubjectId(subject.id);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogSubjectName('');
    setDialogSubjectCode('');
    setDialogSubjectId(null);
  };

  const handleDialogNameChange = (event, value) => {
    setDialogSubjectName(value);
    if (value) {
      const matchedSubject = availableSubjects.find(
        (subject) => subject.name?.toLowerCase() === value.toLowerCase()
      );
      if (matchedSubject) {
        setDialogSubjectCode(matchedSubject.code || '');
        setDialogSubjectId(matchedSubject.id);
      }
    }
  };

  const handleDialogCodeChange = (event, value) => {
    setDialogSubjectCode(value);
    if (value) {
      const matchedSubject = availableSubjects.find(
        (subject) => subject.code?.toLowerCase() === value.toLowerCase()
      );
      if (matchedSubject) {
        setDialogSubjectName(matchedSubject.name || '');
        setDialogSubjectId(matchedSubject.id);
      }
    }
  };

  const handleRemoveSubject = async (subjectId) => {
    try {
      await api.delete(`/classes/${classId}/subjects/${subjectId}/`);
      setSnackbar({ open: true, message: 'Subject removed from class', severity: 'success' });
      fetchClassData();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to remove subject';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleSpecialToggle = (code) => {
    setSelectedSpecialCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((existingCode) => existingCode !== code);
      }
      return [...prev, code];
    });
  };

  const handleSaveSpecialSubjects = async () => {
    setSavingSpecial(true);
    try {
      await api.post(`/classes/${classId}/set_special_subjects/`, {
        selected_codes: selectedSpecialCodes,
      });
      setSnackbar({ open: true, message: 'Special subjects saved', severity: 'success' });
      fetchClassData();
      fetchSubjects();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to save special subjects';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setSavingSpecial(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Class Subject Management
        </Typography>
        <Button onClick={() => navigate('/classes')}>Back to Classes</Button>
      </Box>

      <Typography color="textSecondary" sx={{ mb: 3 }}>
        {classData
          ? `${classData.department_code} - ${classData.year_display || `Year ${classData.year}`} - ${classData.section_display || classData.section}`
          : 'Loading class details...'}
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          ADD SUBJECTS
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button 
            variant="contained" 
            onClick={() => setDialogOpen(true)}
            disabled={loading}
          >
            Add Subject
          </Button>
        </Box>
      </Paper>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Subject</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Autocomplete
              freeSolo
              options={dialogSubjectSuggestions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.name || '';
              }}
              inputValue={dialogSubjectName}
              onInputChange={handleDialogNameChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Subject Name"
                  placeholder="Type or select subject name"
                />
              )}
              renderOption={(props, option) => (
                <Box
                  {...props}
                  onClick={() => handleDialogSubjectSelect(option)}
                  component="li"
                >
                  {option.name}
                </Box>
              )}
            />
            <Autocomplete
              freeSolo
              options={dialogSubjectSuggestions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return option.code || '';
              }}
              inputValue={dialogSubjectCode}
              onInputChange={handleDialogCodeChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Subject Code"
                  placeholder="Type or select subject code"
                />
              )}
              renderOption={(props, option) => (
                <Box
                  {...props}
                  onClick={() => handleDialogSubjectSelect(option)}
                  component="li"
                >
                  {option.code}
                </Box>
              )}
            />
            {dialogSubjectName && dialogSubjectCode && (
              <Typography variant="body2" color="textSecondary">
                Selected: {dialogSubjectCode} - {dialogSubjectName}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            onClick={handleAssignSubject} 
            variant="contained"
            disabled={addingSubject || (!dialogSubjectName.trim() && !dialogSubjectCode.trim())}
          >
            {addingSubject ? <CircularProgress size={20} color="inherit" /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 2, mb: 3 }}>
        {(() => {
          const regularSubjects = (classData?.assigned_subjects || []).filter(
            (subject) => !SPECIAL_SUBJECT_OPTIONS.some((option) => option.code === subject.code)
          );
          
          return regularSubjects.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No subjects assigned
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Subject Code</TableCell>
                    <TableCell>Subject Name</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regularSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell>{subject.code}</TableCell>
                      <TableCell>{subject.name}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleRemoveSubject(subject.id)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          );
        })()}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Special Subjects
        </Typography>
        <Typography color="textSecondary" sx={{ mb: 2 }}>
          Select and save special items for this class.
        </Typography>

        <Grid container spacing={1}>
          {SPECIAL_SUBJECT_OPTIONS.map((option) => (
            <Grid item xs={12} sm={6} md={4} key={option.code}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={selectedSpecialCodes.includes(option.code)}
                    onChange={() => handleSpecialToggle(option.code)}
                  />
                )}
                label={option.label}
              />
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={handleSaveSpecialSubjects} disabled={savingSpecial}>
            Save Special Subjects
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

export default ClassDetailPage;
