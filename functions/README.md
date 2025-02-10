# Firebase functions setup guide
1. Go to https://console.cloud.google.com/projectselector2/iam-admin/serviceaccounts?inv=1&invt=AbpMCA&supportedpurview=project and create a service account, add a key with JSON type.
2. Rename the file to `credential.json` and place it in the `src` directory
3. Run `yarn` to install the dependencies
4. Run `firebase deploy --only functions` to deploy the functions
