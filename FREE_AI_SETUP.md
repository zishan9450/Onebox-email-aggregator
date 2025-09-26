# 🆓 Free AI API Setup Guide

Since your OpenAI API quota has been exceeded, here are **3 free alternatives** you can use with OneBox:

## 🥇 **Option 1: Local Rule-Based AI (Recommended - 100% Free)**

**✅ Pros:**
- Completely free, no API keys needed
- No rate limits
- Works offline
- Fast processing
- No external dependencies

**❌ Cons:**
- Less sophisticated than AI models
- Rule-based categorization

**Setup:**
```bash
# In your .env file, set:
AI_PROVIDER=local
```

**How it works:**
- Analyzes email content using keyword matching
- Categorizes based on patterns like "interested", "meeting", "not interested", etc.
- Generates template-based replies
- **Already configured and ready to use!**

---

## 🥈 **Option 2: Hugging Face API (Free Tier)**

**✅ Pros:**
- 1,000 free requests/month
- Real AI models
- Good accuracy
- Easy setup

**❌ Cons:**
- Limited free requests
- Requires API key
- Rate limits

**Setup:**
1. **Get API Key:**
   - Go to [huggingface.co](https://huggingface.co)
   - Sign up for free account
   - Go to Settings → Access Tokens
   - Create new token

2. **Configure:**
   ```bash
   # In your .env file:
   AI_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=hf_your-token-here
   ```

3. **Restart your application:**
   ```bash
   npm start
   ```

---

## 🥉 **Option 3: Cohere AI (Free Tier)**

**✅ Pros:**
- Generous free tier
- Good for text generation
- Professional API

**❌ Cons:**
- Requires API key
- More complex setup

**Setup:**
1. **Get API Key:**
   - Go to [cohere.ai](https://cohere.ai)
   - Sign up for free account
   - Get your API key

2. **Add to AIService:**
   - Would need to create `CohereService.ts` (similar to HuggingFaceService)
   - Add Cohere integration to AIService

---

## 🚀 **Quick Start (Recommended)**

**Use the Local AI immediately:**

1. **Update your .env file:**
   ```bash
   AI_PROVIDER=local
   ```

2. **Restart your application:**
   ```bash
   npm start
   ```

3. **Test it:**
   - Go to your email list
   - Click "Categorize" on any email
   - You'll see it working with the local rule-based AI!

---

## 📊 **Comparison Table**

| Feature | Local AI | Hugging Face | Cohere |
|---------|----------|--------------|---------|
| **Cost** | Free | Free (1K/month) | Free (generous) |
| **Setup** | Instant | Easy | Medium |
| **Accuracy** | Good | Very Good | Very Good |
| **Rate Limits** | None | Yes | Yes |
| **Offline** | Yes | No | No |

---

## 🔧 **How to Switch Providers**

You can easily switch between providers by changing one line in your `.env` file:

```bash
# For Local AI (free, no API key needed)
AI_PROVIDER=local

# For Hugging Face (free tier, needs API key)
AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_your-key-here

# For OpenAI (when quota resets)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

---

## 🎯 **Recommendation**

**Start with Local AI** - it's already configured and will work immediately without any setup. You can always upgrade to Hugging Face or back to OpenAI later when your quota resets.

The Local AI will categorize emails based on keywords and generate appropriate replies, which should be sufficient for testing and demonstration purposes.
