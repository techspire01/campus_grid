import React, { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TableSortLabel,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store';

function DepartmentDetailPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const collegeId = useMemo(() => user?.college?.id || user?.college || null, [user]);

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, [collegeId]);

  const fetchDepartments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (collegeId) params.append('college', collegeId);
      const response = await api.get(`/departments/?${params.toString()}`);
      const deptData = response.data.results || response.data;
      setDepartments(Array.isArray(deptData) ? deptData : []);
    } catch (err) {
      console.error('Error fetching departments:', err);
      setError('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentClick = (department) => {
    navigate(`/department/${department.id}`, { state: { department } });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Department Dashboard
      </Typography>
      <Typography color="textSecondary" sx={{ mb: 3 }}>
        View all departments and click to see details
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Department Name</TableCell>
              <TableCell>Department Code</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  No departments found
                </TableCell>
              </TableRow>
            ) : (
              departments.map((department) => (
                <TableRow
                  key={department.id}
                  onClick={() => handleDepartmentClick(department)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                >
                  <TableCell>{department.name}</TableCell>
                  <TableCell>{department.code}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default DepartmentDetailPage;
