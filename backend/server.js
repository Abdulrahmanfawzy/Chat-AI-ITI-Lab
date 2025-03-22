const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');
const OpenAI = require("openai");
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Validate API key presence
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in .env file');
  process.exit(1);
}

// Validate API key format
if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
  console.error('Invalid OpenAI API key format. Key should start with "sk-"');
  process.exit(1);
}

// const configuration = new Configuration({
//   apiKey: process.env.OPENAI_API_KEY,
// });
// const openai = new OpenAIApi(configuration);


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // تأكد أن لديك API Key في المتغيرات البيئية
});

async function generateResponse(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // أو أي نموذج متاح لديك
      messages: [{ role: "user", content: prompt }],
    });

    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error);
  }
}

generateResponse("Hello, how are you?");


// Add rate limiting to stay within free tier limits
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

// Add Gemini API function
async function callGeminiAPI(message) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: message }]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

app.post('/chat', async (req, res) => {
  try {
    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      return res.status(429).json({ 
        error: 'Please wait a moment before sending another message',
        isRateLimit: true 
      });
    }
    lastRequestTime = now;

    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Using API key:', process.env.OPENAI_API_KEY.substring(0, 7) + '...');
    
    try {
      // Try OpenAI first
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
        temperature: 0.7,
      });

      if (!completion.data.choices || completion.data.choices.length === 0) {
        throw new Error('No response from OpenAI');
      }

      res.json({ response: completion.data.choices[0].message.content });
    } catch (primaryError) {
      console.warn('OpenAI API failed, falling back to Gemini:', primaryError.message);
      
      try {
        // Fallback to Gemini
        const geminiResponse = await callGeminiAPI(message);
        res.json({ 
          response: geminiResponse,
          isFailover: true,
          provider: 'gemini'
        });
      } catch (fallbackError) {
        if (fallbackError.response?.data?.error?.code === 'insufficient_quota') {
          console.warn('Gemini API quota exceeded, using fallback response');
          // Send a fallback response
          return res.json({ 
            response: "I apologize, but the API quota has been exceeded. Please try again later or add billing information to your Gemini account.",
            isFailover: true
          });
        }
        throw new Error('Both APIs failed');
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Error communicating with AI services',
      details: error.message 
    });
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
