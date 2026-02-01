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
        <p style={{ fontSize: '12px', margin: 0, color: '#4caf50' }}>Thank you for your feedback!</p>
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
            color: '#2db3a0',
            padding: '4px',
            '&:hover': {
              backgroundColor: 'rgba(45, 179, 160, 0.08)',
            },
          }}
        >
          <ThumbUpIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Rate this response</DialogTitle>
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
              sx={{ fontSize: '2.5rem' }}
            />
          </Box>

          {rating && (
            <Box sx={{ textAlign: 'center', mb: 3, color: '#64748b', fontWeight: 500 }}>
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
                '&:hover fieldset': {
                  borderColor: '#2db3a0',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2db3a0',
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
              background: rating ? 'linear-gradient(135deg, #2db3a0 0%, #1b9a7f 100%)' : '#ccc',
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
