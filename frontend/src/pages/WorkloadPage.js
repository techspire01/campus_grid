import React from 'react';
import { Box, Typography } from '@mui/material';

function WorkloadPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Workload Management
      </Typography>
      <Typography color="textSecondary">
        Assign subjects and manage staff workload allocations here.
      </Typography>
    </Box>
  );
}

export default WorkloadPage;
