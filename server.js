const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const livereload = require('livereload');
const connectLiveReload = require('connect-livereload');

const liveReloadServer = livereload.createServer();
liveReloadServer.watch(path.join(__dirname, 'public'));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(connectLiveReload());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const form = new FormData();
    form.append('email', email);
    form.append('password', password);

    const response = await axios.post('https://b2b.cas.ai/api/login', form, {
      headers: form.getHeaders()
    });

    return res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: 'Internal Server Error' };
    return res.status(status).json(data);
  }
});

app.get('/api/mediation/apps', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const response = await axios.get('https://b2b.cas.ai/api/mediation/apps', {
      headers: {
        'Authorization': authHeader
      }
    });

    return res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: 'Internal Server Error' };
    return res.status(status).json(data);
  }
});

app.get('/api/mediation/country', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const response = await axios.get('https://b2b.cas.ai/api/mediation/country', {
      headers: {
        'Authorization': authHeader
      }
    });

    return res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: 'Internal Server Error' };
    return res.status(status).json(data);
  }
});

app.get('/api/mediation/adsources', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const response = await axios.get('https://b2b.cas.ai/api/mediation/adsources', {
      headers: {
        'Authorization': authHeader
      }
    });

    return res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: 'Internal Server Error' };
    return res.status(status).json(data);
  }
});

app.post('/api/mediation/data', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const response = await axios.post('https://b2b.cas.ai/api/mediation/data', req.body, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    return res.json(response.data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: 'Internal Server Error' };
    return res.status(status).json(data);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });
});
