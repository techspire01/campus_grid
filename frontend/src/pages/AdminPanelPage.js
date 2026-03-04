import React from 'react';
import { Box, Typography } from '@mui/material';

function AdminPanelPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>
      <Typography color="textSecondary">
        Configure departments, labs, subjects, and user workloads here.
      </Typography>
    </Box>
  );
}

export default AdminPanelPage;
