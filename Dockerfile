FROM node:22-alpine
# Neither the Dockerfile nor Quasar's generated server set this, so Cloud Run was running
# Vue in development mode: dev-only assertions and warnings active on every render.
# Dependencies are installed by `yarn gcp-build` before the image is built, so this only
# affects the runtime, never which packages get installed.
ENV NODE_ENV=production
COPY dist/ssr ./dist/ssr
EXPOSE 3000
CMD ["node", "dist/ssr/index.js"]
