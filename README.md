# PR Agent Backend

A sophisticated GitHub Pull Request analysis platform powered by AI that provides intelligent code review, security analysis, and real-time chat capabilities for enhanced development workflows.

## Overview

PR Agent Backend is a comprehensive NestJS-based application that leverages OpenAI's GPT models to provide detailed pull request analysis, automated code reviews, and interactive chat support. The platform enables developers to get instant feedback on their PRs, identify security vulnerabilities, and receive actionable improvement suggestions.

## Tech Stack

### Core Framework
- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment

### Database & ORM
- **PostgreSQL** - Primary database
- **TypeORM** - Object-relational mapping
- **Database Migrations** - Schema version control

### AI & Machine Learning
- **OpenAI GPT-4** - Code analysis and chat responses
- **Custom AI Prompts** - Specialized PR review algorithms
- **Conversation Context** - Intelligent chat memory

### Authentication & Security
- **JWT** - JSON Web Tokens
- **Google OAuth 2.0** - Social authentication
- **bcrypt** - Password hashing
- **Passport.js** - Authentication middleware

### Real-time Communication
- **Socket.IO** - WebSocket connections
- **Real-time Chat** - Instant messaging
- **Live PR Updates** - Real-time notifications

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **TypeScript Compiler** - Type checking

## Key Features

### 🔍 **Intelligent PR Analysis**
- Automated code quality assessment
- Security vulnerability detection
- Performance optimization suggestions
- Code maintainability scoring

### 💬 **AI-Powered Chat Interface**
- Real-time Q&A about pull requests
- Context-aware conversation memory
- Adaptive response complexity
- Multi-format response support (JSON, text, markdown)

### 🔐 **Comprehensive Authentication**
- Google OAuth integration
- JWT-based session management
- Password reset with OTP verification
- Secure cookie handling

### 📊 **Advanced Analytics**
- PR conversation analytics
- Query type classification
- Confidence scoring
- Context usage tracking

### 🚀 **GitHub Integration**
- Direct PR fetching from GitHub URLs
- Comprehensive metadata extraction
- Review and comment analysis
- File change tracking

### 🔒 **Security Features**
- Input validation and sanitization
- CORS protection
- Authentication guards
- Secure data transmission

## API Endpoints

### Authentication
```http
POST   /auth              # User login
GET    /auth/me           # Get current user
GET    /auth/logout       # User logout
POST   /auth/forgot-password    # Password reset request
PUT    /auth/change-password    # Change user password
POST   /auth/verify-otp   # Verify OTP for password reset
GET    /auth/google       # Google OAuth login
GET    /auth/google/callback    # Google OAuth callback
```

### User Management
```http
POST   /users             # Create new user
GET    /users             # Get all users
GET    /users/:id         # Get user by ID
PATCH  /users/:id         # Update user
DELETE /users/:id         # Delete user
POST   /users/:id/restore # Restore deleted user
```

### Pull Request Management
```http
POST   /pr/fetch-check    # Check PR details without saving
POST   /pr/fetch          # Fetch and save PR details
POST   /pr/analyze        # Analyze PR with AI
GET    /pr/my-prs         # Get user's PRs
GET    /pr/pr_summaries   # Get all PR summaries
GET    /pr/pr_summary/:id # Get specific PR summary
GET    /pr/chat-session/:id # Get PR summary by chat session
```

### Chat Management
```http
POST   /chatbot/sessions           # Create chat session
GET    /chatbot/sessions           # Get user's chat sessions
GET    /chatbot/sessions/:id       # Get session with messages
POST   /chatbot/sessions/:id/ask   # Ask question in session
DELETE /chatbot/sessions/:id       # Delete chat session
GET    /chatbot/analytics/sessions/:id # Get session analytics
```

### WebSocket Events
```javascript
// Client to Server
socket.emit('join_session', { session_id: 'uuid' })
socket.emit('leave_session', { session_id: 'uuid' })
socket.emit('message:send', { session_id: 'uuid', message: 'text' })
socket.emit('typing:start', { session_id: 'uuid' })
socket.emit('typing:stop', { session_id: 'uuid' })

// Server to Client
socket.on('message:new', (data) => {})
socket.on('message:typing', (data) => {})
socket.on('session:updated', (data) => {})
socket.on('session_joined', (data) => {})
socket.on('error', (error) => {})
```

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn package manager

### Environment Variables
Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=pr_agent_db

# Application Configuration
PORT=8000
JWT_SECRET=your_jwt_secret_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Installation Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd pr_agent_backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Database setup**
```bash
# Create PostgreSQL database
createdb pr_agent_db

# Run migrations
npm run migration:run
```

4. **Start the application**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will start on `http://localhost:8000`

## Development

### Available Scripts

```bash
# Development
npm run start:dev    # Start with hot reload
npm run start:debug  # Start with debugging

# Building
npm run build        # Build for production

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:cov     # Run tests with coverage

# Database
npm run migration:generate --name=migration_name  # Generate migration
npm run migration:run     # Run pending migrations
npm run migration:revert  # Revert last migration

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Database Migrations

```bash
# Create a new migration
npm run migration:create --name=AddNewTable

# Generate migration from entity changes
npm run migration:generate --name=UpdateUserEntity

# Run migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

## Project Structure

```
src/
├── version1/
│   ├── auth_management/        # Authentication & authorization
│   ├── user_management/        # User CRUD operations
│   ├── pr_management/          # GitHub PR handling
│   │   ├── pr-fetch/          # PR fetching & saving
│   │   ├── llm/               # AI analysis services
│   │   └── entities/          # Database entities
│   └── chat_management/        # Real-time chat features
│       ├── gateway/           # WebSocket gateway
│       ├── services/          # Chat business logic
│       └── entities/          # Chat-related entities
├── middleware/                 # Custom middleware
├── config/                    # Configuration files
└── main.ts                    # Application entry point
```

## Deployment

### Production Deployment

1. **Build the application**
```bash
npm run build
```

2. **Set production environment variables**
```bash
export NODE_ENV=production
export PORT=8000
export DB_HOST=your_production_db_host
# ... other production vars
```

3. **Run migrations**
```bash
npm run migration:run
```

4. **Start the application**
```bash
npm run start:prod
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 8000

CMD ["node", "dist/main"]
```

```bash
# Build and run
docker build -t pr-agent-backend .
docker run -p 8000:8000 pr-agent-backend
```

### Environment-Specific Configurations

- **Development**: Hot reload, detailed logging, debug mode
- **Staging**: Production-like environment for testing
- **Production**: Optimized build, error handling, monitoring

## API Response Format

All API endpoints follow a consistent response format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information"
  }
}
```

## WebSocket Communication

The application uses Socket.IO for real-time communication:

- **Namespace**: `/chat`
- **Authentication**: JWT token verification
- **Room-based**: Users join session-specific rooms
- **Real-time features**: Instant messaging, typing indicators, live updates

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation for common solutions