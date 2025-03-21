# Blorkboard

A beautiful dashboard for managing and launching Blork projects.

## Installation

```bash
npm install @littlecarlito/blorkboard
```

## Usage

```javascript
import { startBlorkboard } from '@littlecarlito/blorkboard';

startBlorkboard({
  port: 3000,
  projects: [
    // Your projects configuration
  ]
});
```

## CLI Usage

```bash
npx blorkboard --port 3000
```

## License

MIT 