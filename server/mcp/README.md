# Classic Mini DIY MCP Server

Model Context Protocol (MCP) server providing Classic Mini calculator tools for LLMs.

## Overview

This MCP server exposes three main tools for Classic Mini enthusiasts:

- **Compression Calculator**: Calculate compression ratio and engine capacity
- **Gearbox Calculator**: Calculate gear ratios, top speed, and speedometer compatibility
- **Chassis Decoder**: Decode and validate Classic Mini chassis numbers

## Authentication

**All MCP endpoints require authentication via Bearer token.**

### Setting Up API Keys

Configure API keys via environment variables:

```bash
# Single API key
MCP_API_KEY=your-secure-api-key

# Multiple API keys (comma-separated)
MCP_API_KEYS=key1,key2,key3
```

### Development Mode

There is no built-in default key — authentication fails closed in every
environment. For local development, set `MCP_API_KEY` (or `MCP_API_KEYS`) in your
`.env` and send that value as the Bearer token.

### Providing API Keys

API keys must be provided via Authorization header with Bearer token:

```bash
curl -H "Authorization: Bearer your-api-key" https://www.classicminidiy.com/mcp
```

## MCP Server Endpoint

- **URL**: `https://www.classicminidiy.com/mcp`
- **Server Name**: `classic-mini-calculators`
- **Authentication**: API Key Required

## Available Tools

### 1. compression-calculator

Calculate compression ratio and engine capacity for Classic Mini engines.

**Parameters:**

- `bore` (number): Bore diameter in cm (e.g., 7.06 for 70.6mm)
- `stroke` (number): Stroke length in cm (e.g., 8.128 for 81.28mm)
- `pistonDish` (number): Piston dish volume in cc
- `headVolume` (number): Cylinder head chamber volume in cc
- `deckHeight` (number): Piston deck height in thousandths of an inch
- `gasket` (number): Head gasket volume in cc (use 0 for custom)
- `customGasket` (number): Custom gasket volume in cc (used when gasket is 0)
- `decomp` (number): Decompression plate volume in cc

**Example:**

```json
{
  "bore": 7.06,
  "stroke": 8.128,
  "pistonDish": 6.5,
  "headVolume": 25.5,
  "deckHeight": 20,
  "gasket": 3.4,
  "decomp": 0
}
```

### 2. gearbox-calculator

Calculate gear ratios, top speed, and speedometer compatibility.

**Parameters:**

- `metric` (boolean): Use metric units (true for km/h, false for mph)
- `final_drive` (number): Final drive ratio (e.g., 3.444)
- `gear_ratios` (array): Gear ratios in order [1st, 2nd, 3rd, 4th, optional 5th]. Length 4 for 4-speed gearboxes, length 5 for 5-speed (e.g., Minispares Evolution 5-Speed with overdrive)
- `drop_gear` (number): Drop gear ratio
- `speedo_drive` (number): Speedometer drive ratio
- `max_rpm` (number): Maximum engine RPM
- `tire_type` (object): Tire specifications with width, profile, and size

**Example:**

```json
{
  "metric": false,
  "final_drive": 3.444,
  "gear_ratios": [2.583, 1.644, 1.25, 1.0],
  "drop_gear": 1,
  "speedo_drive": 0.3529,
  "max_rpm": 6500,
  "tire_type": {
    "width": 145,
    "profile": 80,
    "size": 10
  }
}
```

### 3. chassis-decoder

Decode and validate Classic Mini chassis numbers based on year range.

**Parameters:**

- `yearRange` (string): Year range for chassis format
  - Valid values: "1959-1969", "1969-1974", "1974-1980", "1980", "1980-1985", "1985-1990", "1990-on"
- `chassisNumber` (string): Classic Mini chassis number to decode

**Example:**

```json
{
  "yearRange": "1959-1969",
  "chassisNumber": "A-A2S7L-123A"
}
```

## Using with AI Assistants

### Claude Desktop / Claude Code

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "classic-mini-diy": {
      "url": "https://www.classicminidiy.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "classic-mini-diy": {
      "url": "https://www.classicminidiy.com/mcp",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}
```

### Custom MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'classic-mini-calculators',
  version: '1.0.0',
});

await client.connect({
  url: 'https://www.classicminidiy.com/mcp',
  headers: {
    Authorization: 'Bearer your-api-key',
  },
});

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: 'compression-calculator',
  arguments: {
    bore: 7.06,
    stroke: 8.128,
    pistonDish: 6.5,
    headVolume: 25.5,
  },
});
```

## Security Best Practices

1. **Keep API Keys Secret**: Never commit API keys to version control
2. **Use Environment Variables**: Store keys in `.env` files (git-ignored)
3. **Rotate Keys Regularly**: Change API keys periodically for production use
4. **Unique Keys per Integration**: Give each LLM integration its own unique API key
5. **Monitor Usage**: Track API key usage to detect unauthorized access

## Error Responses

### 401 Unauthorized

No Bearer token provided:

```json
{
  "statusCode": 401,
  "statusMessage": "Unauthorized",
  "message": "Bearer token required. Provide via Authorization header: \"Bearer <api-key>\""
}
```

### 403 Forbidden

Invalid API key:

```json
{
  "statusCode": 403,
  "statusMessage": "Forbidden",
  "message": "Invalid API key provided."
}
```

## Caching

- Tool results are cached for optimal performance
- Compression and gearbox calculators: 1 hour cache
- Chassis decoder: 24 hour cache

## Support

For issues or questions:

- GitHub: https://github.com/SomethingNew71/classicminidiy
- Website: https://www.classicminidiy.com
