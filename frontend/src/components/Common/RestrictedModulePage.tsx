import React from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { allMenuItems } from "./Sidebar";
import AdminLayout from "../Layout/AdminLayout";

interface RestrictedFeaturePageProps {
  modulePath: string;
}

const RestrictedFeaturePage: React.FC<RestrictedFeaturePageProps> = ({
  modulePath,
}) => {
  const theme = useTheme();

  const activeMenuItem = allMenuItems.find((item) =>
    modulePath.startsWith(item.path),
  );

  const activeModuleLabel = activeMenuItem?.text ?? "";

  return (
    <AdminLayout>
      <Box
        sx={{
          width: "100%",
          minHeight: { xs: "62vh", md: "74vh" },
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          pt: { xs: 4, md: 7 },
          px: 2,
          pb: 4,
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(165deg, ${alpha("#eaf3ff", 0.95)} 0%, ${alpha(
            theme.palette.background.default,
            1,
          )} 46%, ${alpha("#eef6ff", 0.9)} 100%)`,
          "&::before": {
            content: '""',
            position: "absolute",
            top: "-26%",
            left: "52%",
            transform: "translateX(-50%)",
            width: "min(1040px, 160%)",
            height: "68%",
            background: `radial-gradient(ellipse at center, ${alpha(theme.palette.primary.main, 0.16)} 0%, transparent 68%)`,
            pointerEvents: "none",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            bottom: "-12%",
            right: "-8%",
            width: "min(560px, 64vw)",
            height: "min(560px, 64vw)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.22)} 0%, transparent 70%)`,
            pointerEvents: "none",
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            zIndex: 1,
            maxWidth: 640,
            width: "100%",
            overflow: "hidden",
            borderRadius: "28px",
            textAlign: "center",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
            boxShadow: `0 36px 90px ${alpha(theme.palette.primary.dark, 0.12)}, 0 0 0 1px ${alpha(
              theme.palette.common.white,
              0.78,
            )} inset`,
            background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.96)} 0%, ${alpha(
              "#f8fafc",
              0.98,
            )} 52%, ${alpha(theme.palette.primary.light, 0.08)} 100%)`,
            backdropFilter: "blur(14px)",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `radial-gradient(circle at 18% 6%, ${alpha(theme.palette.primary.light, 0.22)} 0%, transparent 46%),
                radial-gradient(circle at 86% 18%, ${alpha(theme.palette.secondary?.main || theme.palette.primary.main, 0.12)} 0%, transparent 44%)`,
              opacity: 0.55,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${alpha(
                theme.palette.primary.light,
                0.95,
              )} 55%, ${alpha(theme.palette.secondary?.main || theme.palette.primary.dark, 0.85)} 100%)`,
            }}
          />

          <Stack
            spacing={0}
            sx={{
              position: "relative",
              px: { xs: 3.25, sm: 5.5 },
              pt: 4.75,
              pb: 5.25,
            }}
          >
            <Box sx={{ pt: 0.25, pb: 0.25 }}>
              <Box
                sx={{
                  position: "relative",
                  mx: "auto",
                  mb: 2.25,
                  width: 92,
                  height: 92,
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    inset: -10,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${alpha(theme.palette.warning.light, 0.35)} 0%, transparent 65%)`,
                    filter: "blur(1px)",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(145deg, ${alpha(theme.palette.warning.light, 0.65)} 0%, ${alpha(
                      theme.palette.warning.main,
                      0.12,
                    )} 100%)`,
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.34)}`,
                    boxShadow: `0 18px 40px ${alpha(theme.palette.warning.dark, 0.13)}`,
                  }}
                >
                  <LockOutlinedIcon
                    sx={{
                      fontSize: 42,
                      color: alpha(theme.palette.warning.dark, 0.92),
                    }}
                  />
                </Box>
              </Box>

              {!!activeModuleLabel && (
                <Typography
                  variant="overline"
                  sx={{
                    color: alpha(theme.palette.text.primary, 0.72),
                    fontWeight: 800,
                    letterSpacing: 2.4,
                    display: "block",
                    mb: 0.25,
                  }}
                >
                  {activeModuleLabel}
                </Typography>
              )}
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 850,
                  mt: 0.5,
                  mb: 1.25,
                  fontSize: { xs: "1.6rem", sm: "1.85rem" },
                  background: `linear-gradient(115deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 45%, ${alpha(
                    theme.palette.primary.light,
                    0.95,
                  )} 100%)`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                  lineHeight: 1.18,
                }}
              >
                Access restricted
              </Typography>
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                maxWidth: 440,
                mx: "auto",
                lineHeight: 1.8,
                fontSize: { xs: "0.93rem", sm: "0.98rem" },
              }}
            >
              This module isn&apos;t enabled for your organization yet. You can
              keep this page open, but features stay off until an administrator
              enables the module in organization settings.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </AdminLayout>
  );
};

export default RestrictedFeaturePage;
