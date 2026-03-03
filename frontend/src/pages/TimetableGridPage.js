import React from 'react';
import { Box, Typography } from '@mui/material';

function TimetableGridPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Timetable Grid
      </Typography>
      <Typography color="textSecondary">
        View and edit timetable schedules with drag & drop support.
      </Typography>
    </Box>
  );
}

export default TimetableGridPage;
