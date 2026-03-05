import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Typography,
  Container,
  useMediaQuery,
  useTheme,
  IconButton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ApprovalIcon from '@mui/icons-material/CheckCircle';
import WorkIcon from '@mui/icons-material/Work';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import BookIcon from '@mui/icons-material/Book';
import ScienceIcon from '@mui/icons-material/Science';
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import ClassIcon from '@mui/icons-material/Class';

const DRAWER_WIDTH = 240;

function Layout({ children }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'LAB_INCHARGE', 'COMMON_SUBJECT_HEAD', 'STAFF', 'STUDENT'] },
    { label: 'Subjects', icon: <BookIcon />, path: '/subjects', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN'] },
    { label: 'Labs', icon: <ScienceIcon />, path: '/labs', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN'] },
    { label: 'Classes', icon: <ClassIcon />, path: '/classes', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN'] },
    { label: 'Staff', icon: <GroupWorkIcon />, path: '/staff', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN'] },
    { label: 'Common Timetable', icon: <ScheduleIcon />, path: '/common-timetable', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN'] },
    { label: 'Department Timetable', icon: <GroupWorkIcon />, path: '/department-timetable', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD'] },
    { label: 'Timetable Grid', icon: <ViewTimelineIcon />, path: '/timetable', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD'] },
    { label: 'Final Timetable', icon: <CalendarTodayIcon />, path: '/final-timetable', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'STAFF', 'STUDENT'] },
    { label: 'Approvals', icon: <ApprovalIcon />, path: '/approvals', roles: ['LAB_INCHARGE', 'COMMON_SUBJECT_HEAD', 'COLLEGE_ADMIN'] },
    { label: 'Workload', icon: <WorkIcon />, path: '/workload', roles: ['HOD'] },
    { label: 'Admin Panel', icon: <AdminPanelSettingsIcon />, path: '/admin', roles: ['SUPER_ADMIN', 'COLLEGE_ADMIN'] },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(user?.role)
  );

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH }}>
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 1 }} />
        <Typography variant="subtitle1">{user?.first_name} {user?.last_name}</Typography>
        <Typography variant="caption" color="textSecondary">
          {user?.role}
        </Typography>
      </Box>
      <Divider />
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              onClick={() => {
                navigate(item.path);
                setDrawerOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Campus Timetable Scheduler
          </Typography>
          <Avatar
            onClick={handleMenuOpen}
            sx={{ cursor: 'pointer', width: 40, height: 40 }}
          />
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>{user?.email}</MenuItem>
            <Divider />
            <MenuItem onClick={() => navigate('/settings')}>
              <SettingsIcon sx={{ mr: 1 }} /> Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              mt: 8,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          width: { xs: '100%', sm: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Container maxWidth="lg">{children}</Container>
      </Box>
    </Box>
  );
}

export default Layout;
