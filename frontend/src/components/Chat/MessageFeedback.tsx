import React, { useState } from 'react';
import {
  Box,
  Rating,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface MessageFeedbackProps {
  messageIndex: number;
  sessionId: string;
  onFeedbackSubmitted?: () => void;
}

export const MessageFeedback: React.FC<MessageFeedbackProps> = ({
  messageIndex,
  sessionId,
  onFeedbackSubmitted,
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleOpenDialog = () => {
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    if (!submitted) {
      setRating(null);
      setFeedback('');
    }
  };

  const handleSubmitFeedback = async () => {
    if (rating === null) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message_index: messageIndex,
          rating,
          feedback_text: feedback || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
      setTimeout(() => {
        handleCloseDialog();
        setSubmitted(false);
        setRating(null);
        setFeedback('');
        onFeedbackSubmitted?.();
      }, 2000);
    } catch (err) {
      setError('Failed to submit feedback. Please try again.');
      console.error('Error submitting feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRatingLabel = (ratingValue: number | null) => {
    switch (ratingValue) {
      case 1:
        return '😞 Poor - Needs improvement';
      case 2:
        return '😕 Below average - Could be better';
      case 3:
        return '😐 Average - Acceptable';
      case 4:
        return '🙂 Good - Helpful';
      case 5:
        return '😊 Excellent - Very helpful!';
      default:
        return '';
    }
  };

  if (submitted) {
    return (
      <Box sx={{ textAlign: 'center', py: 1.5 }}>
        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32, mb: 0.5 }} />
        <p style={{ fontSize: '12px', margin: 0, color: '#2f855a' }}>Thank you for your feedback!</p>
      </Box>
    );
  }

  return (
    <>
      <Tooltip title="Rate this response">
        <IconButton
          size="small"
          onClick={handleOpenDialog}
          sx={{
            color: 'primary.main',
            padding: '4px',
            border: '1px solid rgba(53,108,255,0.2)',
            borderRadius: 1.5,
            '&:hover': {
              backgroundColor: 'rgba(53,108,255,0.12)',
            },
          }}
        >
          <ThumbUpIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            background: 'linear-gradient(150deg, rgba(255,255,255,0.98) 0%, rgba(239,246,255,0.96) 100%)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 800, color: 'primary.main' }}>Rate this response</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Rating
              value={rating}
              onChange={(_, value) => setRating(value)}
              size="large"
              sx={{
                fontSize: '2.3rem',
                '& .MuiRating-iconFilled': {
                  color: '#2d8ef0',
                },
              }}
            />
          </Box>

          {rating && (
            <Box sx={{ textAlign: 'center', mb: 2.5, color: 'text.secondary', fontWeight: 600, fontSize: '0.85rem' }}>
              {getRatingLabel(rating)}
            </Box>
          )}

          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Tell us what you think (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': {
                  borderColor: '#356dff',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#356dff',
                },
              },
            }}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitFeedback}
            variant="contained"
            disabled={rating === null || loading}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: rating ? 'linear-gradient(135deg, #2f5ce0 0%, #2d8ef0 100%)' : '#ccc',
            }}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MessageFeedback;
