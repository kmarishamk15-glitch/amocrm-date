const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// amoCRM credentials
const AMO_SUBDOMAIN = process.env.AMO_SUBDOMAIN;
const AMO_CLIENT_ID = process.env.AMO_CLIENT_ID;
const AMO_CLIENT_SECRET = process.env.AMO_CLIENT_SECRET;
const AMO_REDIRECT_URI = process.env.AMO_REDIRECT_URI;
const AMO_ACCESS_TOKEN = process.env.AMO_ACCESS_TOKEN;
const AMO_REFRESH_TOKEN = process.env.AMO_REFRESH_TOKEN;

// Pipeline and stage IDs from your requirements
const PIPELINE_SERVICES = 5240944; // Услуги
const STAGE_NEW_LEAD = 47069740;   // получен новый лид
const PIPELINE_TECHNIQUE = 5276629; // Техника
const STAGE_CLOSED_NOT_REALIZED = 143; // Закрыто и не реализовано

let accessToken = AMO_ACCESS_TOKEN;

// Helper function to make API requests to amoCRM
async function amoCRMRequest(url, method = 'GET', data = null, retry = true) {
  try {
    const response = await axios({
      method,
      url: `https://${AMO_SUBDOMAIN}.amocrm.ru${url}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401 && retry) {
      // Token expired, refresh it
      await refreshAccessToken();
      return amoCRMRequest(url, method, data, false);
    }
    throw error;
  }
}

// Refresh access token
async function refreshAccessToken() {
  try {
    const response = await axios.post(
      `https://${AMO_SUBDOMAIN}.amocrm.ru/oauth20/token`,
      {
        client_id: AMO_CLIENT_ID,
        client_secret: AMO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: AMO_REFRESH_TOKEN,
        redirect_uri: AMO_REDIRECT_URI
      }
    );
    
    accessToken = response.data.access_token;
    console.log('Access token refreshed');
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    throw error;
  }
}

// Webhook endpoint
app.post('/webhook/amocrm', async (req, res) => {
  try {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    const deal = req.body;
    
    // Check if deal moved from Services pipeline to Technique pipeline
    if (
      deal.pipeline_id === PIPELINE_TECHNIQUE &&
      deal.status_id !== STAGE_CLOSED_NOT_REALIZED
    ) {
      // Update deal date to today
      await updateDealDate(deal.id);
      console.log(`Updated date for deal ${deal.id}`);
    } else if (
      deal.pipeline_id === PIPELINE_TECHNIQUE &&
      deal.status_id === STAGE_CLOSED_NOT_REALIZED
    ) {
      // Keep the original date - do nothing
      console.log(`Deal ${deal.id} closed and not realized - keeping original date`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).send('Error processing webhook');
  }
});

// Update deal date to current date
async function updateDealDate(dealId) {
  const today = new Date();
  const formattedDate = today.toISOString();
  
  try {
    await amoCRMRequest(`/api/v4/leads/${dealId}`, 'PATCH', {
      created_at: Math.floor(today.getTime() / 1000)
    });
    
    console.log(`Successfully updated deal ${dealId} date to ${formattedDate}`);
  } catch (error) {
    console.error(`Error updating deal ${dealId}:`, error.message);
    throw error;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'amoCRM Date Integration is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
