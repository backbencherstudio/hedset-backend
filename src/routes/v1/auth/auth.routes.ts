import { FastifyInstance } from "fastify";
import {
  getRecentOtp,
  registerSendOtp,
  registerVerifyOtp,
  googleAuth,
  usersLogin,
  adminLogin,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  forgotPasswordRecentOtp,
  email2FASendOtp,
  email2FAVerifyOtp,
  email2FARecentOtp,
  permissions,
  updateUser,
  getUserProfile,
} from "./auth.controllers";
import { upload } from "../../../config/storage.config";
import { verifyUser } from "../../../middleware/auth.middleware";

const authRoutes = (fastify: FastifyInstance) => {
  // User Registration and OTP Verification
  fastify.post("/register/sendotp", registerSendOtp);
  fastify.post("/register/verifyotp", registerVerifyOtp);
  fastify.post("/register/recentotp", getRecentOtp);

  ///login
  //google auth
  fastify.post("/register/google", googleAuth);

  //manual log
  fastify.post("/user/login", usersLogin);
  fastify.post("/admin/login", adminLogin);

  //forgot passwors
  fastify.post("/forgotpassword/sendotp", forgotPasswordSendOtp);
  fastify.post("/forgotpassword/verifyotp", forgotPasswordVerifyOtp);
  fastify.post("/forgotpassword/reset", forgotPasswordReset);
  fastify.post("/forgotpassword/recentotp", forgotPasswordRecentOtp);

  //TwoFactor authentication (2FA)
  fastify.post("/2fa/email/sendotp", email2FASendOtp);
  fastify.post("/2fa/email/verifyotp", email2FAVerifyOtp);
  fastify.post("/2fa/email/recentotp", email2FARecentOtp);

  //email change
  // fastify.post('/change-email/sendotp', chnageEmail)

  //controll parmitions
  fastify.patch(
    "/parmitions",
    { preHandler: verifyUser("user", "admin") },
    permissions
  );

  fastify.patch(
    "/update",
    {
      preHandler: [verifyUser("user", "admin"), upload.single("avatar")],
    },
    updateUser
  );

  fastify.get(
    "/me",
    {
      preHandler: [verifyUser("user", "admin")],
    },
    getUserProfile
  );
};

export default authRoutes;
