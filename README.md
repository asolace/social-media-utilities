# My Marketing Tools

A collection of handy browser-based tools built with React and Vite.

## Tools

- **Image Namer** — AI-powered bulk image renaming using Claude. Drag & drop images, get descriptive filenames, edit inline, and download individually or as a ZIP.
- **Image Resizer** — Bulk resize and convert images. Set width/height with locked aspect ratio, pick output format (JPG/PNG/WEBP), adjust quality, and download as ZIP.

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) (for the Image Namer)

### Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
VITE_ANTHROPIC_API_KEY=your-api-key-here
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```
