/**
 * More info about this file:
 * https://v2.quasar.dev/quasar-cli-vite/developing-ssr/ssr-webserver
 *
 * Runs in Node context.
 */

/**
 * Since @quasar/app-vite v3, /src-ssr is its own package: anything imported
 * here must be declared in /src-ssr/package.json (not the root one).
 */
import { initSentry } from './sentry.ts';
import express from 'express';
import type { Application, Request, Response } from 'express';
import type { Server } from 'node:http';
import {
  defineSsrCreate,
  defineSsrInjectDevMiddleware,
  defineSsrListen,
  defineSsrClose,
  defineSsrServeStaticContent,
  defineSsrRenderPreloadTag,
} from '#q-app';

// Tells Quasar which server driver we use, so `app`/`req`/`res` are typed
// as Express types in server.ts and in every /src-ssr/middlewares file.
declare module '#q-app' {
  interface SsrDriver {
    app: Application;
    listenResult: Server;
    request: Request;
    response: Response;
  }
}

/**
 * Create your webserver and return its instance.
 * If needed, prepare your webserver to receive
 * connect-like middlewares.
 *
 * Can be async: defineSsrCreate(async ({ ... }) => { ... })
 */
export const create = defineSsrCreate(async (/* { ... } */) => {
  // Before anything else, so the default onUncaughtException / onUnhandledRejection
  // handlers cover the whole life of the process. No-op unless SENTRY_DSN is set.
  initSentry();

  const app = express();

  // attackers can use this header to detect apps running Express
  // and then launch specifically-targeted attacks
  app.disable('x-powered-by');

  // place here any middlewares that
  // absolutely need to run before anything else
  if (import.meta.env.QUASAR_PROD) {
    const { default: compression } = await import('compression');
    app.use(compression());
  }

  return app;
});

/**
 * Used by the Quasar SSR dev server to inject its own middleware
 * (Vite dev server, public path handling, etc) into our webserver.
 */
export const injectDevMiddleware = defineSsrInjectDevMiddleware(
  ({ app }) =>
    (middleware) => {
      app.use(middleware);
    },
);

/**
 * You need to make the server listen to the indicated port
 * and return the listening instance or whatever you need to
 * close the server with.
 *
 * The "listenResult" param for the "close()" definition below
 * is what you return here.
 *
 * For production, you can instead export your
 * handler for serverless use or whatever else fits your needs.
 *
 * Can be async: defineSsrListen(async ({ app, devHttpsOptions, port }) => { ... })
 */
export const listen = defineSsrListen(async ({ app, devHttpsOptions, port }) => {
  if (import.meta.env.QUASAR_DEV && devHttpsOptions) {
    const https = await import('node:https');
    const server = https.createServer(devHttpsOptions, (req, res) => {
      app(req, res);
    });
    return server.listen(port);
  }

  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    app(req, res);
  });

  // Cloud Run routes traffic to the container's external interface, so bind
  // 0.0.0.0 in production; localhost keeps the dev server off the LAN.
  return server.listen(port, import.meta.env.QUASAR_PROD ? '0.0.0.0' : 'localhost', () => {
    if (import.meta.env.QUASAR_PROD) {
      console.log('Server listening at port ' + port);
    }
  });
});

/**
 * Should close the server and free up any resources.
 * Will be used on development only when the server needs
 * to be rebooted.
 *
 * Should you need the result of the "listen()" call above,
 * you can use the "listenResult" param.
 *
 * Can be async: defineSsrClose(async ({ listenResult }) => { ... }))
 */
export const close = defineSsrClose(({ listenResult }) => {
  return listenResult.close();
});

const maxAge = import.meta.env.QUASAR_DEV ? 0 : 1000 * 60 * 60 * 24 * 30;

/**
 * Should return a function that will be used to configure the webserver
 * to serve static content at "urlPath" from "pathToServe" folder/file.
 *
 * Notice resolve.urlPath(urlPath) and resolve.public(pathToServe) usages.
 *
 * Can be async: defineSsrServeStaticContent(async ({ app, resolve }) => {
 * Can return an async function: return async ({ urlPath = '/', pathToServe = '.', opts = {} }) => {
 */
export const serveStaticContent = defineSsrServeStaticContent(({ app, resolve }) => {
  return ({ urlPath = '/', pathToServe = '.', opts = {} }) => {
    const serveFn = express.static(resolve.public(pathToServe), { maxAge, ...opts });
    app.use(resolve.urlPath(urlPath), serveFn);
  };
});

const jsRE = /\.js$/;
const cssRE = /\.css$/;
const woff2RE = /\.woff2$/;
const gifRE = /\.gif$/;
const jpgRE = /\.jpe?g$/;
const pngRE = /\.png$/;

/**
 * Should return a String with HTML output
 * (if any) for preloading indicated file
 */
export const renderPreloadTag = defineSsrRenderPreloadTag((file /* , { ssrContext } */) => {
  if (jsRE.test(file) === true) {
    return `<link rel="modulepreload" href="${file}" crossorigin>`;
  }

  if (cssRE.test(file) === true) {
    return `<link rel="stylesheet" href="${file}" crossorigin>`;
  }

  // Deliberately no .woff branch. Quasar's material-icons @font-face lists woff2 first and
  // falls back to woff, and every browser in build.target (es2022 / firefox115 / chrome115 /
  // safari14) supports woff2 — so the woff is dead weight the browser would never request on
  // its own. Preloading it does not give the browser a choice: `as="font"` fetches it
  // unconditionally, so the tag was the only reason a second 165 KB copy of the same icon
  // font ever came down the wire. Returning '' leaves the CSS to pick woff2 as it already did.
  if (woff2RE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`;
  }

  if (gifRE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="image" type="image/gif" crossorigin>`;
  }

  if (jpgRE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="image" type="image/jpeg" crossorigin>`;
  }

  if (pngRE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="image" type="image/png" crossorigin>`;
  }

  return '';
});
