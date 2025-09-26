# OneBox Email Aggregator

A feature-rich email aggregator with real-time IMAP synchronization, AI-powered categorization, and RAG-based reply suggestions.

## 🚀 Features

### Core Features
- **Real-Time Email Synchronization**: Multiple IMAP accounts with persistent connections
- **Searchable Storage**: Elasticsearch-powered email indexing and search
- **AI-Based Categorization**: Automatic email categorization (Interested, Meeting Booked, Not Interested, Spam, Out of Office)
- **Slack & Webhook Integration**: Notifications for interested emails
- **Frontend Interface**: Clean UI with filtering and search capabilities
- **AI-Powered Suggested Replies**: RAG-based contextual reply generation

### Additional Features
- Account Management (Add/Remove accounts)
- Email Statistics Dashboard
- Date Range Filtering
- Pagination Support
- Memory-Safe Processing
- Multiple AI Providers (OpenAI, Hugging Face, Local AI)
- Real-time Connection Status

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Docker** and **Docker Compose**
- **Git**

## 🛠️ Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd OneBox
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=onebox_emails
DB_USER=postgres
DB_PASSWORD=password

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://localhost:9200

# AI Provider Configuration (choose one)
AI_PROVIDER=local  # Options: 'openai', 'huggingface', 'local'

# OpenAI Configuration (if using OpenAI)
OPENAI_API_KEY=your_openai_api_key_here

# Hugging Face Configuration (if using Hugging Face)
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=#general

# Webhook Integration
WEBHOOK_URL=https://webhook.site/your-unique-url

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 4. Start Required Services
Start PostgreSQL, Elasticsearch, and Kibana using Docker:

```bash
docker-compose up -d
```

Wait for services to be ready (about 30-60 seconds).

### 5. Build and Start the Application
```bash
# Build TypeScript
npm run build

# Start the application
npm start
```

The application will be available at `http://localhost:3000`

## 🧪 Testing Commands

### 1. Test API Endpoints

#### Get All Accounts
```bash
curl -X GET http://localhost:3000/api/accounts
```

#### Add a New Email Account
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "password": "your-app-password",
    "imapHost": "imap.gmail.com",
    "imapPort": 993
  }'
```

#### Search Emails
```bash
# Get all emails
curl -X GET "http://localhost:3000/api/emails/search"

# Search with query
curl -X GET "http://localhost:3000/api/emails/search?query=important"

# Filter by category
curl -X GET "http://localhost:3000/api/emails/search?category=interested"

# Filter by date range
curl -X GET "http://localhost:3000/api/emails/search?dateFrom=2024-01-01&dateTo=2024-12-31"
```

#### Get Email Statistics
```bash
curl -X GET http://localhost:3000/api/emails/stats
```

#### Get Email by ID
```bash
curl -X GET http://localhost:3000/api/emails/{email-id}
```

#### Categorize Email
```bash
curl -X POST http://localhost:3000/api/emails/{email-id}/categorize
```

#### Generate Suggested Reply
```bash
curl -X POST http://localhost:3000/api/emails/{email-id}/suggest-reply
```

#### Sync Emails for Account
```bash
curl -X POST http://localhost:3000/api/accounts/{account-id}/sync \
  -H "Content-Type: application/json" \
  -d '{"days": 30}'
```

#### Delete Account
```bash
curl -X DELETE http://localhost:3000/api/accounts/{account-id}
```

#### Clear All Emails
```bash
curl -X DELETE http://localhost:3000/api/emails/clear-all
```

### 2. Test Slack Integration
```bash
curl -X POST http://localhost:3000/api/notifications/test-slack
```

### 3. Test Webhook Integration
```bash
curl -X POST http://localhost:3000/api/notifications/test-webhook
```

### 4. PowerShell Testing (Windows)
```powershell
# Get accounts
$accounts = Invoke-RestMethod -Uri "http://localhost:3000/api/accounts" -Method GET

# Search emails
$emails = Invoke-RestMethod -Uri "http://localhost:3000/api/emails/search" -Method GET

# Get stats
$stats = Invoke-RestMethod -Uri "http://localhost:3000/api/emails/stats" -Method GET
```

## 🎯 Feature Testing Guide

### 1. Real-Time Email Synchronization
1. Add an email account using the API
2. Check logs for successful IMAP connection
3. Verify emails are being fetched and stored
4. Test IDLE mode by sending a test email to the account

### 2. AI Categorization
1. Check email categories in the response
2. Verify categories: interested, meeting_booked, not_interested, spam, out_of_office
3. Test manual categorization via API

### 3. Search Functionality
1. Test text search across subject, body, from, to fields
2. Test filtering by category, date range, account
3. Verify Elasticsearch indexing is working

### 4. Frontend Interface
1. Open `http://localhost:3000` in browser
2. Verify email list loads
3. Test search and filter functionality
4. Test email detail modal
5. Test account management features

### 5. Slack Notifications
1. Configure Slack bot token and channel
2. Trigger an "interested" email categorization
3. Verify notification appears in Slack

### 6. Webhook Integration
1. Set up webhook.site URL
2. Configure webhook URL in environment
3. Trigger interested email event
4. Verify webhook receives data

### 7. RAG Reply Suggestions
1. Ensure product context is configured
2. Test reply generation for interested emails
3. Verify contextual information is included

## 🔧 Development Commands

```bash
# Build TypeScript
npm run build

# Start in development mode (with auto-reload)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Clean build
npm run clean
```

## 📊 Monitoring and Logs

### View Application Logs
```bash
# Check application logs
tail -f logs/app.log

# Check error logs
tail -f logs/error.log
```

### Monitor Docker Services
```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs postgres
docker-compose logs elasticsearch
docker-compose logs kibana

# Restart services
docker-compose restart
```

### Elasticsearch Health Check
```bash
curl -X GET "http://localhost:9200/_cluster/health?pretty"
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Error
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres
```

#### 2. Elasticsearch Connection Error
```bash
# Check Elasticsearch health
curl -X GET "http://localhost:9200/_cluster/health"

# Restart Elasticsearch
docker-compose restart elasticsearch
```

#### 3. IMAP Connection Issues
- Verify email credentials
- Check if IMAP is enabled for the email account
- For Gmail, use App Passwords instead of regular password
- Verify IMAP host and port settings

#### 4. Memory Issues
- The application includes memory management features
- If crashes occur, check logs for "JavaScript heap out of memory"
- Restart the application if needed

#### 5. AI Provider Issues
- Verify API keys are correct
- Check AI provider status
- Switch to local AI if external providers fail

### Reset Everything
```bash
# Stop all services
docker-compose down

# Remove all data
docker-compose down -v

# Restart services
docker-compose up -d

# Rebuild and restart application
npm run build
npm start
```

## 📈 Performance Optimization

### Memory Management
- Emails are processed in batches of 10
- Garbage collection is triggered every 5 emails
- Date filtering limits processing to last 2 years

### Connection Management
- IMAP connections use keepalive settings
- IDLE mode with polling fallback
- Connection timeouts configured

## 🔒 Security Considerations

- Store sensitive credentials in environment variables
- Use App Passwords for email accounts
- Configure proper CORS settings for production
- Use HTTPS in production environment

## 📝 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
Currently no authentication required for development. Add authentication middleware for production use.

### Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

## 🎉 Success Criteria

✅ **All 6 Core Features Implemented**
✅ **Real-time IMAP synchronization**
✅ **Elasticsearch search and indexing**
✅ **AI-powered categorization**
✅ **Slack and webhook notifications**
✅ **Frontend interface**
✅ **RAG-based reply suggestions**

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review application logs
3. Verify environment configuration
4. Test individual components using the provided commands

---

**Built with TypeScript, Node.js, Express, Elasticsearch, and AI/ML technologies**