# Blorkvisor

A beautiful dashboard for managing and launching Blork projects.

## CI/CD Integration

BlorkVisor provides seamless integration with CI/CD pipelines:

- **GitHub Actions Support**: Pre-configured workflows for continuous integration
- **Pipeline Configuration**: Customizable pipeline steps for testing and deployment
- **Build Optimization**: Parallelized builds for faster CI execution
- **Automated Testing**: Integration with Jest and other testing frameworks
- **Quality Assurance**: Code quality checks with ESLint and TypeScript validation

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