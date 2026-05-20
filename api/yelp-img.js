// Proxies Yelp CDN images so the browser can fetch them without CORS issues.
// Fixed path — the image path arrives as a ?path= query param (slashes encode
// fine), avoiding Vercel's broken [...catch-all] routing.
export default async function handler(req, res) {
  const path = (req.query.path || "").replace(/^\/+/, "");
  if (!path) {
    return res.status(400).json({ error: "Missing ?path= query parameter" });
  }

  const url = `https://s3-media0.fl.yelpcdn.com/${path}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).end();
    }

    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
