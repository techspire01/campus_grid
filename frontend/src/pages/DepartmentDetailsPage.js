import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import api from '../services/api';
import { departmentService } from '../services';

function DepartmentDetailsPage() {
  const { departmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [department, setDepartment] = useState(null);
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartmentData();
  }, [departmentId]);

  const fetchDepartmentData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch department details
      const deptRes = await departmentService.get(departmentId);
      setDepartment(deptRes.data);

      // Fetch classes for this department
      const classesRes = await api.get(`/classes/?department=${departmentId}`);
      const classesData = classesRes.data.results || classesRes.data;
      setClasses(Array.isArray(classesData) ? classesData : []);

      // Fetch staff for this department
      const staffRes = await departmentService.staffMembers(departmentId);
      const staffData = staffRes.data.results || staffRes.data;
      setStaff(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      console.error('Error fetching department data:', err);
      setError('Failed to load department data');
    } finally {
      setLoading(false);
    }
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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">
          Department Details
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Department Details Card */}
      {department && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary" gutterBottom>
                  Department Name
                </Typography>
                <Typography variant="h6">{department.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography color="textSecondary" gutterBottom>
                  Department Code
                </Typography>
                <Typography variant="h6">{department.code}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Classes Section */}
      <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
        Classes
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Class</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Section</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  No classes found
                </TableCell>
              </TableRow>
            ) : (
              classes.map((classItem) => (
                <TableRow
                  key={classItem.id}
                  onClick={() => navigate(`/classes/${classItem.id}`)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                >
                  <TableCell>
                    {classItem.department_code} - {classItem.year_display || `Year ${classItem.year}`} -{' '}
                    {classItem.section_display || classItem.section}
                  </TableCell>
                  <TableCell>{classItem.year_display || `Year ${classItem.year}`}</TableCell>
                  <TableCell>{classItem.section_display || classItem.section}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Staff Section */}
      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Staff Members
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Role</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No staff members found
                </TableCell>
              </TableRow>
            ) : (
              staff.map((staffMember) => {
                const firstName = staffMember.user?.first_name || staffMember.first_name || '';
                const lastName = staffMember.user?.last_name || staffMember.last_name || '';
                const email = staffMember.user?.email || staffMember.email || '-';
                const phone = staffMember.phone || (staffMember.user?.phone) || '-';
                return (
                  <TableRow key={staffMember.id}>
                    <TableCell>
                      {firstName} {lastName}
                    </TableCell>
                    <TableCell>{email}</TableCell>
                    <TableCell>{phone}</TableCell>
                    <TableCell>{staffMember.role || 'Staff'}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default DepartmentDetailsPage;
