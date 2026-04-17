export default async function handler(req, res) {
  const subpath = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path || "";
  const url = `https://s3-media0.fl.yelpcdn.com/${subpath}`;

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
