FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/blorktools/package.json ./packages/blorktools/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @littlecarlito/blorktools
COPY packages/blorktools/ ./packages/blorktools/
WORKDIR /app/packages/blorktools
EXPOSE 3001
CMD ["node", "bin/cli.js", "debugger", "--host", "0.0.0.0", "--no-open"]
