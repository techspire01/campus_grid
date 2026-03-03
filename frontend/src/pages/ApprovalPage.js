import React from 'react';
import { Box, Typography } from '@mui/material';

function ApprovalPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Approvals
      </Typography>
      <Typography color="textSecondary">
        Review and approve/reject common timetable schedules here.
      </Typography>
    </Box>
  );
}

export default ApprovalPage;
