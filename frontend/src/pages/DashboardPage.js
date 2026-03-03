import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Grid, Typography, CircularProgress } from '@mui/material';
import { collegeService } from '../services';
import { useAuthStore } from '../store';

function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (user?.college) {
          const response = await collegeService.statistics(user.college);
          setStats(response.data);
        }
      } catch (err) {
        setError('Failed to load statistics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const StatCard = ({ title, value, color }) => (
    <Card>
      <CardContent>
        <Typography color="textSecondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h5" sx={{ color }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Departments" value={stats?.total_departments || 0} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Staff" value={stats?.total_staff || 0} color="secondary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Labs" value={stats?.total_labs || 0} color="success.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Subjects" value={stats?.total_subjects || 0} color="warning.main" />
        </Grid>
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Welcome, {user?.first_name} {user?.last_name}!
          </Typography>
          <Typography color="textSecondary">
            Role: <strong>{user?.role}</strong>
          </Typography>
          <Typography color="textSecondary" sx={{ mt: 1 }}>
            Email: <strong>{user?.email}</strong>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default DashboardPage;
