const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const CLIENT_ID = '1d952129111a45b2b86ea1c08dd9c6ca';  // Replace with your Spotify Client ID
const CLIENT_SECRET = 'c6ddfe3768bf43e092a68bfe0e9f3e6a';  // Replace with your Spotify Client Secret

// Function to get Spotify access token
async function getSpotifyAccessToken() {
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }
    });

    return tokenResponse.data.access_token;
}

// Endpoint to search songs on Spotify
app.post('/search', async (req, res) => {
    try {
        const searchTerm = req.body.searchTerm;
        const accessToken = await getSpotifyAccessToken();

        const searchResponse = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchTerm)}&type=track`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        res.json(searchResponse.data.tracks.items);
    } catch (error) {
        console.error('Error during search: ', error);
        res.status(500).send('Error during search');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
