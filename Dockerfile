FROM node:22-alpine
COPY dist/ssr ./dist/ssr
EXPOSE 3000
CMD ["node", "dist/ssr/index.js"]
