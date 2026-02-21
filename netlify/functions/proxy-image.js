// Netlify Function: proxy-image
// Proxies allowed image domains and returns a CORS-friendly response.
exports.handler = async function (event) {
  const url = (event.queryStringParameters && event.queryStringParameters.url) || null;
  if (!url) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  // Only allow bcbits images for now
  if (!url.startsWith('https://f4.bcbits.com/')) {
    return { statusCode: 403, body: 'Forbidden domain' };
  }

  try {
    // Use global fetch available in Netlify's Node runtime
    const res = await fetch(url);
    if (!res.ok) {
      return { statusCode: res.status, body: `Upstream error ${res.status}` };
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const body = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
      isBase64Encoded: true,
      body,
    };
  } catch (err) {
    return { statusCode: 500, body: 'Fetch failed' };
  }
};
