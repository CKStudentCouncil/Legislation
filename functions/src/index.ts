/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";
// eslint-disable-next-line camelcase
import {drive_v3, google} from "googleapis";
import * as Stream from "stream";
admin.initializeApp(); // This is required to run before everything else

const globalFunctionOptions = {region: "asia-east1"};
const auth = new google.auth.GoogleAuth({keyFile: "src/credential.json", scopes: ["https://www.googleapis.com/auth/drive.file"]});
// eslint-disable-next-line camelcase
const driveAPI = google.drive({version: "v3", auth}) as drive_v3.Drive;

export const uploadAttachment = onCall(globalFunctionOptions, async (request) => {
  if (request.auth == null) {
    throw new HttpsError("unauthenticated",
      "The function must be called while authenticated.");
  }
  const {name, content, mimeType} = request.data;
  const folderQuery = await driveAPI.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${getCurrentReign()}'`,
    fields: "files(id)",
  });
  let folder: string | null | undefined = null;
  if ((folderQuery.data.files?.length ?? 0) == 0) {
    folder = (await driveAPI.files.create({
      requestBody: {
        name: getCurrentReign(),
        mimeType: "application/vnd.google-apps.folder",
        parents: ["1zNk5v8ZHJwAbDXCO_GswQoeY_CBCpb7m"],
      },
      fields: "id",
    })).data.id;
  } else {
    folder = folderQuery.data.files?.[0].id;
  }
  const file = await driveAPI.files.create({
    requestBody: {
      name,
      mimeType,
      parents: [folder ?? "1zNk5v8ZHJwAbDXCO_GswQoeY_CBCpb7m"],
    },
    media: {
      mimeType,
      body: new Stream.PassThrough().end(Buffer.from(content, "base64")),
    },
    fields: "id,webViewLink",
  });
  await driveAPI.permissions.create({
    fileId: file.data.id ?? "",
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });
  await driveAPI.permissions.create({
    fileId: file.data.id ?? "",
    requestBody: {
      role: "writer",
      type: "user",
      emailAddress: "cksc77th@gmail.com",
    },
  });
  return {success: true, url: file.data.webViewLink};
});

// eslint-disable-next-line require-jsdoc
function getCurrentReign() {
  const date = new Date();
  return `${date.getFullYear() - 1945}-${date.getMonth() > 7 || date.getMonth() < 1 ? "1" : "2"}`; // August to January
}
