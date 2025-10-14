import { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import {
  forgotPasswordEmail,
  otpVerificationEmail,
  sendForgotPasswordOTP,
  sendTwoFactorOtp,
} from "../../../utils/email.config";

import { generateJwtToken } from "../../../utils/jwt.utils";
import { getImageUrl } from "../../../utils/baseurl";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { authenticator } from "otplib";
import { uploadsDir } from "../../../config/storage.config";
import { Lifestyle } from "@prisma/client";

const downloadAndSaveImage = async (imageUrl: string): Promise<string> => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to download image");

    const buffer = await response.arrayBuffer();
    const filename = `${uuidv4()}.jpg`;
    const uploadDir = path.join(__dirname, "../../../../uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, Buffer.from(buffer));

    return filename;
  } catch (error) {
    console.error("Error saving image:", error);
    throw new Error("Failed to download and save image");
  }
};

export const registerSendOtp = async (request, reply) => {
  try {
    const { name, email, password } = request.body;

    const missingField = ["name", "email", "password"].find(
      (field) => !request.body[field]
    );

    if (missingField) {
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }

    const prisma = request.server.prisma;
    const redis = request.server.redis;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return reply.status(400).send({
        success: false,
        message: "User with this email already exists",
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const otpExpiry = Date.now() + 5 * 60 * 1000;

    otpVerificationEmail(email, otp);

    await redis
      .multi()
      .hset(`register-verify-otp:${email}`, {
        name,
        email,
        password,
        otp,
        expiration: otpExpiry.toString(),
      })
      .expire(`register-verify-otp:${email}`, 5 * 60)
      .exec();

    return reply.status(200).send({
      success: true,
      message: "send otp in your email!",
      otp: process.env.NODE_ENV === "development" ? otp : null,
    });
  } catch (error) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ succes: false, error: error, message: "Internal Server Error" });
  }
};

export const registerVerifyOtp = async (request, reply) => {
  try {
    const { email, otp } = request.body;

    if (!email || !otp) {
      return reply.status(400).send({
        success: false,
        message: "Email and OTP are required!",
      });
    }

    const redis = request.server.redis;
    const prisma = request.server.prisma;

    const userData = await redis.hgetall(`register-verify-otp:${email}`);

    console.log(userData);

    if (!Object.keys(userData || {}).length) {
      return reply.status(400).send({
        success: false,
        message: "not found! please register again",
      });
    }

    if (userData.otp !== otp) {
      return reply.status(400).send({
        success: false,
        message: "invalid OTP!",
      });
    }

    const now = Date.now();
    if (now > parseInt(userData.expiration)) {
      return reply.status(400).send({
        success: false,
        message: "OTP expired!",
      });
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
      },
    });

    // const chatRoom = await prisma.chatRoom.create({
    //   data: {
    //     userId: newUser.id,
    //   },
    // });

    // console.log("roome :", chatRoom);

    await redis.del(`register-verify-otp:${email}`);

    const token = generateJwtToken({
      id: newUser.id,
      email: newUser.email,
      type: newUser.type,
    });

    const { password, ...userdata } = newUser;

    return reply.status(200).send({
      success: true,
      message: "user registered successfully!",
      data: userdata,
      token,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getRecentOtp = async (request, reply) => {
  try {
    const { email } = request.body;

    if (!email) {
      return reply.status(400).send({
        success: false,
        message: "Email is required!",
      });
    }

    const redis = request.server.redis;

    const otpData = await redis.hgetall(`register-verify-otp:${email}`);

    if (!Object.keys(otpData || {}).length) {
      return reply.status(404).send({
        success: false,
        message: "not found! please register again",
      });
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const newExpiry = Date.now() + 5 * 60 * 1000;

    await redis
      .multi()
      .hset(`register-verify-otp:${email}`, {
        ...otpData,
        otp: newOtp,
        expiration: newExpiry.toString(),
      })
      .expire(`register-verify-otp:${email}`, 5 * 60)
      .exec();

    otpVerificationEmail(email, newOtp);

    return reply.status(200).send({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

///login
export const googleAuth = async (request, reply) => {
  try {
    const { email, name, image } = request.body;

    const missingField = ["email", "name", "image"].find(
      (field) => !request.body[field]
    );

    if (missingField) {
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }

    const prisma = request.server.prisma;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      const token = generateJwtToken({
        id: existingUser.id,
        email: existingUser.email,
        type: existingUser.type,
      });

      const userResponse = {
        ...existingUser,
        avatar: existingUser.avatar
          ? getImageUrl(`/uploads/${existingUser.avatar}`)
          : null,
      };

      return reply.status(200).send({
        success: true,
        message: "User found, login successful!",
        data: userResponse,
        token,
      });
    }

    const processedAvatar = image ? await downloadAndSaveImage(image) : null;

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        ...(processedAvatar && { avatar: processedAvatar }),
      },
    });

    // const chatRoom = await prisma.chatRoom.create({
    //   data: {
    //     userId: newUser.id,
    //   },
    // });

    // if (chatRoom) {
    //   console.log("chatRoom: ", chatRoom);
    // }
    // console.log(chatRoom);

    // console.log("roome :", chatRoom);

    const token = generateJwtToken({
      id: newUser.id,
      email: newUser.email,
      type: newUser.type,
    });

    const userResponse = {
      ...newUser,
      avatar: newUser.avatar ? getImageUrl(`/uploads/${newUser.avatar}`) : null,
    };

    return reply.status(201).send({
      success: true,
      message: "New user created successfully!",
      data: userResponse,
      token,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const usersLogin = async (request, reply) => {
  try {
    const { email, password } = request.body;

    const missingField = ["email", "password"].find(
      (field) => !request.body[field]
    );

    if (missingField) {
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }
    const prisma = request.server.prisma;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.type === "admin") {
      return reply.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return reply.status(401).send({
        success: false,
        message: "Invalid password",
      });
    }

    const token = generateJwtToken({
      id: user.id,
      email: user.email,
      type: user.type,
    });

    const userResponse = {
      ...user,
      avatar: user.avatar ? getImageUrl(`/uploads/${user.avatar}`) : null,
    };

    delete userResponse.password;

    return reply.status(200).send({
      success: true,
      message: "Login successful",
      data: userResponse,
      token,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const adminLogin = async (request, reply) => {
  try {
    const { email, password } = request.body;

    const missingField = ["email", "password"].find(
      (field) => !request.body[field]
    );

    if (missingField) {
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }
    const prisma = request.server.prisma;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.type === "user") {
      return reply.status(404).send({
        success: false,
        message: "Credential not match!",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return reply.status(401).send({
        success: false,
        message: "Invalid password",
      });
    }

    const token = generateJwtToken({
      id: user.id,
      email: user.email,
      type: user.type,
    });

    const userResponse = {
      ...user,
      avatar: user.avatar ? getImageUrl(`/uploads/${user.avatar}`) : null,
    };

    delete userResponse.password;

    return reply.status(200).send({
      success: true,
      message: "admin Login successful",
      data: userResponse,
      token,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const forgotPasswordSendOtp = async (request, reply) => {
  try {
    const { email } = request.body;

    if (!email) {
      return reply.status(400).send({
        success: false,
        message: "Email is required!",
      });
    }

    const prisma = request.server.prisma;
    const redis = request.server.redis;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        message: "User with this email does not exist",
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiry = Date.now() + 5 * 60 * 1000;

    forgotPasswordEmail(email, otp);

    await redis
      .multi()
      .hset(`forgot-password-otp:${email}`, {
        email,
        otp,
        expiration: otpExpiry.toString(),
        userId: existingUser.id.toString(),
        permission_to_update_password: "true",
      })
      .expire(`forgot-password-otp:${email}`, 5 * 60)
      .exec();

    return reply.status(200).send({
      success: true,
      message: "OTP sent to your email for password reset",
      otp: process.env.NODE_ENV === "development" ? otp : null,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const forgotPasswordVerifyOtp = async (request, reply) => {
  try {
    const { email, otp } = request.body;

    const missingField = ["email", "otp"].find((field) => !request.body[field]);

    if (missingField) {
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }

    const redis = request.server.redis;
    const prisma = request.server.prisma;

    const otpData = await redis.hgetall(`forgot-password-otp:${email}`);

    if (!Object.keys(otpData || {}).length) {
      return reply.status(400).send({
        success: false,
        message: "OTP not found or expired!",
      });
    }

    if (otpData.otp !== otp) {
      return reply.status(400).send({
        success: false,
        message: "Invalid OTP!",
      });
    }

    const now = Date.now();
    if (now > parseInt(otpData.expiration)) {
      return reply.status(400).send({
        success: false,
        message: "OTP expired!",
      });
    }

    if (otpData.permission_to_update_password !== "true") {
      return reply.status(400).send({
        success: false,
        message: "Permission to update password not granted!",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: "User not found!",
      });
    }

    await redis.expire(`forgot-password-otp:${email}`, 10 * 60);

    return reply.status(200).send({
      success: true,
      message: "OTP verified successfully! You can now reset your password.",
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const forgotPasswordReset = async (request, reply) => {
  try {
    const { email, password } = request.body;

    const missingField = ["email", "password"].find(
      (field) => !request.body[field]
    );

    if (missingField) {
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }

    const redis = request.server.redis;
    const prisma = request.server.prisma;

    const otpData = await redis.hgetall(`forgot-password-otp:${email}`);
    console.log(otpData);

    if (!Object.keys(otpData || {}).length) {
      return reply.status(400).send({
        success: false,
        message: "Password reset session expired!",
      });
    }

    if (otpData.permission_to_update_password !== "true") {
      return reply.status(400).send({
        success: false,
        message: "Permission to update password not granted!",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: "User not found!",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await redis.del(`forgot-password-otp:${email}`);

    return reply.status(200).send({
      success: true,
      message: "Password reset successfully!",
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const forgotPasswordRecentOtp = async (request, reply) => {
  try {
    const { email } = request.body;

    if (!email) {
      return reply.status(400).send({
        success: false,
        message: "Email is required!",
      });
    }

    const redis = request.server.redis;
    const prisma = request.server.prisma;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      return reply.status(404).send({
        success: false,
        message: "User with this email does not exist",
      });
    }

    const otpData = await redis.hgetall(`forgot-password-otp:${email}`);

    if (!Object.keys(otpData || {}).length) {
      return reply.status(404).send({
        success: false,
        message: "No active OTP session found. Please request a new OTP.",
      });
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const newExpiry = Date.now() + 5 * 60 * 1000;

    await redis
      .multi()
      .hset(`forgot-password-otp:${email}`, {
        ...otpData,
        otp: newOtp,
        expiration: newExpiry.toString(),
      })
      .expire(`forgot-password-otp:${email}`, 5 * 60)
      .exec();

    sendForgotPasswordOTP(email, newOtp);

    return reply.status(200).send({
      success: true,
      message: "New OTP sent successfully",
      otp: process.env.NODE_ENV === "development" ? newOtp : null,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const email2FASendOtp = async (request, reply) => {
  try {
    const { email } = request.body;

    if (!email) {
      return reply.status(400).send({
        success: false,
        message: "Email is required!",
      });
    }

    const prisma = request.server.prisma;
    const redis = request.server.redis;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: "User does not exist",
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiry = Date.now() + 5 * 60 * 1000;

    await redis
      .multi()
      .hset(`2fa-otp:${email}`, {
        otp,
        expiration: otpExpiry.toString(),
        userId: user.id.toString(),
      })
      .expire(`2fa-otp:${email}`, 5 * 60)
      .exec();

    sendTwoFactorOtp(email, otp);

    return reply.status(200).send({
      success: true,
      message: "2FA OTP sent to your email",
      otp: process.env.NODE_ENV === "development" ? otp : null,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const email2FAVerifyOtp = async (request, reply) => {
  try {
    const { email, otp } = request.body;

    const missingField = ["email", "otp"].find((field) => !request.body[field]);

    if (missingField) {
      return reply.status(400).send({
        success: false,
        message: `${missingField} is required!`,
      });
    }
    const prisma = request.server.prisma;
    const redis = request.server.redis;

    const otpData = await redis.hgetall(`2fa-otp:${email}`);

    if (!Object.keys(otpData || {}).length) {
      return reply.status(400).send({
        success: false,
        message: "OTP not found or expired!",
      });
    }

    if (otpData.otp !== otp) {
      return reply.status(400).send({
        success: false,
        message: "Invalid OTP!",
      });
    }

    const now = Date.now();
    if (now > parseInt(otpData.expiration)) {
      return reply.status(400).send({
        success: false,
        message: "OTP expired!",
      });
    }

    const secret = authenticator.generateSecret();

    const user = await prisma.user.update({
      where: { email },
      data: {
        two_factor_authentication: 1,
        secret: secret,
      },
    });

    await redis.del(`2fa-otp:${email}`);

    return reply.status(200).send({
      success: true,
      message: "Two-factor authentication enabled successfully!",
      data: {
        id: user.id,
        email: user.email,
        two_factor_authentication: user.two_factor_authentication,
        secret: user.secret,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const email2FARecentOtp = async (request, reply) => {
  try {
    const { email } = request.body;

    if (!email) {
      return reply.status(400).send({
        success: false,
        message: "Email is required!",
      });
    }

    const prisma = request.server.prisma;
    const redis = request.server.redis;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: "User does not exist",
      });
    }

    const otpData = await redis.hgetall(`2fa-otp:${email}`);

    if (!Object.keys(otpData || {}).length) {
      return reply.status(404).send({
        success: false,
        message: "No active 2FA OTP session found. Please request a new OTP.",
      });
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const newExpiry = Date.now() + 5 * 60 * 1000;

    await redis
      .multi()
      .hset(`2fa-otp:${email}`, {
        ...otpData,
        otp: newOtp,
        expiration: newExpiry.toString(),
      })
      .expire(`2fa-otp:${email}`, 5 * 60)
      .exec();

    sendTwoFactorOtp(email, newOtp);

    return reply.status(200).send({
      success: true,
      message: "2FA OTP resent successfull",
      otp: process.env.NODE_ENV === "development" ? newOtp : null,
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const permissions = async (request, reply) => {
  try {
    const prisma = request.server.prisma;
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    const permissions = request.body;

    // Check if at least one permission is provided
    if (Object.keys(permissions).length === 0) {
      return reply.status(400).send({
        success: false,
        message: "At least one permission field is required",
      });
    }

    const validFields = [
      "notificationAccess",
      "emailAccess",
      "appUpdateAccess",
      "messageAccess",
      "soundAccess",
    ];

    // Check if all provided fields are valid
    for (const field of Object.keys(permissions)) {
      if (!validFields.includes(field)) {
        return reply.status(400).send({
          success: false,
          message: `Invalid field: "${field}". Valid fields are: ${validFields.join(
            ", "
          )}`,
        });
      }
    }

    // Check if all values are boolean
    for (const [key, value] of Object.entries(permissions)) {
      if (typeof value !== "boolean") {
        return reply.status(400).send({
          success: false,
          message: `"${key}" must be true or false`,
        });
      }
    }

    // Update user permissions
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: permissions,
      select: {
        id: true,
        notificationAccess: true,
        emailAccess: true,
        appUpdateAccess: true,
        messageAccess: true,
        soundAccess: true,
      },
    });

    return reply.send({
      success: true,
      message: "Permissions updated",
      data: updatedUser,
    });
  } catch (error) {
    request.log.error(error);

    if (error.code === "P2025") {
      return reply.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    return reply.status(500).send({
      success: false,
      message: "Internal function error",
    });
  }
};

export const updateUser = async (request, reply) => {
  const removeFile = (filePath: string) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  };

  const allowedLifestyles = ["student", "Senior"];

  try {
    const prisma = request.server.prisma;
    const userId = request.user?.id;

    const allowedFields = [
      "name",
      "email",
      "password",
      "phone",
      "timezone",
      "dateOfBirth",
      "gender",
      "lifestyle",
    ];

    const updateData: Record<string, any> = {};

    // Populate updateData with non-empty values
    for (const field of allowedFields) {
      const value = request.body[field];
      if (value !== undefined && value !== null && value !== "") {
        updateData[field] = value;
      }
    }

    if (
      updateData.lifestyle &&
      !allowedLifestyles.includes(updateData.lifestyle)
    ) {
      return reply.code(400).send({
        success: false,
        message: `Invalid lifestyle. Use: ${allowedLifestyles.join(" or ")}`,
      });
    }

    // Handle avatar update
    if (request.file) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true },
      });

      if (currentUser?.avatar) {
        removeFile(path.join(uploadsDir, currentUser.avatar));
      }

      updateData.avatar = request.file.filename;
    }

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({
        success: false,
        message: "At least one field must be provided for update",
      });
    }

    // Update user in the database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        timezone: true,
        dateOfBirth: true,
        gender: true,
        avatar: true,
        lifestyle: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return success
    return reply.code(200).send({
      success: true,
      message: "User profile updated successfully",
      data: {
        ...updatedUser,
        avatar: updatedUser.avatar
          ? getImageUrl(`/uploads/${updatedUser.avatar}`)
          : null,
      },
    });
  } catch (error) {
    request.log.error(error);

    if (request.file?.path) {
      removeFile(request.file.path);
    }

    return reply.code(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getUserProfile = async (request, reply) => {
  try {
    const prisma = request.server.prisma;
    const userId = request.user?.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: "User not found",
      });
    }
    const { password, ...userData } = user;

    return reply.status(200).send({
      success: true,
      message: "User profile fetched successfully",
      data: {
        ...userData,
        avatar: user.avatar ? getImageUrl(`/uploads/${user.avatar}`) : null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
