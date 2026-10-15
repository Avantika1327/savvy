import { Router, type Response } from "express";
import { z } from "zod";
import {
  acceptPlantManagerInvitation,
  getPlantManagerInvitation,
  PlantManagerInvitationError,
} from "./plant-manager-invitations.service.js";

export const plantManagerInvitationPublicRouter = Router();

const acceptSchema = z
  .object({
    password: z
      .string()
      .min(12, "Password must contain at least 12 characters.")
      .max(72)
      .optional(),
  })
  .strict();

function handleInvitationError(res: Response, error: unknown) {
  if (!(error instanceof PlantManagerInvitationError)) throw error;

  switch (error.code) {
    case "INVITATION_PASSWORD_REQUIRED":
      return res
        .status(400)
        .json({
          error: {
            code: error.code,
            message:
              "Choose a password with at least 12 characters to create your Savvy account.",
          },
        });
    case "INVITATION_PASSWORD_TOO_LONG":
      return res
        .status(400)
        .json({
          error: {
            code: error.code,
            message: "Password is too long. Use up to 72 UTF-8 bytes.",
          },
        });
    case "INVITATION_PLATFORM_ACCOUNT":
      return res
        .status(403)
        .json({
          error: {
            code: error.code,
            message:
              "Platform administrator accounts cannot be assigned as plant managers.",
          },
        });
    case "INVITATION_PLANT_UNAVAILABLE":
      return res
        .status(410)
        .json({
          error: {
            code: error.code,
            message:
              "This plant is no longer available for assignment. Contact your tenant administrator.",
          },
        });
    default:
      return res
        .status(410)
        .json({
          error: {
            code: "INVITATION_INVALID_OR_EXPIRED",
            message:
              "This invitation is invalid, expired, or already used. Ask your tenant administrator to send a new one.",
          },
        });
  }
}

plantManagerInvitationPublicRouter.get("/:token", async (req, res, next) => {
  try {
    const data = await getPlantManagerInvitation(req.params.token);
    return res.json({ data });
  } catch (error) {
    try {
      return handleInvitationError(res, error);
    } catch (unhandled) {
      return next(unhandled);
    }
  }
});

plantManagerInvitationPublicRouter.post(
  "/:token/accept",
  async (req, res, next) => {
    const parsed = acceptSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              parsed.error.issues[0]?.message ?? "Invalid invitation details.",
          },
        });
    }

    try {
      const data = await acceptPlantManagerInvitation({
        token: req.params.token,
        password: parsed.data.password,
      });
      return res.json({
        data,
        message: data.existingAccount
          ? "Invitation accepted. Sign in using your existing Savvy password."
          : "Invitation accepted. Your Savvy account has been created; you can now sign in.",
      });
    } catch (error) {
      try {
        return handleInvitationError(res, error);
      } catch (unhandled) {
        return next(unhandled);
      }
    }
  },
);
