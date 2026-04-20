import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { chatService } from "../../services/chatService";
import AdminLayout from "../Layout/AdminLayout";

/** Keys aligned with Sidebar `featureKey` and `/api/admin/features`. */
export type ModuleFeatureFlagKey =
  | "module_knowledge_enabled"
  | "module_leads_enabled"
  | "module_analytics_enabled"
  | "module_advanced_analytics_enabled"
  | "module_reports_enabled"
  | "module_campaigns_enabled"
  | "module_appointments_enabled"
  | "module_products_enabled"
  | "module_users_enabled"
  | "human_handoff_enabled"
  | "module_contact_book_enabled"
  | "module_workflows_enabled"
  | "module_message_templates_enabled";

interface ModuleAccessGateProps {
  featureKey: ModuleFeatureFlagKey;
  /** Shown above the title (e.g. "Leads") */
  moduleLabel: string;
  children: React.ReactNode;
}

function RestrictedBackdrop({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: "100%",
        position: "relative",
        overflow: "hidden",
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        background: `linear-gradient(165deg, ${alpha("#e8f1fc", 0.95)} 0%, ${alpha(
          theme.palette.background.default,
          1,
        )} 42%, ${alpha("#eef6ff", 0.92)} 100%)`,
        "&::before": {
          content: '""',
          position: "absolute",
          top: "-18%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(920px, 140%)",
          height: "52%",
          background: `radial-gradient(ellipse at center, ${alpha(theme.palette.primary.main, 0.14)} 0%, transparent 68%)`,
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: "-8%",
          right: "-6%",
          width: "min(420px, 55vw)",
          height: "min(420px, 55vw)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.2)} 0%, transparent 70%)`,
          pointerEvents: "none",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          pt: { xs: 3.5, md: 5 },
          px: 2,
          pb: 4,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/**
 * When a module flag is false for the org, still render the route but show a clear
 * "Access restricted" panel instead of the real page (direct URL / bookmark friendly).
 */
const ModuleAccessGate: React.FC<ModuleAccessGateProps> = ({ featureKey, moduleLabel, children }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const flags = await chatService.getFeatureFlags();
        if (cancelled) return;
        const raw = (flags as unknown as Record<string, boolean | undefined>)[featureKey];
        setAllowed(raw !== false);
      } catch {
        if (!cancelled) setAllowed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [featureKey]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          width: "100%",
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          background: `linear-gradient(165deg, ${alpha("#e8f1fc", 0.95)} 0%, ${alpha(
            theme.palette.background.default,
            1,
          )} 50%, ${alpha("#eef6ff", 0.92)} 100%)`,
        }}
      >
        <CircularProgress size={36} thickness={4} sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (!allowed) {
    const card = (
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
              {moduleLabel}
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
    );

    return (
      <AdminLayout>
        <RestrictedBackdrop>{card}</RestrictedBackdrop>
      </AdminLayout>
    );
  }

  return <>{children}</>;
};

export default ModuleAccessGate;
