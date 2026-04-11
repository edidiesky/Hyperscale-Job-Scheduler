// import jwt from "jsonwebtoken";
// import logger from "./logger";
// import redisClient from "../config/redis";
// import { nanoid } from "nanoid";
// import { PermissionService } from "../services/permission.service";

// export const signJwt = async (tin: string, role: string, name: string) => {
//   try {
//     const [permissions, directorates, roleDataCode] = await Promise.all([
//       PermissionService.getUserPermissions(tin),
//       PermissionService.getUserDirectorates(tin),
//       PermissionService.getUserRoleCode(tin),
//     ]);
//     const roleLevel = await PermissionService.getUserRoleLevel(
//       tin,
//       directorates[0],
//     );
//     const payload = {
//       userId: tin,
//       name,
//       permissions,
//       directorates,
//       roleLevel,
//       userType: role,
//       roleDataCode,
//     };
//     // logger.info("Token:", {
//     //   payload
//     // })
//     return jwt.sign(payload, process.env.JWT_CODE!, {
//       expiresIn: "7d",
//     });
//   } catch (error) {
//     logger.error("Error generating JWT", {
//       tin,
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//     throw error;
//   }
// };

// export const generateToken = async (
//   res: import("express").Response,
//   tin: string,
//   role: string,
//   name: string,
// ) => {
//   try {
//     const accessToken = await signJwt(tin, role, name);
//     const refreshToken = nanoid(32);
//     await redisClient.set(
//       `refresh:${refreshToken}`,
//       JSON.stringify({ tin, role, name }),
//       "EX",
//       7 * 24 * 60 * 60,
//     );
//     res.cookie("jwt", accessToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//       path: "/",
//     });

//     return { accessToken, refreshToken };
//   } catch (error) {
//     logger.error("Error generating token", {
//       tin,
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//     throw error;
//   }
// };
