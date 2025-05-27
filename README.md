# CKSC Legislation (cksc-legislation)

A platform for organizing and displaying laws, orders and documents of the student council of CKHS

Note: There are two sites configured in Firebase Hosting, the one named `cksc-legislation` is a legacy domain, and was set to 301 redirect all routes to `cksc-law` over the `law.cksc.tw` domain.
The active site is `cksc-law`, and all deployments should target that site instead.

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Lint the files
```bash
yarn lint
# or
npm run lint
```


### Format the files
```bash
yarn format
# or
npm run format
```



### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
