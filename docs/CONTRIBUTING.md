# Contributing to AI Chatbot Platform

Thank you for your interest in contributing to the AI Chatbot Platform! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/ai_bot.git`
3. Run the setup script: `./setup.sh`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Project Structure

- `backend/` - FastAPI backend with RAG capabilities
- `frontend/` - React admin portal and chat interface
- `widget/` - Embeddable chat widget

## Code Style

### Python (Backend)
- Follow PEP 8 guidelines
- Use type hints where possible
- Add docstrings to functions and classes
- Keep functions focused and under 50 lines when possible

### TypeScript (Frontend/Widget)
- Use TypeScript strict mode
- Follow React best practices
- Use functional components with hooks
- Keep components under 300 lines

## Testing

### Backend
```bash
cd backend
source venv/bin/activate
pytest
```

### Frontend
```bash
cd frontend
npm test
```

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Update the README.md if needed
3. Add tests for new features
4. Update documentation
5. Create a pull request with a clear description

## Commit Messages

Use clear, descriptive commit messages:
- `feat: Add new feature`
- `fix: Fix bug in component`
- `docs: Update documentation`
- `refactor: Refactor code`
- `test: Add tests`

## Feature Requests

Open an issue with the label "enhancement" and describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Bug Reports

Open an issue with the label "bug" and include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Your environment (OS, browser, versions)

## Questions?

Open an issue with the label "question" or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
