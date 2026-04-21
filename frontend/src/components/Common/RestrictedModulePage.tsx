import React from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { allMenuItems } from "./Sidebar";
import AdminLayout from "../Layout/AdminLayout";


interface RestrictedFeaturePageProps {
  modulePath: string
}

const RestrictedFeaturePage: React.FC<RestrictedFeaturePageProps> = ({ modulePath }) => {
  const theme = useTheme();

  const activeMenuItem = allMenuItems.find((item) =>
    modulePath.startsWith(item.path)
  );

  const activeModuleLabel = activeMenuItem?.text ?? "";

  return (
    <AdminLayout>
      <Paper
        elevation={0}
        sx={{
          position: "relative",
          maxWidth: 480,
          width: "100%",
          overflow: "hidden",
          borderRadius: "24px",
          textAlign: "center",
          border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
          boxShadow: `0 28px 64px ${alpha(theme.palette.primary.dark, 0.12)}, 0 0 0 1px ${alpha(
            theme.palette.common.white,
            0.75,
          )} inset`,
          background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(
            "#f8fafc",
            0.99,
          )} 55%, ${alpha(theme.palette.primary.light, 0.06)} 100%)`,
          backdropFilter: "blur(12px)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 5,
            background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${alpha(
              theme.palette.primary.light,
              0.95,
            )} 55%, ${alpha(theme.palette.secondary?.main || theme.palette.primary.dark, 0.85)} 100%)`,
          }}
        />
        <Stack spacing={0} sx={{ px: { xs: 2.75, sm: 3.75 }, pt: 3.25, pb: 3.5 }}>
          <Box sx={{ pt: 0.25, pb: 0.5 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                mx: "auto",
                mb: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `linear-gradient(145deg, ${alpha(theme.palette.warning.light, 0.55)} 0%, ${alpha(
                  theme.palette.warning.main,
                  0.12,
                )} 100%)`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                boxShadow: `0 12px 28px ${alpha(theme.palette.warning.dark, 0.12)}`,
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 40, color: alpha(theme.palette.warning.dark, 0.92) }} />
            </Box>

            <Typography
              variant="overline"
              sx={{
                color: "primary.main",
                fontWeight: 800,
                letterSpacing: 2,
                display: "block",
                opacity: 0.9,
              }}
            >
              {activeModuleLabel}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                mt: 0.75,
                mb: 1.25,
                background: `linear-gradient(115deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 45%, ${alpha(
                  theme.palette.primary.light,
                  0.95,
                )} 100%)`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.2,
              }}
            >
              Access restricted
            </Typography>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              maxWidth: 400,
              mx: "auto",
              lineHeight: 1.75,
              fontSize: "0.9375rem",
            }}
          >
            This module isn&apos;t enabled for your organization yet. You can keep this page open, but
            features stay off until an administrator enables the module in organization settings.
          </Typography>
        </Stack>
      </Paper>
    </AdminLayout>

  );

};

export default RestrictedFeaturePage;
