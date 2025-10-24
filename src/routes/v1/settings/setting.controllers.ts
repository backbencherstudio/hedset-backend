import { PrismaClient, Setting } from "@prisma/client";
const prisma = new PrismaClient();

export const createSettings = async (request, reply) => {
  try {
    const { privacyPolicy, termsCondition, aboutUs } = request.body;

    const updateData: any = {};

    if (privacyPolicy !== undefined) updateData.privacyPolicy = privacyPolicy;
    if (termsCondition !== undefined) updateData.termsCondition = termsCondition;
    if (aboutUs !== undefined) updateData.aboutUs = aboutUs;

 
    const existingSetting = await prisma.setting.findFirst();

    const setting = await prisma.setting.upsert({
      where: { id: existingSetting?.id || "" },
      update: updateData,
      create: updateData,
    });

    return reply.status(200).send({
      success: true,
      message: existingSetting
        ? "Settings updated successfully"
        : "Settings created successfully",
      data: updateData,
    });
  } catch (error) {
    console.error("Error creating/updating settings:", error);
    return reply.status(500).send({
      success: false,
      error: error.message,
      message: "Internal Server Error",
    });
  }
};
