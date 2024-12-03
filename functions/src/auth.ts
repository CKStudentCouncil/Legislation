/* eslint-disable require-jsdoc */
import {https} from "firebase-functions";
import * as admin from "firebase-admin";
import {User} from "./models";
import {randomChars} from "./utils";

const auth = admin.auth();

export async function checkRole(request: https.CallableContext, role: string) {
  if (!request.auth) {
    throw new https.HttpsError("unauthenticated", "You must be authenticated");
  }
  if (request.auth.uid == "5MK7Kr4O9GVg76lHCsy6ex45kP03") {
    // Root account
    return;
  }
  const user = await auth.getUser(request.auth.uid);
  const userRoles = user.customClaims?.roles;
  if (userRoles == null || !userRoles.includes(role)) {
    throw new https.HttpsError(
      "permission-denied",
      `You do not have the required role (You:${userRoles?.join(",")}/Req:${role}) to perform this action`,
    );
  }
}

export async function addUserWithRole(user: User) {
  let result = null;
  try {
    result = await auth.getUserByEmail(user.email);
  } catch (e) {
    // user not found
  }
  if (!result) {
    result = await auth.createUser({
      email: user.email,
      emailVerified: true,
      password: randomChars(64),
      displayName: user.name,
      disabled: false,
    });
  }
  await auth.setCustomUserClaims(result.uid, {
    roles: user.roles,
  });
  return result;
}

export async function editUserClaims(uid: string, user: User) {
  let validClaims = (await auth.getUser(uid)).customClaims;
  if (validClaims == null) {
    validClaims = {};
  }
  for (const key in user) {
    if (user[key as keyof User] != null && key != "uid" && key != "email" && key != "name") {
      validClaims[key as keyof typeof validClaims] = user[key as keyof User];
    }
  }
  await auth.setCustomUserClaims(uid, validClaims);
}
