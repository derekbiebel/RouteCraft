export default async function handler(req, res) {
  const { ll, radius, query, limit } = req.query;

  if (!ll || !query) {
    return res.status(400).json({ error: 'Missing ll or query parameter' });
  }

  const params = new URLSearchParams({
    ll,
    radius: radius || '10000',
    query,
    limit: limit || '20',
  });

  try {
    const response = await fetch(
      `https://places-api.foursquare.com/places/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FOURSQUARE_API_KEY || process.env.VITE_FOURSQUARE_API_KEY}`,
          'Accept': 'application/json',
          'X-Places-Api-Version': '2025-06-17',
        },
      }
    );

    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Foursquare API request failed' });
  }
}
