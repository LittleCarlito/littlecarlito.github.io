# Blorkvisor

A beautiful dashboard for managing and launching Blork projects.

## Installation

```bash
npm install @littlecarlito/blorkvisor
```

## Usage

```javascript
import { startBlorkvisor } from '@littlecarlito/blorkvisor';

startBlorkvisor({
  port: 3000,
  projects: [
    // Your projects configuration
  ]
});
```

## CLI Usage

```bash
pnpm dlx blorkvisor --port 3000
```

## License

MIT 