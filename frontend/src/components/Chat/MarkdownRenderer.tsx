import React from 'react';
import { Typography, Box, List, ListItem, ListItemIcon } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

interface MarkdownRendererProps {
  content: string;
  isUserMessage?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUserMessage = false }) => {
  // Split content by lines to handle different markdown elements
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'unordered' | 'ordered' | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'unordered') {
        elements.push(
          <List key={`list-${elements.length}`} sx={{ py: 0, my: 1 }}>
            {currentList.map((item, idx) => (
              <ListItem key={idx} sx={{ py: 0.5, px: 2 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <FiberManualRecordIcon sx={{ fontSize: '0.5rem' }} />
                </ListItemIcon>
                <Typography 
                  variant="body2" 
                  sx={{ color: isUserMessage ? 'white' : '#1e293b' }}
                >
                  {parseInlineMarkdown(item)}
                </Typography>
              </ListItem>
            ))}
          </List>
        );
      } else if (listType === 'ordered') {
        elements.push(
          <Box key={`list-${elements.length}`} component="ol" sx={{ py: 0, my: 1, pl: 3 }}>
            {currentList.map((item, idx) => (
              <Typography 
                key={idx} 
                component="li" 
                variant="body2" 
                sx={{ color: isUserMessage ? 'white' : '#1e293b', mb: 0.5 }}
              >
                {parseInlineMarkdown(item)}
              </Typography>
            ))}
          </Box>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  const parseInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(_[^_]+_)|(`[^`]+`)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add plain text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const matched = match[0];
      if (matched.startsWith('**') || matched.startsWith('__')) {
        // Bold
        parts.push(
          <strong key={`bold-${parts.length}`}>
            {matched.slice(2, -2)}
          </strong>
        );
      } else if (matched.startsWith('*') || matched.startsWith('_')) {
        // Italic
        parts.push(
          <em key={`italic-${parts.length}`}>
            {matched.slice(1, -1)}
          </em>
        );
      } else if (matched.startsWith('`')) {
        // Code
        parts.push(
          <code 
            key={`code-${parts.length}`}
            style={{
              backgroundColor: isUserMessage ? 'rgba(255,255,255,0.2)' : '#f0f4f8',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.9em',
            }}
          >
            {matched.slice(1, -1)}
          </code>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining plain text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Process lines
  lines.forEach((line) => {
    // Check for unordered list items (starting with - or *)
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (listType !== 'unordered') {
        flushList();
        listType = 'unordered';
      }
      currentList.push(line.trim().substring(2));
    }
    // Check for ordered list items (starting with 1. 2. etc)
    else if (/^\d+\.\s/.test(line.trim())) {
      if (listType !== 'ordered') {
        flushList();
        listType = 'ordered';
      }
      currentList.push(line.trim().replace(/^\d+\.\s/, ''));
    }
    // Check for headings
    else if (line.trim().startsWith('#')) {
      flushList();
      const level = line.match(/^#+/)?.[0].length || 1;
      const headingText = line.substring(level + 1).trim();
      const variantMap: Record<number, any> = {
        1: 'h6',
        2: 'body1',
        3: 'body2',
      };
      elements.push(
        <Typography 
          key={`h-${elements.length}`} 
          variant={variantMap[Math.min(level, 3)] || 'body2'} 
          sx={{ 
            fontWeight: 700, 
            mt: 1,
            mb: 0.5,
            color: isUserMessage ? 'white' : '#1e293b'
          }}
        >
          {parseInlineMarkdown(headingText)}
        </Typography>
      );
    }
    // Empty lines
    else if (line.trim() === '') {
      flushList();
      elements.push(<Box key={`space-${elements.length}`} sx={{ height: 4 }} />);
    }
    // Regular text
    else {
      flushList();
      elements.push(
        <Typography 
          key={`p-${elements.length}`} 
          variant="body1" 
          sx={{ 
            mb: 1,
            color: isUserMessage ? 'white' : '#1e293b',
            lineHeight: 1.5,
          }}
        >
          {parseInlineMarkdown(line)}
        </Typography>
      );
    }
  });

  // Flush any remaining list
  flushList();

  return <Box>{elements}</Box>;
};

export default MarkdownRenderer;
